"""003 任务服务用例：真起服务、真跑子进程、真读 SSE（T013 / FR-014）。

覆盖八类判据：
  1. 白名单：非白名单命令返回 400。
  2. 参数校验：shell 元字符与控制字符返回 400。
  3. 并发上限：超过 max_concurrency 的提交返回 429。
  4. 状态机单向：queued → running → 终态，终态不再迁移；取消已结束任务返回 409。
  5. 取消：向进程组发信号，3 秒内置 canceled，且进程组无残留。
  6. 超时：timeout_s 到点置 timeout，指标完整。
  7. 输出截断：达到输出上限即截断并标记 truncated。
  8. SSE 续传：用 Last-Event-ID 重连，序号从 N+1 起且连续。
  另加 GET /api/health 的 200 与 limits 断言。

做法：用 service.app.create_server(port=0) 起真实 HTTP 服务（随机端口），
用标准库 http.client 发请求，SSE 用裸 socket 读事件流。
限额用 env（DOCS1_*）注入，避免改 service/ 源码。

运行：python3 -m pytest tests/test_task_service.py -q
"""
from __future__ import annotations

import http.client
import json
import os
import pathlib
import socket
import sys
import threading
import time

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

if not (REPO_ROOT / "service").is_dir():
    pytest.skip("service/ 尚未落地，等 T001–T004 完成后再跑", allow_module_level=True)

from service import app as task_app  # noqa: E402

TERMINAL = {"succeeded", "failed", "canceled", "timeout"}
METACHARS = [";", "|", "&", "$", ">", "<", "`", "(", ")", "{", "}", "[", "]", "*", "?", "!", "~", "'", '"', "\\"]
CONTROL_CHARS = ["\x00", "\x01", "\x1f", "\x7f", "\n", "\r", "\t"]


# ---------------------------------------------------------------- HTTP 工具

def request(port: int, method: str, path: str, body: object | None = None,
            headers: dict[str, str] | None = None, timeout: float = 10.0) -> tuple[int, object]:
    """发一次请求，返回状态码与解析后的响应体。"""
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=timeout)
    payload = None if body is None else json.dumps(body).encode("utf-8")
    sent = {"Content-Type": "application/json"} if payload is not None else {}
    sent.update(headers or {})
    try:
        conn.request(method, path, body=payload, headers=sent)
        response = conn.getresponse()
        raw = response.read()
        try:
            return response.status, json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return response.status, raw.decode("utf-8", errors="replace")
    finally:
        conn.close()


def parse_event(block: str) -> dict | None:
    """解析一个 SSE 事件块。只有注释时返回 None。"""
    event: dict = {"event": None, "id": None, "data": None}
    for line in block.split("\n"):
        line = line.rstrip("\r")
        if not line or line.startswith(":"):
            continue
        field, _, value = line.partition(":")
        value = value.lstrip(" ")
        if field == "id" and value.isdigit():
            event["id"] = int(value)
        elif field == "event":
            event["event"] = value
        elif field == "data":
            try:
                event["data"] = json.loads(value)
            except json.JSONDecodeError:
                event["data"] = value
    if event["event"] is None and event["data"] is None:
        return None
    return event


def read_sse(port: int, path: str, last_event_id: int | None = None,
             want_output: int = 1, deadline: float = 15.0) -> tuple[list[dict], bool]:
    """读 SSE 直到攒够 want_output 条 output 事件或收到 end。"""
    sock = socket.create_connection(("127.0.0.1", port), timeout=deadline)
    lines = [
        f"GET {path} HTTP/1.1",
        f"Host: 127.0.0.1:{port}",
        "Accept: text/event-stream",
        "Cache-Control: no-cache",
    ]
    if last_event_id is not None:
        lines.append(f"Last-Event-ID: {last_event_id}")
    sock.sendall(("\r\n".join(lines) + "\r\n\r\n").encode("utf-8"))

    events: list[dict] = []
    buffer = b""
    ended = False
    body_started = False
    stop_at = time.monotonic() + deadline
    try:
        while time.monotonic() < stop_at:
            sock.settimeout(max(0.1, min(2.0, stop_at - time.monotonic())))
            try:
                data = sock.recv(65536)
            except socket.timeout:
                continue
            if not data:
                break
            buffer += data
            if not body_started:
                marker = buffer.find(b"\r\n\r\n")
                if marker < 0:
                    continue
                buffer = buffer[marker + 4:]
                body_started = True
            while b"\n\n" in buffer:
                raw_block, buffer = buffer.split(b"\n\n", 1)
                event = parse_event(raw_block.decode("utf-8", errors="replace"))
                if event is None:
                    continue
                events.append(event)
                if event["event"] == "end":
                    ended = True
                outputs = sum(1 for item in events if item["event"] == "output")
                if outputs >= want_output:
                    return events, ended
            if ended:
                break
    finally:
        sock.close()
    return events, ended


