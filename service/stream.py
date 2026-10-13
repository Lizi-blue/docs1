"""SSE 订阅（008 对象化）。

对象：StreamHub —— 管理订阅生命周期、游标解析与心跳判定。
对象边界：只管订阅与取事件，不管 HTTP 报文与 socket 写入，那属于 TaskHandler。
被谁持有：TaskServer 持有唯一实例；每次 SSE 请求向它订阅一次。
"""
from __future__ import annotations

import queue
from urllib.parse import parse_qs


class StreamHub:
    """订阅入口。订阅者来自 OutputBuffer，本对象只做生命周期与节奏。"""

    def __init__(self, keepalive_seconds: float = 15.0) -> None:
        self.keepalive_seconds = keepalive_seconds

    def resolve_cursor(self, last_event_id: str | None, query: str) -> int:
        """按 Last-Event-ID 与 ?from= 求起始序号，取较大者。"""
        from_seq = 0
        if last_event_id and last_event_id.isdigit():
            from_seq = int(last_event_id)
        params = parse_qs(query)
        raw = (params.get("from") or [""])[0]
        if raw.isdigit():
            from_seq = max(from_seq, int(raw))
        return from_seq

    def open(self, task, from_seq: int = 0) -> tuple[queue.Queue, list[dict]]:
        """订阅任务输出，返回订阅队列与需要补发的历史块。"""
        return task.subscribe(from_seq)

    def close(self, task, subscriber: queue.Queue) -> None:
        task.unsubscribe(subscriber)

    def next_event(self, subscriber: queue.Queue) -> dict | None:
        """取下一个事件。超时返回 None，由调用方发心跳帧。"""
        try:
            return subscriber.get(timeout=self.keepalive_seconds)
        except queue.Empty:
            return None
