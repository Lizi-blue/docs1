---
title: "任务控制台 · 后端任务服务"
type: component
domain: backend
direction: backend
component_type: framework
order: 3
install_command: "无需安装。复制 service/ 目录后运行 python3 -m service.app"
knowledge_index:
  - page: /backend/learn/concurrency/executor-pools
    role: "线程池调度与任务状态迁移的判据来源"
  - page: /backend/learn/concurrency/subprocess-signals
    role: "每任务一个子进程，取消按进程组发信号"
  - page: /backend/learn/concurrency/sync-primitives
    role: "注册表与输出缓冲的加锁边界"
  - page: /backend/learn/communication/socket-and-streams
    role: "SSE 长连接与分片推送的流式语义"
reuse_manifest: reuse/task-console/manifest.json
cross_link: /frontend/components/task-console
related_components:
  - /backend/components/safe-queue
tags_index: [sse, subprocess, thread-pool, task-service]
reusability: high
description: "Python 标准库任务服务：进程组取消、限额与 SSE 推送"
---

# 任务控制台 · 后端任务服务

## 组件简介

后端任务服务：接收下发请求，用线程池调度子进程，把输出推给读方。

它解决三件事：命令与参数的校验、进程组取消、输出与指标的实时推送。

任务与输出只放在内存。服务重启即清空。

本页只讲服务端实现。浏览器交互见下一节的对端页面。

## 对应另一端

交互、日志面板与错误提示由 [前端任务控制台](/frontend/components/task-console) 承担。

本页的服务端只提供接口与推送。

## 依赖的知识域与知识点

<KnowledgeIndex />

## 对象模型

后端任务服务由七个对象组成。它们与三个继承类一起构成整体。

| 对象 | 职责 | 状态 | 生命周期 |
|---|---|---|---|
| `Allowlist` | 命令白名单与参数校验 | 允许的命令集合 | 进程启动时读配置创建 |
| `TaskRegistry` | 任务登记、查询与淘汰 | 任务表与顺序队列 | 进程级唯一 |
| `OutputBuffer` | 输出分片、序号与截断 | 分片队列、序号、订阅者 | 随任务创建与销毁 |
| `StreamHub` | 订阅生命周期、游标与心跳节奏 | 心跳间隔 | 进程级唯一，挂在服务器上 |
| `Executor` | 线程池调度与并发名额 | 线程池、已占名额 | 进程启动时创建 |
| `ChildProcess` | 一个任务的子进程与进程组 | pid、pgid | 任务开始时创建，收尾时回收 |
| `MetricsSampler` | 读取 /proc 采样 | 时钟频率 | 随 `Executor` 创建 |

另有 `Task` 承载单个任务的状态机与指标，由 `TaskRegistry` 保存。



每个对象单独一节。四块固定：职责、持有、方法、边界。另加两列调用关系。

### Allowlist

源码位置：`service/limits.py`。

| 项 | 内容 |
|---|---|
| 职责 | 判断命令是否放行，校验参数与环境 |
| 持有 | 白名单条目、env 键列表、参数个数与长度上限 |
| 方法 | `validate_command(payload)`、`validate_args(raw)`、`validate_env(raw)`、`names()`、`get(name)` |
| 边界 | 不管并发、超时与工作区 |
| 谁调用它 | `Limits.validate_submit` |
| 它调用谁 | 无（纯校验） |

### TaskRegistry

源码位置：`service/registry.py`。

| 项 | 内容 |
|---|---|
| 职责 | 保存任务、提供查询与按保留数淘汰 |
| 持有 | 任务字典与顺序队列 |
| 方法 | `add(task)`、`get(task_id)`、`list(limit)`、`running_count()` |
| 边界 | 不做调度，不碰子进程，不做输出分发 |
| 谁调用它 | `Executor.submit`、`TaskHandler._list_tasks` |
| 它调用谁 | 保存 `Task` |

### OutputBuffer

源码位置：`service/output.py`。

| 项 | 内容 |
|---|---|
| 职责 | 保存输出分片、维护序号、处理上限截断并分发事件 |
| 持有 | 分片队列、序号、订阅者集合、字节数与行数 |
| 方法 | `append(stream, text)`、`subscribe(from_seq)`、`unsubscribe(q)`、`notify(event, data)`、`snapshot()` |
| 边界 | 不知道任务状态，不知道进程，不知道 HTTP |
| 谁调用它 | `Task.append_output`、`Executor` 启动的管道读取线程 |
| 它调用谁 | 推给订阅队列 |