def group_alive(pgid: int) -> bool:
    """进程组里还有活进程就返回真。"""
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


# ---------------------------------------------------------------- 服务夹具

class Service:
    """真实 HTTP 服务 + 句柄。"""

    def __init__(self) -> None:
        self.server, self.limits, self.registry, self.executor = task_app.create_server(port=0)
        self.port = int(self.server.server_address[1])
        self.thread = threading.Thread(
            target=self.server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True
        )
        self.thread.start()

    # ---- 请求 ----
    def submit(self, command: str, args: list[str] | None = None, **extra: object) -> tuple[int, object]:
        payload = {"command": command, "args": args or []}
        payload.update(extra)
        return request(self.port, "POST", "/api/tasks", payload)

    def get(self, task_id: str) -> tuple[int, object]:
        return request(self.port, "GET", f"/api/tasks/{task_id}")

    def cancel(self, task_id: str) -> tuple[int, object]:
        # 取消不带请求体：契约里 cancel 只带路径参数。
        return request(self.port, "POST", f"/api/tasks/{task_id}/cancel")

    # ---- 等待 ----
    def wait_status(self, task_id: str, wanted: set[str], timeout: float = 10.0) -> dict:
        stop_at = time.monotonic() + timeout
        last: dict | None = None
        while time.monotonic() < stop_at:
            code, data = self.get(task_id)
            assert code == 200, data
            last = data["task"]
            if last["status"] in wanted:
                return last
            time.sleep(0.05)
        raise AssertionError(f"等待状态 {sorted(wanted)} 超时，最后是 {last}")

    def wait_terminal(self, task_id: str, timeout: float = 15.0) -> dict:
        return self.wait_status(task_id, TERMINAL, timeout=timeout)

    # ---- 清理 ----
    def stop(self) -> None:
        try:
            self.server.shutdown()
            self.server.server_close()
        except OSError:
            pass
        try:
            self.executor.shutdown(cancel_running=True)
        except Exception:  # noqa: BLE001 - 清理阶段不再抛错
            pass
        self.thread.join(timeout=5)


@pytest.fixture()
def start_service(tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch):
    """起服务工厂。每个实例用独立工作区，测试结束统一清理。"""
    started: list[Service] = []

    def _start(**env: object) -> Service:
        values = {"DOCS1_WORKSPACE": str(tmp_path / "workspace")}
        values.update(env)
        for key, value in values.items():
            monkeypatch.setenv(key, str(value))
        service = Service()
        started.append(service)
        return service

    yield _start
    for service in reversed(started):
        service.stop()


# ---------------------------------------------------------------- 1 健康检查

def test_health_reports_limits(start_service) -> None:
    service = start_service(DOCS1_MAX_CONCURRENCY="3")
    code, data = request(service.port, "GET", "/api/health")
    assert code == 200
    assert data["ok"] is True
    assert data["version"]
    assert data["running"] == 0
    limits = data["limits"]
    assert limits["max_concurrency"] == 3
    assert limits["timeout_max_s"] >= 1
    assert limits["output_max_bytes"] >= 1
    assert limits["keep"] >= 1
    assert any(item["name"] == "cp" for item in limits["allowlist"])


# ---------------------------------------------------------------- 2 白名单与参数

@pytest.mark.parametrize("command", ["rm", "sh", "bash", "/bin/ls", "curl", "python3"])
def test_non_allowlisted_command_returns_400(start_service, command: str) -> None:
    service = start_service()
    code, data = service.submit(command, ["-rf", "tmp"])
    assert code == 400, data
    assert "白名单" in data["error"]["message"]


