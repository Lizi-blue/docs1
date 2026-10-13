"""任务执行器：线程池调度与任务生命周期。

对象关系：Executor 持有 MetricsSampler，并为每个任务创建一个 ChildProcess。
子进程与采样细节在 .process 里，本对象只做调度、状态迁移与终态决定。
"""
from __future__ import annotations

import os
import signal
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from .process import ChildProcess, MetricsSampler, signal_group
from .registry import CANCELED, FAILED, QUEUED, RUNNING, SUCCEEDED, TIMEOUT, Registry, Task

SAMPLE_INTERVAL = 0.25


class Executor:
    """提交即排队，线程池并发受 max_concurrency 限制。"""

    def __init__(self, registry: Registry, limits) -> None:
        self.registry = registry
        self.limits = limits
        self.pool = ThreadPoolExecutor(max_workers=limits.max_concurrency, thread_name_prefix="task")
        # 组合：Executor 持有采样器，任务级子进程由 ChildProcess 承担。
        self._sampler = MetricsSampler()
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
            signal_group(task.pgid, signal.SIGTERM)
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
            child = ChildProcess.spawn(task)
            # 先起进程再置 running：读方看到 running 时 pid 必须已经可用
            task.pid = child.pid
            task.pgid = child.pgid
            task.mark_running()
            pumps = [
                threading.Thread(target=self._pump, args=(task, child.proc.stdout, "stdout"), daemon=True),
                threading.Thread(target=self._pump, args=(task, child.proc.stderr, "stderr"), daemon=True),
            ]
            for pump in pumps:
                pump.start()

            # 先采一次：短命进程在循环开始前就可能退出
            self._sampler.update(task, child.pid)
            deadline = time.monotonic() + task.timeout_s
            while child.poll() is None:
                self._sampler.update(task, child.pid)
                if task.cancel_requested:
                    child.terminate(self._sampler, task)
                    break
                if time.monotonic() > deadline:
                    task.reason = "超时"
                    child.terminate(self._sampler, task)
                    break
                time.sleep(SAMPLE_INTERVAL)

            child.wait()
            for pump in pumps:
                pump.join(timeout=2)
            self._sampler.update(task, child.pid)

            returncode = child.returncode if child.returncode is not None else -1
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