### StreamHub

源码位置：`service/stream.py`。

| 项 | 内容 |
|---|---|
| 职责 | 管理订阅生命周期、解析游标、决定心跳节奏 |
| 持有 | 心跳间隔 |
| 方法 | `resolve_cursor(last_event_id, query)`、`open(task, from_seq)`、`close(task, q)`、`next_event(q)` |
| 边界 | 不写 HTTP 报文，不碰 socket |
| 谁调用它 | `TaskHandler._stream` |
| 它调用谁 | `Task.subscribe` 与 `Task.unsubscribe` |

### Executor

源码位置：`service/executor.py`。

| 项 | 内容 |
|---|---|
| 职责 | 线程池调度与并发名额 |
| 持有 | 线程池、已占名额、采样器 |
| 方法 | `try_acquire_slot()`、`release_slot()`、`submit(task)`、`cancel(task)`、`shutdown(cancel_running)` |
| 边界 | 不做参数校验，不写输出 |
| 谁调用它 | `TaskHandler._submit`、`TaskHandler._cancel` |
| 它调用谁 | `ChildProcess.spawn`、`MetricsSampler.update`、`Task.finish` |

### ChildProcess

源码位置：`service/process.py`。

| 项 | 内容 |
|---|---|
| 职责 | 承载一个任务的子进程与进程组，负责终止 |
| 持有 | 子进程句柄、pid、pgid |
| 方法 | `spawn(task)`、`poll()`、`wait()`、`signal_group(signum)`、`terminate(sampler, task)` |
| 边界 | 不决定任务终态 |
| 谁调用它 | `Executor._run` |
| 它调用谁 | `Task`（回调输出） |

### MetricsSampler

源码位置：`service/process.py`。

| 项 | 内容 |
|---|---|
| 职责 | 读取 /proc，采样 CPU 时间与峰值常驻内存 |
| 持有 | 时钟频率 |
| 方法 | `sample(pid)`、`update(task, pid)` |
| 边界 | 不决定任务终态，不做超时判断 |
| 谁调用它 | `Executor._run` 与 `ChildProcess.terminate` |
| 它调用谁 | `Task.update_usage` |

## 对象层级

本组件有三组真实继承。其余关系是持有。

### 继承

| 子类 | 父类 | 扩展或覆盖 |
|---|---|---|
| `TaskHandler` | `BaseHTTPRequestHandler` | 覆盖 `do_GET` 与 `do_POST`，加 SSE 分支 |
| `TaskServer` | `ThreadingHTTPServer` | 覆盖 `__init__`，注入限额、注册表与调度器 |
| `ValidationError` | `ValueError` | 加 `status` 字段，携带 HTTP 状态码 |

### 组合（持有）

| 持有者 | 被持有者 | 用途 |
|---|---|---|
| `TaskServer` | `Limits`、`TaskRegistry`、`Executor`、`StreamHub` | 请求处理时按需取用 |
| `Limits` | `Allowlist` | 校验下发请求 |
| `Task` | `OutputBuffer` | 输出分片与订阅 |
| `Executor` | `MetricsSampler` | 采样任务指标 |


## 对象协作与流程

### 对象关系

| 关系 | 从 | 到 | 说明 |
|---|---|---|---|
| 持有 | `TaskServer` | `Limits`、`TaskRegistry`、`Executor`、`StreamHub` | 请求处理时按需取用 |
| 调用 | `TaskHandler` | `Allowlist` | 下发请求先过校验 |
| 创建 | `Executor` | `ChildProcess` | 每个任务一个子进程 |
| 回调 | `ChildProcess` | `Task` | 输出经管道回到 `OutputBuffer` |

### 流程一：下发到完成

1. `TaskHandler` 收到下发请求，调 `Allowlist` 校验命令与参数。
2. `Executor` 先取并发名额。名额满则回 429。
3. `Executor` 创建 `Task`，交给 `TaskRegistry` 保存。
4. 线程池取出任务，`Executor` 创建 `ChildProcess`。子进程自建进程组。
5. `Task` 置 running。两条管道由线程读入 `OutputBuffer`。
6. `OutputBuffer` 追加分片，并推给 `StreamHub` 的订阅者。
7. 子进程退出，`Executor` 决定终态，调 `Task.finish`。
8. `OutputBuffer` 推结束事件。订阅者收到后关闭连接。

### 流程二：取消与超时

