"""HTTP 服务：任务下发、查询、取消与 SSE 输出流。

路由与状态码见 specs/003-task-dispatch/spec.md FR-001 与 plan.md 的接口表。
只用标准库，避免第三方依赖。
"""
from __future__ import annotations

import json
import os
import queue
import signal
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .executor import Executor
from .limits import Limits, ValidationError
from .registry import Registry, Task

SERVICE_VERSION = "1.0.0"


def build_components(config_path: str | os.PathLike[str] | None = None) -> tuple[Limits, Registry, Executor]:
    limits = Limits(config_path)
    registry = Registry(limits.keep)
    executor = Executor(registry, limits)
    return limits, registry, executor


class TaskHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = f"docs1-task-service/{SERVICE_VERSION}"

    # ---- 工具 ----
    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status: int, message: str) -> None:
        self._send_json(status, {"error": {"status": status, "message": message}})

    def _read_body(self) -> bytes:
        """无论处理器要不要用，都必须把请求体读完，否则 keep-alive 会串包。"""
        if getattr(self, "_body_cache", None) is None:
            length = int(self.headers.get("Content-Length") or 0)
            self._body_cache = self.rfile.read(length) if length > 0 else b""
        return self._body_cache

    def _read_json(self) -> object:
        raw = self._read_body()
        if not raw:
            return {}
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValidationError(f"JSON 解析失败：{error}") from error

    # ---- 路由 ----
    def do_GET(self) -> None:  # noqa: N802 - 标准库命名
        parsed = urlparse(self.path)
        parts = [segment for segment in parsed.path.split("/") if segment]
        if parts[:1] != ["api"]:
            self._send_error_json(404, "未知路径")
            return
        rest = parts[1:]
        if rest == ["health"]:
            self._health()
            return
        if rest == ["tasks"]:
            self._list_tasks(parsed.query)
            return
        if len(rest) == 2 and rest[0] == "tasks":
            self._get_task(rest[1])
            return
        if len(rest) == 3 and rest[0] == "tasks" and rest[2] == "stream":
            self._stream(rest[1], parsed.query)
            return
        self._send_error_json(404, "未知路径")

    def do_POST(self) -> None:  # noqa: N802 - 标准库命名
        self._body_cache = None
        try:
            self._read_body()
        except (BrokenPipeError, ConnectionResetError):
            return
        parsed = urlparse(self.path)
        parts = [segment for segment in parsed.path.split("/") if segment]
        if parts[:1] != ["api"]:
            self._send_error_json(404, "未知路径")
            return
        rest = parts[1:]
        if rest == ["tasks"]:
            self._submit()
            return
        if len(rest) == 3 and rest[0] == "tasks" and rest[2] == "cancel":
            self._cancel(rest[1])
            return
        self._send_error_json(404, "未知路径")

    # ---- 处理实现 ----
    def _health(self) -> None:
        self._send_json(200, {
            "ok": True,
            "service": "docs1-task-service",
            "version": SERVICE_VERSION,
            "running": self.server.registry.running_count(),
            "limits": self.server.limits.public(),
        })

    def _list_tasks(self, query: str) -> None:
        params = parse_qs(query)
        try:
            limit = min(int(params.get("limit", ["50"])[0]), self.server.limits.keep)
        except ValueError:
            limit = self.server.limits.keep
        tasks = [task.summary() for task in self.server.registry.list(limit)]
        self._send_json(200, {"tasks": tasks, "limits": self.server.limits.public()})

    def _get_task(self, task_id: str) -> None:
        task = self.server.registry.get(task_id)
        if task is None:
            self._send_error_json(404, f"任务不存在：{task_id}")
            return
        self._send_json(200, {"task": task.summary(), "metrics": task.metrics()})

    def _submit(self) -> None:
        try:
            payload = self.server.limits.validate_submit(self._read_json())
        except ValidationError as error:
            self._send_error_json(error.status, error.message)
            return
        if not self.server.executor.try_acquire_slot():
            self._send_error_json(429, f"并发已达上限 {self.server.limits.max_concurrency}，请稍后再试")
            return
        task = Task(payload["command"], payload["args"], payload["cwd"], payload["timeout_s"], payload["env"],
                    self.server.limits.output_max_bytes)
        self.server.registry.add(task)
        self.server.executor.submit(task)
        self._send_json(201, task.summary())

    def _cancel(self, task_id: str) -> None:
        task = self.server.registry.get(task_id)
        if task is None:
            self._send_error_json(404, f"任务不存在：{task_id}")
            return
        if not self.server.executor.cancel(task):
            self._send_error_json(409, f"任务已结束，无法取消：{task.status}")
            return
        self._send_json(200, {"id": task.id, "status": task.status, "cancel_requested": True})

    def _stream(self, task_id: str, query: str) -> None:
        task = self.server.registry.get(task_id)
        if task is None:
            self._send_error_json(404, f"任务不存在：{task_id}")
            return
        from_seq = 0
        last_event_id = self.headers.get("Last-Event-ID") or ""
        if last_event_id.isdigit():
            from_seq = int(last_event_id)
        params = parse_qs(query)
        if params.get("from", [""])[0].isdigit():
            from_seq = max(from_seq, int(params["from"][0]))

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        subscriber, history = task.subscribe(from_seq)
        try:
            self._sse("status", None, {"id": task.id, "status": task.status, "from_seq": from_seq})
            for chunk in history:
                self._sse("output", chunk["seq"], chunk)
            if task.finished:
                self._sse("end", None, task._end_payload_locked())
                return
            while True:
                try:
                    item = subscriber.get(timeout=15)
                except queue.Empty:
                    self.wfile.write(b": keep-alive\n\n")
                    self.wfile.flush()
                    continue
                if item["event"] == "end":
                    self._sse("end", None, item["data"])
                    return
                chunk = item["data"]
                self._sse("output", chunk["seq"], chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            task.unsubscribe(subscriber)

    def _sse(self, event: str, seq: int | None, data: dict) -> None:
        lines = []
        if seq is not None:
            lines.append(f"id: {seq}")
        lines.append(f"event: {event}")
        lines.append(f"data: {json.dumps(data, ensure_ascii=False)}")
        payload = ("\n".join(lines) + "\n\n").encode("utf-8")
        self.wfile.write(payload)
        self.wfile.flush()

    def handle_one_request(self) -> None:
        # 客户端提前断开是常态（浏览器切页、curl 超时），不当成服务异常
        try:
            super().handle_one_request()
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True


class TaskServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler, limits: Limits, registry: Registry, executor: Executor) -> None:
        super().__init__(address, handler)
        self.limits = limits
        self.registry = registry
        self.executor = executor


def create_server(host: str = "127.0.0.1", port: int = 8787,
                  config_path: str | os.PathLike[str] | None = None) -> tuple[TaskServer, Limits, Registry, Executor]:
    limits, registry, executor = build_components(config_path)
    server = TaskServer((host, port), TaskHandler, limits, registry, executor)
    return server, limits, registry, executor


def main() -> int:
    host = os.environ.get("DOCS1_HOST", "127.0.0.1")
    port = int(os.environ.get("DOCS1_PORT", "8787"))
    server, limits, _registry, executor = create_server(host, port)
    stop_event = threading.Event()

    def handle_signal(signum, _frame):
        sys.stderr.write(f"[task-service] 收到信号 {signum}，开始退出\n")
        stop_event.set()
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    sys.stderr.write(
        f"[task-service] 监听 http://{host}:{port}，并发上限 {limits.max_concurrency}，"
        f"工作区 {limits.workspace}\n"
    )
    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        executor.shutdown(cancel_running=True)
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
