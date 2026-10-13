"""任务注册表：状态机、输出缓冲与订阅分发。

状态机单向：queued → running → 终态。终态不可再迁移（spec FR-004）。
输出按块保存并分发给订阅者，序号单调递增，供 SSE 续传使用（FR-005）。
"""
from __future__ import annotations

import queue
import threading
import time

from .output import OutputBuffer
import uuid
from collections import deque

QUEUED = "queued"
RUNNING = "running"
SUCCEEDED = "succeeded"
FAILED = "failed"
CANCELED = "canceled"
TIMEOUT = "timeout"

TERMINAL = {SUCCEEDED, FAILED, CANCELED, TIMEOUT}
TRANSITIONS = {
    QUEUED: {RUNNING, CANCELED},
    RUNNING: {SUCCEEDED, FAILED, CANCELED, TIMEOUT},
    SUCCEEDED: set(),
    FAILED: set(),
    CANCELED: set(),
    TIMEOUT: set(),
}


class Task:
    """单个任务的状态、指标与输出缓冲。所有公开方法都加锁。"""

    def __init__(self, command: str, args: list[str], cwd: str, timeout_s: float, env: dict[str, str],
                 output_max_bytes: int) -> None:
        self.id = uuid.uuid4().hex[:12]
        self.command = command
        self.args = list(args)
        self.cwd = cwd
        self.timeout_s = timeout_s
        self.env = dict(env)
        self._output = OutputBuffer(output_max_bytes)

        self.status = QUEUED
        self.reason: str | None = None
        self.created_at = time.time()
        self.started_at: float | None = None
        self.finished_at: float | None = None
        self.exit_code: int | None = None
        self.signal: int | None = None
        self.pid: int | None = None
        self.pgid: int | None = None
        self.cancel_requested = False

        self.cpu_s = 0.0
        self.max_rss_kb = 0

        # 可重入：summary() 会在持锁期间取 metrics()
        self._lock = threading.RLock()
        self._finished = threading.Event()

    # ---- 状态 ----
    def transition(self, new_status: str) -> bool:
        with self._lock:
            if new_status in TRANSITIONS[self.status]:
                self.status = new_status
                return True
            return False

    def mark_running(self) -> None:
        if not self.transition(RUNNING):
            raise RuntimeError(f"任务 {self.id} 无法进入 running：当前 {self.status}")
        with self._lock:
            self.started_at = time.time()

    def finish(self, status: str, exit_code: int | None, signal: int | None, reason: str | None = None) -> None:
        with self._lock:
            self.status = status
            self.exit_code = exit_code
            self.signal = signal
            if reason:
                self.reason = reason
            self.finished_at = time.time()
            payload = self._end_payload_locked()
        # 通知交给 OutputBuffer：订阅者集合由它持有。
        self._output.notify("end", payload)
        self._finished.set()

    def wait_finished(self, timeout: float | None = None) -> bool:
        return self._finished.wait(timeout)

    @property
    def finished(self) -> bool:
        return self.status in TERMINAL

    # ---- 输出（委托给 OutputBuffer）----
    @property
    def output_max_bytes(self) -> int:
        return self._output.max_bytes

    @property
    def truncated(self) -> bool:
        return self._output.truncated

    @property
    def bytes_out(self) -> int:
        return self._output.bytes_out

    @property
    def lines(self) -> int:
        return self._output.lines

    def append_output(self, stream: str, text: str) -> None:
        self._output.append(stream, text)

    def subscribe(self, from_seq: int = 0) -> tuple[queue.Queue, list[dict]]:
        return self._output.subscribe(from_seq)

    def unsubscribe(self, subscriber: queue.Queue) -> None:
        self._output.unsubscribe(subscriber)

    def update_usage(self, cpu_s: float | None = None, max_rss_kb: int | None = None) -> None:
        with self._lock:
            if cpu_s is not None:
                self.cpu_s = max(self.cpu_s, cpu_s)
            if max_rss_kb is not None:
                self.max_rss_kb = max(self.max_rss_kb, max_rss_kb)

    # ---- 快照 ----
    def metrics(self) -> dict:
        with self._lock:
            duration = None
            if self.started_at:
                end = self.finished_at or time.time()
                duration = round(end - self.started_at, 3)
            return {
                "duration_s": duration,
                "cpu_s": round(self.cpu_s, 3),
                "max_rss_kb": self.max_rss_kb,
                "bytes_out": self.bytes_out,
                "lines": self.lines,
                "truncated": self.truncated,
            }

    def summary(self) -> dict:
        with self._lock:
            return {
                "id": self.id,
                "command": self.command,
                "args": list(self.args),
                "cwd": self.cwd,
                "status": self.status,
                "reason": self.reason,
                "created_at": self.created_at,
                "started_at": self.started_at,
                "finished_at": self.finished_at,
                "exit_code": self.exit_code,
                "signal": self.signal,
                "pid": self.pid,
                "timeout_s": self.timeout_s,
                "metrics": self.metrics(),
            }

    def _end_payload_locked(self) -> dict:
        end = self.finished_at or time.time()
        start = self.started_at or self.created_at
        return {
            "id": self.id,
            "status": self.status,
            "reason": self.reason,
            "exit_code": self.exit_code,
            "signal": self.signal,
            "metrics": {
                "duration_s": round(end - start, 3),
                "cpu_s": round(self.cpu_s, 3),
                "max_rss_kb": self.max_rss_kb,
                "bytes_out": self.bytes_out,
                "lines": self.lines,
                "truncated": self.truncated,
            },
        }


class Registry:
    """任务集合与保留策略。超出保留数时先淘汰最早的终态任务。"""

    def __init__(self, keep: int) -> None:
        self.keep = keep
        # 可重入：summary() 会在持锁期间取 metrics()
        self._lock = threading.RLock()
        self._tasks: dict[str, Task] = {}
        self._order: deque[str] = deque()

    def add(self, task: Task) -> Task:
        with self._lock:
            self._tasks[task.id] = task
            self._order.append(task.id)
            self._evict_locked()
        return task

    def get(self, task_id: str) -> Task | None:
        with self._lock:
            return self._tasks.get(task_id)

    def list(self, limit: int = 50) -> list[Task]:
        with self._lock:
            ids = list(self._order)[-limit:]
        tasks = [self._tasks[task_id] for task_id in reversed(ids) if task_id in self._tasks]
        return tasks

    def running_count(self) -> int:
        with self._lock:
            return sum(1 for task in self._tasks.values() if task.status in (QUEUED, RUNNING))

    def _evict_locked(self) -> None:
        while len(self._order) > self.keep:
            for index, task_id in enumerate(self._order):
                task = self._tasks.get(task_id)
                if task is not None and task.finished:
                    self._order.remove(task_id)
                    self._tasks.pop(task_id, None)
                    break
            else:
                return