1. `TaskHandler` 收到取消请求，调 `Executor.cancel`。
2. 任务已结束则回 409。否则置取消标记。
3. 任务在排队时，工作线程取到后直接落已取消，不发信号。
4. 任务在收尾时，`ChildProcess` 向进程组发 SIGTERM。
5. 宽限 3 秒未退出，再发 SIGKILL。
6. 宽限期内，`MetricsSampler` 继续更新指标。
7. `Task.finish` 落终态，`OutputBuffer` 推结束事件。
8. 失败路径：子进程出错不逃逸。`Executor` 兜底落 failed，并释放并发名额。


## 组合方式图解

两张图与上面的对象清单同名。第一张回答「对象之间谁持有谁、谁继承谁」。
第二张回答「一次下发，对象按什么顺序互相调用」。第三张回答「状态在哪些环节落定」。

<DiagramFrame src="/diagrams/task-service-objects.html" title="对象关系：实线是持有与创建，虚线是继承（Archify 交互图）" :height="560" />

<DiagramFrame src="/diagrams/task-service-submit.html" title="下发到完成：八个参与对象的调用顺序（Archify 交互图）" :height="620" />

<DiagramFrame src="/diagrams/executor-lifecycle.html" title="任务从接单到收尾的服务端流转（Archify 交互图）" :height="520" />

## 核心源码

源码按对象分块。每块是该对象的完整类定义，直接从 `service/` 提取。
文件清单与验收命令见「复用四件套」。

### TaskHandler

来源：`service/app.py`。

```python
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
        hub = self.server.stream_hub
        from_seq = hub.resolve_cursor(self.headers.get("Last-Event-ID"), query)

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store")
        self.send_header("Connection", "keep-alive")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        subscriber, history = hub.open(task, from_seq)
        try:
            self._sse("status", None, {"id": task.id, "status": task.status, "from_seq": from_seq})
            for chunk in history:
                self._sse("output", chunk["seq"], chunk)
            if task.finished:
                self._sse("end", None, task._end_payload_locked())
                return
            while True:
                item = hub.next_event(subscriber)
                if item is None:
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
            hub.close(task, subscriber)

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
```

### TaskServer

来源：`service/app.py`。

```python
class TaskServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler, limits: Limits, registry: Registry, executor: Executor) -> None:
        super().__init__(address, handler)
        self.limits = limits
        self.registry = registry
        self.executor = executor
        # 组合：服务器持有流订阅中心，各请求共用同一实例。
        self.stream_hub = StreamHub()


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
```

### Allowlist

来源：`service/limits.py`。

```python
class Allowlist:
    """命令白名单与参数校验。

    对象职责：判断命令是否放行，校验参数与环境变量的形态。
    对象边界：不管并发、超时与工作区，那些属于 Limits。
    被谁持有：Limits 持有唯一实例。
    """

    def __init__(self, items: dict[str, "AllowItem"], env_keys: list[str],
                 args_max: int, arg_len_max: int) -> None:
        self.items = items
        self.env_keys = env_keys
        self.args_max = args_max
        self.arg_len_max = arg_len_max

    def names(self) -> list[str]:
        return sorted(self.items)

    def get(self, name: str) -> "AllowItem | None":
        return self.items.get(name)

    def validate_command(self, payload: dict) -> str:
        command = payload.get("command")
        if not isinstance(command, str) or not command:
            raise ValidationError("缺少 command 字段")
        if command not in self.items:
            raise ValidationError(f"命令不在白名单内：{command}")
        return command

    def validate_args(self, raw_args: object) -> list[str]:
        if raw_args is None:
            raw_args = []
        if not isinstance(raw_args, list):
            raise ValidationError("args 必须是字符串数组")
        if len(raw_args) > self.args_max:
            raise ValidationError(f"参数个数超过上限 {self.args_max}")
        args: list[str] = []
        for item in raw_args:
            if not isinstance(item, str):
                raise ValidationError("args 里每一项都必须是字符串")
            if len(item) > self.arg_len_max:
                raise ValidationError(f"单个参数长度超过上限 {self.arg_len_max}")
            if CONTROL_CHAR.search(item):
                raise ValidationError("参数包含控制字符")
            hit = FORBIDDEN_ARG_CHARS.intersection(item)
            if hit:
                raise ValidationError(f"参数包含被禁止的字符：{''.join(sorted(hit))}")
            args.append(item)
        return args

    def validate_env(self, raw_env: object) -> dict[str, str]:
        env: dict[str, str] = {}
        raw_env = raw_env or {}
        if not isinstance(raw_env, dict):
            raise ValidationError("env 必须是对象")
        for key, value in raw_env.items():
            if key not in self.env_keys:
                raise ValidationError(f"env 键不在白名单内：{key}")
            if not isinstance(value, str) or CONTROL_CHAR.search(value):
                raise ValidationError(f"env[{key}] 必须是可读字符串")
            env[key] = value
        return env
```

