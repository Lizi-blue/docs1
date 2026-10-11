"""任务执行器：线程池调度、子进程管理与指标采样。

每个任务一个子进程，子进程自建进程组（start_new_session），
于是取消与超时都能对整组生效（spec FR-003/FR-006）。
监控样本来自 /proc，指标口径见 FR-007。
"""
from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from .registry import CANCELED, FAILED, QUEUED, RUNNING, SUCCEEDED, TIMEOUT, Registry, Task

GRACE_SECONDS = 3.0
SAMPLE_INTERVAL = 0.25
CLOCK_TICKS = os.sysconf("SC_CLK_TCK")
SAFE_ENV_KEYS = ("PATH", "HOME", "LANG", "LC_ALL", "TZ")


def sample_process(pid: int) -> tuple[float | None, int | None]:
    """读取 CPU 时间与峰值常驻内存。进程已退出时返回 (None, None)。"""
    cpu_s: float | None = None
    max_rss_kb: int | None = None
    try:
        stat = open(f"/proc/{pid}/stat", encoding="utf-8").read()
        tail = stat.rsplit(")", 1)[1].split()
        utime, stime = float(tail[11]), float(tail[12])
        cpu_s = (utime + stime) / CLOCK_TICKS
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


class Executor:
    """提交即排队，线程池并发受 max_concurrency 限制。"""

    def __init__(self, registry: Registry, limits) -> None:
        self.registry = registry
        self.limits = limits
        self.pool = ThreadPoolExecutor(max_workers=limits.max_concurrency, thread_name_prefix="task")
        self._lock = threading.Lock()
        self._slots = 0

    # ---- 并发配额 ----
    def try_acquire_slot(self) -> bool:
        with self._lock:
            if self._slots >= self.limits.max_concurrency:
                return False
            self._slots += 1
            return True

    def release_slot(self) -> None:
        with self._lock:
            self._slots = max(0, self._slots - 1)

    # ---- 生命周期 ----
    def submit(self, task: Task) -> None:
        self.pool.submit(self._run, task)

    def cancel(self, task: Task) -> bool:
        """请求取消。已结束返回 False；否则向进程组发 SIGTERM。"""
        if task.finished:
            return False
        task.cancel_requested = True
        if task.status == RUNNING and task.pgid:
            self._signal_group(task.pgid, signal.SIGTERM)
        return True

    def shutdown(self, cancel_running: bool = True) -> None:
        if cancel_running:
            for task in self.registry.list(self.limits.keep):
                if task.status in (QUEUED, RUNNING):
                    self.cancel(task)
        self.pool.shutdown(wait=False, cancel_futures=True)

    # ---- 内部 ----
    def _run(self, task: Task) -> None:
        try:
            if task.cancel_requested:
                task.finish(CANCELED, None, None, "提交后立即取消")
                return
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
            # 先起进程再置 running：读方看到 running 时 pid 必须已经可用
            task.pid = proc.pid
            task.pgid = os.getpgid(proc.pid)
            task.mark_running()
            pumps = [
                threading.Thread(target=self._pump, args=(task, proc.stdout, "stdout"), daemon=True),
                threading.Thread(target=self._pump, args=(task, proc.stderr, "stderr"), daemon=True),
            ]
            for pump in pumps:
                pump.start()

            # 先采一次：短命进程在循环开始前就可能退出
            task.update_usage(*sample_process(proc.pid))
            deadline = time.monotonic() + task.timeout_s
            while proc.poll() is None:
                cpu_s, max_rss_kb = sample_process(proc.pid)
                task.update_usage(cpu_s, max_rss_kb)
                if task.cancel_requested:
                    self._terminate(task, proc)
                    break
                if time.monotonic() > deadline:
                    task.reason = "超时"
                    self._terminate(task, proc)
                    break
                time.sleep(SAMPLE_INTERVAL)

            proc.wait()
            for pump in pumps:
                pump.join(timeout=2)
            cpu_s, max_rss_kb = sample_process(proc.pid)
            task.update_usage(cpu_s, max_rss_kb)

            returncode = proc.returncode if proc.returncode is not None else -1
            exit_code = returncode if returncode >= 0 else None
            signum = -returncode if returncode < 0 else None
            if task.reason == "超时":
                status, reason = TIMEOUT, "超时"
            elif task.cancel_requested:
                status, reason = CANCELED, task.reason or "用户取消"
            elif returncode == 0:
                status, reason = SUCCEEDED, None
            else:
                status, reason = FAILED, task.reason or f"退出码 {returncode}"
            task.finish(status, exit_code, signum, reason)
        except Exception as error:  # 兜底：异常也要落终态，避免任务永久挂起
            task.finish(FAILED, None, None, f"执行器异常：{error}")
        finally:
            self.release_slot()

    def _pump(self, task: Task, stream, name: str) -> None:
        if stream is None:
            return
        try:
            while True:
                chunk = os.read(stream.fileno(), 65536)
                if not chunk:
                    break
                task.append_output(name, chunk.decode("utf-8", errors="replace"))
        except (OSError, ValueError):
            pass
        finally:
            try:
                stream.close()
            except OSError:
                pass

    def _signal_group(self, pgid: int, signum: int) -> None:
        try:
            os.killpg(pgid, signum)
        except ProcessLookupError:
            pass
        except PermissionError:
            pass

    def _terminate(self, task: Task, proc: subprocess.Popen) -> None:
        """先 SIGTERM，宽限期内不退再 SIGKILL。"""
        if not task.pgid:
            return
        self._signal_group(task.pgid, signal.SIGTERM)
        deadline = time.monotonic() + GRACE_SECONDS
        while proc.poll() is None and time.monotonic() < deadline:
            cpu_s, max_rss_kb = sample_process(proc.pid)
            task.update_usage(cpu_s, max_rss_kb)
            time.sleep(SAMPLE_INTERVAL / 2)
        if proc.poll() is None:
            self._signal_group(task.pgid, signal.SIGKILL)
