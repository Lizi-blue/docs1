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

## 涉及的知识点

| 知识点 | 对应学习页面 | 在本组件中的作用 |
|---|---|---|
| 任务编排与线程池 | [任务编排与线程池](/backend/learn/concurrency/executor-pools) | 任务入队、并发名额与状态迁移 |
| 子进程与信号 | [子进程与信号](/backend/learn/concurrency/subprocess-signals) | 进程组启动与取消信号 |
| 同步原语与死锁 | [同步原语与死锁](/backend/learn/concurrency/sync-primitives) | 注册表与分片缓冲的加锁边界 |
| 套接字与流 | [套接字与流](/backend/learn/communication/socket-and-streams) | SSE 长连接与分片推送 |

## 组合方式图解

下图回答一个问题：一个任务从接单到收尾，服务端在哪些环节落状态与输出。

<DiagramFrame src="/diagrams/executor-lifecycle.html" title="任务从接单到收尾的服务端流转（Archify 交互图）" :height="520" />

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
| `TaskServer` | `Limits`、`Registry`、`Executor` | 请求处理时取限额、注册表与调度器 |
| `Task` | `OutputBuffer` | 输出分片、序号与订阅分发 |
| `Executor` | 线程池、`Popen` | 调度任务与拉子进程 |

## 核心源码

下面四段是服务端的骨架。全文见 `service/` 目录。

提交入口先校验，再占名额。两项都在这一步完成。

```python
def _submit(self) -> None:
    try:
        payload = self.server.limits.validate_submit(self._read_json())
    except ValidationError as error:
        self._send_error_json(error.status, error.message)
        return
    if not self.server.executor.try_acquire_slot():
        self._send_error_json(429, f"并发已达上限 {self.server.limits.max_concurrency}")
        return
    task = Task(payload["command"], payload["args"], payload["cwd"], payload["timeout_s"],
                payload["env"], self.server.limits.output_max_bytes)
    self.server.registry.add(task)
    self.server.executor.submit(task)
    self._send_json(201, task.summary())
```

子进程自建进程组。取消与超时因此能作用到整组。

```python
proc = subprocess.Popen(
    [task.command, *task.args],
    cwd=task.cwd,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=env,
    start_new_session=True,
)
task.pid = proc.pid
task.pgid = os.getpgid(proc.pid)
```

先发 SIGTERM，宽限期后再发 SIGKILL。

```python
def _terminate(self, task: Task, proc: subprocess.Popen) -> None:
    self._signal_group(task.pgid, signal.SIGTERM)
    deadline = time.monotonic() + GRACE_SECONDS
    while proc.poll() is None and time.monotonic() < deadline:
        time.sleep(SAMPLE_INTERVAL / 2)
    if proc.poll() is None:
        self._signal_group(task.pgid, signal.SIGKILL)
```

续传先取序号，再补历史分片，最后进推送循环。

```python
from_seq = 0
last_event_id = self.headers.get("Last-Event-ID") or ""
if last_event_id.isdigit():
    from_seq = int(last_event_id)
if params.get("from", [""])[0].isdigit():
    from_seq = max(from_seq, int(params["from"][0]))

subscriber, history = task.subscribe(from_seq)
self._sse("status", None, {"id": task.id, "status": task.status, "from_seq": from_seq})
for chunk in history:
    self._sse("output", chunk["seq"], chunk)
if task.finished:
    self._sse("end", None, task._end_payload_locked())
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

### 任务生命周期端点

<ApiTable :items='[{"name":"POST /api/tasks","rank":"必会","signature":"POST /api/tasks","params":[{"name":"command","type":"string","default":"必填","desc":"白名单里的命令名"},{"name":"args","type":"string[]","default":"[]","desc":"参数列表，拒绝元字符"},{"name":"cwd","type":"string","default":"工作区","desc":"限定在工作区内"},{"name":"timeout_s","type":"int","default":"300","desc":"不超过限额上限"}],"returns":"201 任务摘要；400 参数错误，429 并发超限","effect":"校验命令与参数，建任务并交线程池","scenario":"页面点一次下发","example":"curl -s -X POST http://127.0.0.1:8787/api/tasks \\\n  -d &#39;{\"command\": \"cp\", \"args\": [\"a\", \"b\"], \"timeout_s\": 60}&#39;","exampleLang":"bash","pitfall":"并发到上限时返回 429。调用方要等一个任务结束再试。"},{"name":"POST /api/tasks/{id}/cancel","rank":"必会","signature":"POST /api/tasks/{id}/cancel","params":[{"name":"id","type":"string","default":"必填","desc":"任务标识"}],"returns":"200 {id, status, cancel_requested}；409 已结束，404 不存在","effect":"向任务进程组发 SIGTERM，宽限 3 秒后发 SIGKILL","scenario":"长任务提前停止","example":"curl -s -X POST http://127.0.0.1:8787/api/tasks/t001/cancel","exampleLang":"bash","pitfall":"任务已到终态时返回 409。取消是请求，不阻塞等结果。"},{"name":"GET /api/tasks","rank":"常用","signature":"GET /api/tasks?limit=50","params":[{"name":"limit","type":"int","default":"50","desc":"返回条数上限"}],"returns":"{tasks, limits}","effect":"按时间倒序返回任务摘要与当前限额","scenario":"页面轮询任务列表","example":"curl -s &#39;http://127.0.0.1:8787/api/tasks?limit=20&#39;","exampleLang":"bash","pitfall":"只保留最近 keep 个任务，更早的任务已被丢弃。"},{"name":"GET /api/tasks/{id}","rank":"常用","signature":"GET /api/tasks/{id}","params":[{"name":"id","type":"string","default":"必填","desc":"任务标识"}],"returns":"{task, metrics}","effect":"取单个任务的状态与指标快照","scenario":"刷新详情或事后对账","example":"curl -s http://127.0.0.1:8787/api/tasks/t001","exampleLang":"bash","pitfall":"任务被环形缓冲淘汰后返回 404。"}]' />

### 输出流与探活

<ApiTable :items='[{"name":"GET /api/tasks/{id}/stream","rank":"必会","signature":"GET /api/tasks/{id}/stream?from=N","params":[{"name":"from","type":"int","default":"0","desc":"起始分片序号"},{"name":"Last-Event-ID","type":"header","default":"空","desc":"重连时的续传序号"}],"returns":"text/event-stream：status / output / end","effect":"先补历史分片，再持续推送新分片","scenario":"实时查看 stdout 与 stderr","example":"curl -N &#39;http://127.0.0.1:8787/api/tasks/t001/stream?from=0&#39;","exampleLang":"bash","pitfall":"from 与 Last-Event-ID 取较大值，序号更小的分片不重发。"},{"name":"GET /api/health","rank":"常用","signature":"GET /api/health","params":[],"returns":"{ok, service, version, running, limits}","effect":"报告服务版本、并发占用与限额","scenario":"探活与容量查看","example":"curl -s http://127.0.0.1:8787/api/health","exampleLang":"bash","pitfall":"running 计数包含排队中的任务。"}]' />

### 调度与限额内部接口

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