### Task

来源：`service/registry.py`。

```python
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
```

### TaskRegistry

来源：`service/registry.py`。

```python
class TaskRegistry:
    """任务集合与保留策略。超出保留数时先淘汰最早的终态任务。

    对象职责：保存任务、提供查询与淘汰。
    对象边界：不做调度，不碰子进程，不做输出分发。
    """

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


# 旧名保留为别名，避免调用方与文档同时改动。
Registry = TaskRegistry
```

### OutputBuffer

来源：`service/output.py`。

```python
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
```

### StreamHub

来源：`service/stream.py`。

```python
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
```

### Executor

来源：`service/executor.py`。

```python
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
```

### ChildProcess

来源：`service/process.py`。

```python
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
```

### MetricsSampler

来源：`service/process.py`。

```python
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
```
## 设计说明

- 校验与限额合在一层。命令、参数、工作目录与超时都在 `Limits.validate_submit` 里判。
- 名额先占后用。`try_acquire_slot` 失败即返回 429，任务不进池子。
- 状态机单向。状态只能按 `TRANSITIONS` 表往前走，回退一律拒绝。
- 输出走环形缓冲。每个任务持有分片队列与订阅者集合，读方按序号取。
- 取消分两段。SIGTERM 给宽限，3 秒后仍不退再发 SIGKILL。
- 指标按需采样。CPU 时间与峰值内存每 250 毫秒采一次。

### 官方依据与版本差异