@pytest.mark.parametrize("char", METACHARS)
def test_shell_metacharacter_returns_400(start_service, char: str) -> None:
    service = start_service()
    code, data = service.submit("echo", [f"a{char}b"])
    assert code == 400, data
    assert data["error"]["status"] == 400


@pytest.mark.parametrize("char", CONTROL_CHARS)
def test_control_character_returns_400(start_service, char: str) -> None:
    service = start_service()
    code, data = service.submit("echo", [f"a{char}b"])
    assert code == 400, data
    assert "控制字符" in data["error"]["message"]


def test_cwd_outside_workspace_returns_400(start_service) -> None:
    service = start_service()
    for cwd in ("/etc", "../..", "../../etc"):
        code, data = service.submit("ls", [], cwd=cwd)
        assert code == 400, (cwd, data)
    code, data = service.submit("ls", [], cwd="no-such-dir")
    assert code == 400, data


def test_valid_echo_task_succeeds_and_streams_output(start_service) -> None:
    service = start_service()
    code, task = service.submit("echo", ["hello-docs1"])
    assert code == 201, task
    assert task["status"] in {"queued", "running"}

    summary = service.wait_terminal(task["id"], timeout=10)
    assert summary["status"] == "succeeded"
    assert summary["exit_code"] == 0
    assert summary["metrics"]["bytes_out"] >= len("hello-docs1")
    assert summary["metrics"]["duration_s"] is not None

    events, _ended = read_sse(service.port, f"/api/tasks/{task['id']}/stream", want_output=1, deadline=10)
    outputs = [item for item in events if item["event"] == "output"]
    assert outputs, events
    assert "hello-docs1" in outputs[0]["data"]["text"]


# ---------------------------------------------------------------- 3 并发上限

def test_concurrency_limit_returns_429(start_service) -> None:
    service = start_service(DOCS1_MAX_CONCURRENCY="2")
    codes = []
    created = []
    for _ in range(3):
        code, data = service.submit("sleep", ["20"])
        codes.append(code)
        if code == 201:
            created.append(data["id"])
    assert codes[:2] == [201, 201], codes
    assert codes[2] == 429, codes
    for task_id in created:
        service.cancel(task_id)


# ---------------------------------------------------------------- 4 状态机

def test_status_machine_moves_one_way_only(start_service) -> None:
    service = start_service()
    code, task = service.submit("sleep", ["2"])
    assert code == 201, task

    seen: list[str] = []
    stop_at = time.monotonic() + 15
    while time.monotonic() < stop_at:
        code, data = service.get(task["id"])
        assert code == 200, data
        status = data["task"]["status"]
        if not seen or seen[-1] != status:
            seen.append(status)
        if status in TERMINAL:
            break
        time.sleep(0.05)

    assert seen[-1] in TERMINAL, seen
    for index in range(1, len(seen)):
        previous, current = seen[index - 1], seen[index]
        assert previous not in TERMINAL, f"终态后又迁移：{seen}"
        if previous == "queued":
            assert current in {"running", "canceled"}, seen
        else:
            assert current in TERMINAL, seen

    for _ in range(3):
        code, data = service.get(task["id"])
        assert code == 200, data
        assert data["task"]["status"] == seen[-1]


def test_cancel_finished_task_returns_409(start_service) -> None:
    service = start_service()
    code, task = service.submit("echo", ["done"])
    assert code == 201, task
    service.wait_terminal(task["id"], timeout=10)

    code, data = service.cancel(task["id"])
    assert code == 409, data
    assert "已结束" in data["error"]["message"]


# ---------------------------------------------------------------- 5 取消与进程组

