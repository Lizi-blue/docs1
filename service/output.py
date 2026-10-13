"""任务输出缓冲（008 对象化）。

对象职责：保存一个任务的输出分片，维护单调序号，处理上限截断，并向订阅者分发事件。
对象边界：不知道任务状态，不知道进程，不知道 HTTP。只做缓冲与分发。

被谁持有：Task 持有唯一实例。
被谁调用：Task.append_output 与 Task.subscribe 委托到本对象。
"""
from __future__ import annotations

import queue
import threading
import time
from collections import deque

TRUNCATION_NOTICE = "\n[输出超过上限，已截断]\n"

# 被哪个对象使用：OutputBuffer
class OutputBuffer:
    """单个任务的输出缓冲。所有公开方法都加锁。"""

    def __init__(self, max_bytes: int) -> None:
        self.max_bytes = max_bytes
        self.bytes_out = 0
        self.lines = 0
        self.truncated = False

        self._lock = threading.RLock()
        self._seq = 0
        self._chunks: deque[dict] = deque()
        self._subscribers: set[queue.Queue] = set()

    @property
    def last_seq(self) -> int:
        with self._lock:
            return self._seq

    def append(self, stream: str, text: str) -> dict | None:
        """追加一段输出。返回新分片；超限时返回 None 并置截断标记。"""
        if not text:
            return None
        raw = text.encode("utf-8", errors="replace")
        subscribers: list[queue.Queue] = []
        with self._lock:
            remaining = self.max_bytes - self.bytes_out
            if remaining <= 0:
                self.truncated = True
                return None
            if len(raw) > remaining:
                raw = raw[:remaining]
                text = raw.decode("utf-8", errors="ignore") + TRUNCATION_NOTICE
                self.truncated = True
            else:
                text = raw.decode("utf-8", errors="replace")
            self.bytes_out += len(raw)
            self.lines += text.count("\n")
            self._seq += 1
            chunk = {"seq": self._seq, "stream": stream, "text": text, "ts": time.time()}
            self._chunks.append(chunk)
            subscribers = list(self._subscribers)
        for subscriber in subscribers:
            subscriber.put({"event": "output", "data": chunk})
        return chunk

    def chunks_since(self, from_seq: int) -> list[dict]:
        with self._lock:
            return [chunk for chunk in self._chunks if chunk["seq"] > from_seq]

    def subscribe(self, from_seq: int = 0) -> tuple[queue.Queue, list[dict]]:
        """返回订阅队列与需要补发的历史块（序号大于 from_seq）。"""
        subscriber: queue.Queue = queue.Queue()
        with self._lock:
            history = [chunk for chunk in self._chunks if chunk["seq"] > from_seq]
            self._subscribers.add(subscriber)
        return subscriber, history

    def unsubscribe(self, subscriber: queue.Queue) -> None:
        with self._lock:
            self._subscribers.discard(subscriber)

    def notify(self, event: str, data: dict) -> None:
        """向所有订阅者推送非输出事件（状态与结束）。"""
        with self._lock:
            subscribers = list(self._subscribers)
        for subscriber in subscribers:
            subscriber.put({"event": event, "data": data})

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "bytes_out": self.bytes_out,
                "lines": self.lines,
                "truncated": self.truncated,
                "last_seq": self._seq,
            }