- [http.server](https://docs.python.org/3/library/http.server.html) — Python 3.7 起提供 `ThreadingHTTPServer`。
- [subprocess](https://docs.python.org/3/library/subprocess.html) — Python 3.2 起提供 `start_new_session`。
- [signal](https://docs.python.org/3/library/signal.html) — `SIGTERM` 与 `SIGKILL` 是 Unix 语义，Windows 上不可用。

## 使用文档

复制 `service/` 目录后直接运行。主机与端口由环境变量给出。

```bash
export DOCS1_HOST=127.0.0.1
export DOCS1_PORT=8787
python3 -m service.app
```

最小一次下发与取流。

```bash
curl -s -X POST http://127.0.0.1:8787/api/tasks \
  -d '{"command": "cp", "args": ["big.bin", "copy.bin"], "timeout_s": 60}'
curl -N 'http://127.0.0.1:8787/api/tasks/<id>/stream?from=0'
```

命令清单与限额写在 `service/config.json`。也可以用 `DOCS1_MAX_CONCURRENCY` 这类环境变量覆盖。

## 复用四件套

本节渲染 `reuse/task-console/manifest.json` 的后端部分。清单落地前先按下表对齐字段名。

| 件 | 内容 |
|---|---|
| 文件清单 | `service/app.py`（路由与 SSE）、`service/registry.py`（任务与缓冲）、`service/executor.py`（调度与子进程）、`service/limits.py`（校验与限额）、`service/config.json`（默认取值） |
| 外部依赖 | 无。只用 Python 3.13 标准库 |
| 适配点 | 命令清单与工作区改 `config.json`。端口与并发上限走环境变量 |
| 验收命令 | `python3 -m pytest tests/test_task_service.py -q`，期望全部通过 |

## 其他项目如何引用

### 方式一：整目录复制

把 `service/` 整目录搬进你的项目，入口保持不变。它不依赖本仓其他部分。

```bash
cp -r service/ your-project/service/
python3 -m your_project.service.app
```

### 方式二：只取调度层

只要进程组与取消能力时，留 `executor.py` 与 `registry.py`。HTTP 层可以换成你的框架。

```python
from service.executor import Executor
from service.limits import Limits
from service.registry import Registry

limits = Limits(config_path="service/config.json")
registry = Registry(limits.keep)
executor = Executor(limits, registry)
```

### 方式三：接进现有服务

已有 Web 框架时，只复用它做三件事：校验、调度、取流。

```python
payload = limits.validate_submit(request.json)
if not executor.try_acquire_slot():
    return {"error": "并发已达上限"}, 429
task = Task(...)
registry.add(task)
executor.submit(task)
return task.summary(), 201
```

## 接口契约

六个端点同源提供。失败与降级按下表处理。

| 端点 | 方法 | 成功 | 失败 |
|---|---|---|---|
| `/api/tasks` | POST | 201 任务摘要 | 400 参数错误，429 并发超限 |
| `/api/tasks` | GET | 200 任务列表与限额 | 500 内部错误 |
| `/api/tasks/{id}` | GET | 200 任务与指标 | 404 任务不存在 |
| `/api/tasks/{id}/cancel` | POST | 200 已受理 | 409 已结束，404 不存在 |
| `/api/tasks/{id}/stream` | GET | 200 SSE 流 | 404 任务不存在 |
| `/api/health` | GET | 200 版本与限额 | 500 内部错误 |

推送事件只有三种。`status` 报状态，`output` 带分片，`end` 带终态与指标。

读方断开是常态。写失败按连接关闭处理，不算服务错误。

### 契约版本与迁移

当前 `contract_version` 为 `1.0.0`。端点、事件名与字段名在本版内不变。

破坏性变更要递增主版本号，并在本节写明迁移步骤与替代字段。

读方按未知事件名忽略处理。这样新增事件不会打断旧读方。

## API 手册：任务服务

### TaskHandler

<ApiTable :items='[{"name":"POST /api/tasks","rank":"必会","signature":"POST /api/tasks","params":[{"name":"command","type":"string","default":"必填","desc":"白名单里的命令名"},{"name":"args","type":"string[]","default":"[]","desc":"参数列表，拒绝元字符"},{"name":"cwd","type":"string","default":"工作区","desc":"限定在工作区内"},{"name":"timeout_s","type":"int","default":"300","desc":"不超过限额上限"}],"returns":"201 任务摘要；400 参数错误，429 并发超限","effect":"校验命令与参数，建任务并交线程池","scenario":"页面点一次下发","example":"curl -s -X POST http://127.0.0.1:8787/api/tasks \\\n  -d &#39;{\"command\": \"cp\", \"args\": [\"a\", \"b\"], \"timeout_s\": 60}&#39;","exampleLang":"bash","pitfall":"并发到上限时返回 429。调用方要等一个任务结束再试。"},{"name":"POST /api/tasks/{id}/cancel","rank":"必会","signature":"POST /api/tasks/{id}/cancel","params":[{"name":"id","type":"string","default":"必填","desc":"任务标识"}],"returns":"200 {id, status, cancel_requested}；409 已结束，404 不存在","effect":"向任务进程组发 SIGTERM，宽限 3 秒后发 SIGKILL","scenario":"长任务提前停止","example":"curl -s -X POST http://127.0.0.1:8787/api/tasks/t001/cancel","exampleLang":"bash","pitfall":"任务已到终态时返回 409。取消是请求，不阻塞等结果。"},{"name":"GET /api/tasks","rank":"常用","signature":"GET /api/tasks?limit=50","params":[{"name":"limit","type":"int","default":"50","desc":"返回条数上限"}],"returns":"{tasks, limits}","effect":"按时间倒序返回任务摘要与当前限额","scenario":"页面轮询任务列表","example":"curl -s &#39;http://127.0.0.1:8787/api/tasks?limit=20&#39;","exampleLang":"bash","pitfall":"只保留最近 keep 个任务，更早的任务已被丢弃。"},{"name":"GET /api/tasks/{id}","rank":"常用","signature":"GET /api/tasks/{id}","params":[{"name":"id","type":"string","default":"必填","desc":"任务标识"}],"returns":"{task, metrics}","effect":"取单个任务的状态与指标快照","scenario":"刷新详情或事后对账","example":"curl -s http://127.0.0.1:8787/api/tasks/t001","exampleLang":"bash","pitfall":"任务被环形缓冲淘汰后返回 404。"}]' />

### StreamHub

<ApiTable :items='[{"name":"GET /api/tasks/{id}/stream","rank":"必会","signature":"GET /api/tasks/{id}/stream?from=N","params":[{"name":"from","type":"int","default":"0","desc":"起始分片序号"},{"name":"Last-Event-ID","type":"header","default":"空","desc":"重连时的续传序号"}],"returns":"text/event-stream：status / output / end","effect":"先补历史分片，再持续推送新分片","scenario":"实时查看 stdout 与 stderr","example":"curl -N &#39;http://127.0.0.1:8787/api/tasks/t001/stream?from=0&#39;","exampleLang":"bash","pitfall":"from 与 Last-Event-ID 取较大值，序号更小的分片不重发。"},{"name":"GET /api/health","rank":"常用","signature":"GET /api/health","params":[],"returns":"{ok, service, version, running, limits}","effect":"报告服务版本、并发占用与限额","scenario":"探活与容量查看","example":"curl -s http://127.0.0.1:8787/api/health","exampleLang":"bash","pitfall":"running 计数包含排队中的任务。"}]' />

### Executor

<ApiTable :items='[{"name":"Executor.submit","rank":"必会","signature":"Executor.submit(task)","params":[{"name":"task","type":"Task","default":"必填","desc":"已通过校验的任务"}],"returns":"无","effect":"把任务交给线程池，占用一个并发名额","scenario":"收到合法下发请求后调度","example":"executor.submit(task)","exampleLang":"python","pitfall":"名额由 try_acquire_slot 先占。并发满时返回 429，别把任务压进池子。"},{"name":"Executor.cancel","rank":"必会","signature":"Executor.cancel(task) -&gt; bool","params":[{"name":"task","type":"Task","default":"必填","desc":"目标任务"}],"returns":"True 表示已受理；False 表示已结束","effect":"置取消标记，运行中则向进程组发 SIGTERM","scenario":"接口层处理取消请求","example":"if not executor.cancel(task):\n    return 409","exampleLang":"python","pitfall":"排队中的任务不发信号。工作线程取到后直接置为已取消。"},{"name":"Limits.validate_submit","rank":"必会","signature":"Limits.validate_submit(payload) -&gt; dict","params":[{"name":"payload","type":"dict","default":"必填","desc":"下发请求体"}],"returns":"校验通过的下发参数","effect":"校验命令、参数、工作目录与超时","scenario":"所有下发请求的唯一入口","example":"payload = limits.validate_submit(body)","exampleLang":"python","pitfall":"参数里的元字符与控制字符一律拒绝，不做转义。"},{"name":"Registry.list","rank":"常用","signature":"Registry.list(limit=50) -&gt; list[Task]","params":[{"name":"limit","type":"int","default":"50","desc":"返回条数"}],"returns":"任务列表，新的在前","effect":"读环形缓冲里的任务摘要","scenario":"列表接口与自检","example":"for task in registry.list(20):\n    print(task.id, task.status)","exampleLang":"python","pitfall":"超出 keep 的旧任务已被丢弃，列表不会返回。"}]' />

## 常见误区

- 「提交成功就一定能跑完」是错的。并发到上限时服务直接返回 429，任务不入队。
- 「取消会立刻杀掉进程」是错的。服务先发 SIGTERM，宽限 3 秒后才发 SIGKILL。
- 「输出可以攒到结束后一次取」是错的。分片只留在内存环形缓冲里，服务会丢弃超期任务。
- 「重启后还能查到旧任务」是错的。任务与输出不落盘，重启即清空。

## 面试追问链

<details>
<summary>Q1：为什么每个任务要单独建进程组？</summary>

命令可能再拉起子进程。按进程组发信号才能一次收干净，不留孤儿进程。

</details>

<details>
<summary>Q2：既然发了 SIGTERM，为什么还要 SIGKILL？</summary>

有的进程不处理 SIGTERM。宽限 3 秒仍不退出时，SIGKILL 才能保证收尾。

</details>

<details>
<summary>Q3：取消排队中的任务为什么不发信号？</summary>

排队中的任务还没有子进程。服务只置取消标记，工作线程取到后直接置为已取消。

</details>

<details>
<summary>Q4：SSE 断线后怎么保证不丢不重？</summary>

每个分片带唯一序号。重连时取 `Last-Event-ID` 与 `from` 的较大值，只补缺口。

</details>

<details>
<summary>Q5：输出为什么放内存环形缓冲，不落盘？</summary>

演示场景要的是低延迟与简单部署。代价是重启丢数据，服务也会丢弃超期任务。

</details>

## 与其他组件的关系

[进程安全队列](/backend/components/safe-queue) 管进程内的投递与回收。本服务把它搬到 HTTP 之后，多了取消、限额与流式推送。

两个组件的共同点是把「提交、排队、消费、收尾」四步显式化。差别在生命周期归属：队列由调用方控制，本服务由请求驱动。

## 下一讲衔接

服务端的进程组与超时判断来自 [子进程与信号](/backend/learn/concurrency/subprocess-signals)。

调度与并发名额的取舍见 [任务编排与线程池](/backend/learn/concurrency/executor-pools)。