def test_cancel_kills_process_group_without_residue(start_service) -> None:
    service = start_service()
    code, task = service.submit("sleep", ["23"])
    assert code == 201, task

    running = service.wait_status(task["id"], {"running"}, timeout=10)
    # running 先于子进程创建可见，故这里再等 pid 落位。
    stop_at = time.monotonic() + 5
    while running.get("pid") is None and time.monotonic() < stop_at:
        time.sleep(0.02)
        code, data = service.get(task["id"])
        assert code == 200, data
        running = data["task"]
    pid = running["pid"]
    assert isinstance(pid, int) and pid > 0, running
    pgid = os.getpgid(pid)
    assert pgid == pid, "任务子进程必须自建进程组"

    code, data = service.cancel(task["id"])
    assert code == 200, data
    summary = service.wait_terminal(task["id"], timeout=3)
    assert summary["status"] == "canceled", summary

    stop_at = time.monotonic() + 3
    while group_alive(pgid) and time.monotonic() < stop_at:
        time.sleep(0.05)
    with pytest.raises(ProcessLookupError):
        os.killpg(pgid, 0)
    with pytest.raises(ProcessLookupError):
        os.getpgid(pid)


# ---------------------------------------------------------------- 6 超时

def test_timeout_marks_timeout_with_metrics(start_service) -> None:
    service = start_service()
    code, task = service.submit("sleep", ["10"], timeout_s=1)
    assert code == 201, task

    summary = service.wait_terminal(task["id"], timeout=15)
    assert summary["status"] == "timeout", summary
    metrics = summary["metrics"]
    assert metrics["duration_s"] is not None and metrics["duration_s"] >= 1
    assert isinstance(metrics["bytes_out"], int)
    assert isinstance(metrics["lines"], int)
    assert summary["exit_code"] is not None or summary["signal"] is not None, summary


# ---------------------------------------------------------------- 7 输出截断

def test_output_truncation_sets_flag(start_service) -> None:
    service = start_service(DOCS1_OUTPUT_MAX_BYTES="4096")
    code, task = service.submit("dd", ["if=/dev/zero", "bs=4096", "count=8"])
    assert code == 201, task

    summary = service.wait_terminal(task["id"], timeout=15)
    assert summary["status"] == "succeeded", summary
    assert summary["metrics"]["truncated"] is True
    assert summary["metrics"]["bytes_out"] == 4096


# ---------------------------------------------------------------- 8 SSE 续传

def test_sse_resume_continues_after_last_event_id(start_service) -> None:
    service = start_service()
    code, task = service.submit("dd", ["if=/dev/zero", "bs=65536", "count=8"])
    assert code == 201, task
    path = f"/api/tasks/{task['id']}/stream"

    first, _ended = read_sse(service.port, path, want_output=3, deadline=15)
    outputs = [item for item in first if item["event"] == "output"]
    assert len(outputs) >= 3, first
    assert [item["id"] for item in outputs[:3]] == [1, 2, 3], outputs
    last_id = outputs[2]["id"]

    resumed, _ended = read_sse(service.port, path, last_event_id=last_id, want_output=3, deadline=15)
    again = [item for item in resumed if item["event"] == "output"]
    assert again, resumed
    assert again[0]["id"] == last_id + 1, again
    sequence = [item["id"] for item in again]
    assert sequence == list(range(last_id + 1, last_id + 1 + len(sequence))), sequence


# ------------------------------------------------- 已回报 Lead 的服务端缺陷

def test_cancel_with_body_keeps_connection_usable(start_service) -> None:
    """带体的 cancel 之后，同一连接的下一个请求仍应是 200。

    回归背景：早期实现里 `_cancel` 不读请求体，残留的 `{}` 被当成下一行请求，
    下一个请求会收到 501。服务端已改为所有 POST 先读完请求体。
    注意：复用连接前必须先读掉上一个响应体，否则客户端自己会抛 ResponseNotReady。
    """
    service = start_service()
    code, task = service.submit("sleep", ["20"])
    assert code == 201, task

    conn = http.client.HTTPConnection("127.0.0.1", service.port, timeout=5)
    try:
        conn.request("POST", f"/api/tasks/{task['id']}/cancel", body=b"{}",
                     headers={"Content-Type": "application/json"})
        cancel_response = conn.getresponse()
        cancel_body = cancel_response.read()
        assert cancel_response.status == 200, cancel_body

        conn.request("GET", "/api/health")
        health_response = conn.getresponse()
        health_body = health_response.read()
        assert health_response.status == 200, health_body
        assert b'"ok": true' in health_body
    finally:
        conn.close()

