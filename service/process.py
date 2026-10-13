"""子进程与指标采样（008 对象化）。

对象一：ChildProcess —— 负责一个任务的子进程，自建进程组，取消与超时对整组生效。
对象二：MetricsSampler —— 负责读 /proc，采样 CPU 时间与峰值常驻内存。

边界：两个对象都不碰任务状态机，也不碰 HTTP。状态迁移由 Executor 决定。
被谁持有：Executor 持有 MetricsSampler 的实例，并为每个任务创建一个 ChildProcess。
"""
from __future__ import annotations

import os
import signal
import subprocess
import time

GRACE_SECONDS = 3.0
CLOCK_TICKS = os.sysconf("SC_CLK_TCK")
SAFE_ENV_KEYS = ("PATH", "HOME", "LANG", "LC_ALL", "TZ")


def signal_group(pgid: int, signum: int) -> None:
    """向整个进程组发信号。组已不存在时静默返回。供 Executor 与 ChildProcess 共用。"""
    try:
        os.killpg(pgid, signum)
    except (ProcessLookupError, PermissionError):
        pass


class MetricsSampler:
    """读 /proc 采样。进程已退出时返回 (None, None)。"""

    def __init__(self, clock_ticks: int = CLOCK_TICKS) -> None:
        self.clock_ticks = clock_ticks

    def sample(self, pid: int) -> tuple[float | None, int | None]:
        cpu_s: float | None = None
        max_rss_kb: int | None = None
        try:
            stat = open(f"/proc/{pid}/stat", encoding="utf-8").read()
            tail = stat.rsplit(")", 1)[1].split()
            utime, stime = float(tail[11]), float(tail[12])
            cpu_s = (utime + stime) / self.clock_ticks
        except (OSError, IndexError, ValueError):
            pass
        try:
            with open(f"/proc/{pid}/status", encoding="utf-8") as handle:
                for line in handle:
                    if line.startswith("VmHWM:"):
                        max_rss_kb = int(line.split()[1])
                        break
        except (OSError, ValueError):
            pass
        return cpu_s, max_rss_kb

    def update(self, task, pid: int) -> None:
        """采一次并写回任务的指标（任务取最大值）。"""
        task.update_usage(*self.sample(pid))


class ChildProcess:
    """一个任务的子进程。构造交给 spawn，信号交给 signal_group 与 terminate。"""

    def __init__(self, proc: subprocess.Popen, pgid: int) -> None:
        self.proc = proc
        self.pid = proc.pid
        self.pgid = pgid

    @classmethod
    def spawn(cls, task) -> "ChildProcess":
        """按任务参数起子进程。环境只带白名单键，另加任务自带变量。"""
        env = {key: os.environ[key] for key in SAFE_ENV_KEYS if key in os.environ}
        env.update(task.env)
        proc = subprocess.Popen(  # noqa: S603 - 白名单与参数校验已在 limits 层完成
            [task.command, *task.args],
            cwd=task.cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            start_new_session=True,
        )
        return cls(proc, os.getpgid(proc.pid))

    @property
    def returncode(self) -> int | None:
        return self.proc.returncode

    def poll(self) -> int | None:
        return self.proc.poll()

    def wait(self) -> None:
        self.proc.wait()

    def signal_group(self, signum: int) -> None:
        signal_group(self.pgid, signum)

    def terminate(self, sampler: MetricsSampler, task, grace_seconds: float = GRACE_SECONDS) -> None:
        """先 SIGTERM，宽限期内不退再 SIGKILL。宽限期内继续采样。"""
        if not self.pgid:
            return
        self.signal_group(signal.SIGTERM)
        deadline = time.monotonic() + grace_seconds
        while self.poll() is None and time.monotonic() < deadline:
            sampler.update(task, self.pid)
            time.sleep(0.125)
        if self.poll() is None:
            self.signal_group(signal.SIGKILL)
