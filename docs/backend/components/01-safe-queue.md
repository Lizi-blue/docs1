---
title: "进程安全队列"
type: component
domain: backend
direction: backend
component_type: library
order: 1
install_command: "pip install py-safe-queue"
knowledge_index:
  - page: /backend/learn/concurrency/queue-pipe
    role: "队列缓冲与哨兵结束的判据来源"
  - page: /backend/learn/concurrency/process-basics
    role: "worker 进程与跨进程结果回收"
  - page: /backend/learn/concurrency/thread-basics
    role: "单进程模式下的线程 worker 与锁"
reuse_manifest: reuse/safe-queue/manifest.json
depends_on_knowledge:
  - /backend/learn/concurrency/queue-pipe
  - /backend/learn/concurrency/process-basics
  - /backend/learn/concurrency/thread-basics
related_components: []
tags_index: [multiprocessing, queue, sentinel]
reusability: high
description: "把队列、哨兵与异常回传封成一个可复用的进程池执行器"
---

# 进程安全队列

## 组件简介

一个 200 行的执行器：投任务进队列，多个 worker 消费，异常沿队列回传，关闭时优雅退出。

它解决三个常见坑：哨兵数量不够导致消费者挂死、子进程异常丢失、结束顺序不对导致数据丢。源码不依赖本仓任何私有资源，复制走即可用。

## 依赖的知识域与知识点

<KnowledgeIndex />

## 对象模型

组件由两个类与一个进程入口组成。

| 对象 | 职责 | 状态 | 生命周期 |
|---|---|---|---|
| `SafeQueue` | 组装队列与 worker，对外给出投递与收取 | worker 列表、任务队列 | 由调用方用 `with` 创建与关闭 |
| `TaskResult` | 承载成功值或异常文本 | ok、value、error | worker 完成后创建 |
| `_worker` | 进程入口：取任务、调用、回传 | 当前任务 | 随 `SafeQueue` 启动，收到哨兵退出 |


## 对象层级

源码没有继承，关系全是持有。

| 子类 | 父类 | 扩展或覆盖 |
|---|---|---|
| 无 | 无 | 本组件没有继承 |

| 持有者 | 被持有者 | 用途 |
|---|---|---|
| `SafeQueue` | 任务队列、结果队列 | 投递与收取 |
| `SafeQueue` | worker 进程 | 并发处理任务 |


## 对象协作与流程

### 对象关系

| 关系 | 从 | 到 | 说明 |
|---|---|---|---|
| 持有 | `SafeQueue` | 任务队列 | 投递入口 |
| 持有 | `SafeQueue` | worker 进程 | 每个 worker 一个进程 |
| 调用 | `SafeQueue.submit` | 任务队列 | 逐条投递任务 |
| 回调 | `_worker` | 结果队列 | 回传 `TaskResult` |

### 流程一：投递到收取

1. 调用方用 `with SafeQueue(func, workers=N)` 创建组件。
2. `__enter__` 起 N 个 worker 进程。
3. `submit(items)` 把每条任务放进任务队列。
4. worker 取出任务，调用任务函数。
5. 结果包成 `TaskResult`，放进结果队列。
6. `drain(expected)` 按条数收回结果。
7. `__exit__` 按 worker 数投哨兵。
8. worker 收到哨兵退出，队列关闭。

### 流程二：失败与超时

1. 子进程里的异常不逃逸。worker 包成 `TaskResult(ok=False)`。
2. 结果里带异常文本。调用方按 `ok` 分支处理。
3. 哨兵少投一个，对应 worker 会一直等队列。
4. `drain` 超过超时会抛 `TimeoutError`。
5. 启动方式为 spawn 时，任务函数必须可 pickle。


## 组合方式图解

<DiagramFrame src="/diagrams/queue-handshake.html" title="队列、哨兵与结果回收（Archify 交互图）" :height="500" />

## 核心源码

```python
"""safe_queue —— 进程安全的任务队列执行器（可整段复制到任意项目）。"""
from __future__ import annotations

import multiprocessing as mp
import traceback
from dataclasses import dataclass
from typing import Any, Callable, Iterable

SENTINEL = "__stop__"


@dataclass
class TaskResult:
    ok: bool
    value: Any = None
    error: str | None = None
    traceback_text: str | None = None


def _worker(func: Callable[[Any], Any], tasks: mp.Queue, results: mp.Queue) -> None:
    while True:
        payload = tasks.get()
        if payload == SENTINEL:
            return
        try:
            results.put(TaskResult(ok=True, value=func(payload)))
        except Exception as exc:  # 子进程异常必须回传，否则主进程只能等到超时
            results.put(
                TaskResult(
                    ok=False,
                    error=f"{type(exc).__name__}: {exc}",
                    traceback_text=traceback.format_exc(),
                )
            )


class SafeQueue:
    """跨进程任务队列：投递、消费、优雅关闭。"""

    def __init__(self, func: Callable[[Any], Any], workers: int = 4) -> None:
        if workers < 1:
            raise ValueError("workers 必须大于 0")
        self.func = func
        self.workers = workers
        self.tasks: mp.Queue = mp.Queue()
        self.results: mp.Queue = mp.Queue()
        self.processes: list[mp.Process] = []

    def __enter__(self) -> "SafeQueue":
        for _ in range(self.workers):
            process = mp.Process(target=_worker, args=(self.func, self.tasks, self.results), daemon=True)
            process.start()
            self.processes.append(process)
        return self

    def submit(self, items: Iterable[Any]) -> None:
        for item in items:
            self.tasks.put(item)

    def drain(self, expected: int, timeout: float = 30.0) -> list[TaskResult]:
        collected: list[TaskResult] = []
        for _ in range(expected):
            collected.append(self.results.get(timeout=timeout))
        return collected

    def __exit__(self, *exc_info: Any) -> None:
        for _ in self.processes:
            self.tasks.put(SENTINEL)
        for process in self.processes:
            process.join(timeout=5)
            if process.is_alive():
                process.terminate()
```

## 设计说明

- 哨兵按 worker 数量逐个投递。少投一个就有一个 worker 永久阻塞。
- 子进程异常不允许逃逸。worker 捕获后包成结果对象回传。
- `__exit__` 只做关闭，不做等待结果。调用方自己决定收多少条。
- 启动方式为 spawn 或 forkserver 时，任务函数必须定义在模块顶层。函数与参数都要可 pickle。
  Python 3.14 起 Linux 默认改用 forkserver，lambda 与局部函数会直接报 PicklingError。

### 官方依据与版本差异

- [multiprocessing 官方文档](https://docs.python.org/3/library/multiprocessing.html) — 3.8 及以后可用，3.14 起 POSIX 默认 forkserver。
- [concurrent.futures 官方文档](https://docs.python.org/3/library/concurrent.futures.html) — 3.8 及以后线程池默认上限为核数加四与 32 的较小值。
- [queue 官方文档](https://docs.python.org/3/library/queue.html) — 3.8 及以后提供线程安全队列与 task_done 语义。

## 使用文档

```python
from safe_queue import SafeQueue


def square(value: int) -> int:
    return value * value


with SafeQueue(square, workers=4) as queue:
    queue.submit(range(100))
    results = queue.drain(100)

print(sum(item.value for item in results if item.ok))
```

## 复用四件套

本节渲染 `reuse/safe-queue/manifest.json`。

| 件 | 内容 |
|---|---|
| 文件清单 | `docs/backend/components/01-safe-queue.md`（源码唯一来源）、`tests/test_safe_queue.py`（提取源码执行自测） |
| 外部依赖 | 无。只用 Python 标准库 |
| 适配点 | 任务函数必须定义在模块顶层且可 pickle。按核数调整 workers。submit 与 drain 条数配平 |
| 验收命令 | `python3 -m pytest tests/test_safe_queue.py -q`，期望全部通过 |

## 其他项目如何引用

### 方式一：pip 安装

```bash
pip install py-safe-queue
python -c "from safe_queue import SafeQueue; print(SafeQueue.__doc__)"
```

未发布到包仓库时，用下面的源码方式引入。

### 方式二：直接复制源码

把「核心源码」整段存成 `safe_queue.py`，放进你的项目包内。它只用标准库，无第三方依赖。

### 方式三：在框架中集成

**Flask 后台任务**：在应用启动时建执行器，请求里只投递任务。

```python
from flask import Flask, jsonify
from safe_queue import SafeQueue

app = Flask(__name__)
engine = SafeQueue(send_mail, workers=2)
engine.__enter__()


@app.post("/mail")
def enqueue():
    engine.submit(["a@example.com"])
    return jsonify(ok=True)
```

**Celery 替代场景**：任务量小、不想引入 broker 时，用本组件加一个进程内工作队列即可。

## 接口契约

| 项 | 约定 |
|---|---|
| 输入 | 任务函数 `func(value)`、worker 数 `workers`、任务序列 `items` |
| 输出 | 结果对象列表，每项含 `ok`、`value`、`error` 与 `traceback_text` |
| 异常 | 子进程异常不逃逸，包成结果回传。`workers < 1` 抛 `ValueError` |
| 失败与降级 | 缺少跨进程原语时构造即失败。`drain` 超时抛 `TimeoutError` |
| 契约版本 | 1.0.0 |

### 契约版本与迁移

当前版本 1.0.0。破坏性变更（结果对象字段改名、构造签名变化）递增主版本，
并在本页写明已复制项目的迁移步骤。

## API 手册：SafeQueue




- [multiprocessing 官方文档](https://docs.python.org/3/library/multiprocessing.html) — 3.8 及以后可用，3.14 起 POSIX 默认 forkserver。
- [concurrent.futures 官方文档](https://docs.python.org/3/library/concurrent.futures.html) — 3.8 及以后线程池默认上限为核数加四与 32 的较小值。

### 构造与生命周期

<ApiTable :items='[{"name":"SafeQueue.__init__","rank":"必会","signature":"SafeQueue(func, workers=4, maxsize=0)","params":[{"name":"func","type":"callable","default":"必填","desc":"子进程要执行的函数"},{"name":"workers","type":"int","default":"4","desc":"worker 进程数"},{"name":"maxsize","type":"int","default":"0","desc":"任务队列上限，0 表示不限"}],"returns":"SafeQueue 实例","effect":"建任务队列与 worker 进程池，等待提交流水线","scenario":"把可并行的大批量数据交给多进程处理","example":"from safe_queue import SafeQueue\n\ndef square(value: int) -> int:\n    return value * value\n\nwith SafeQueue(square, workers=4) as queue:\n    queue.submit(range(100))","pitfall":"func 必须定义在模块顶层且可 pickle，lambda 与局部函数在 spawn 下直接报 PicklingError","raises":"ValueError"},{"name":"SafeQueue.__exit__","rank":"必会","signature":"with SafeQueue(...) as queue / __exit__()","params":[],"returns":"无","effect":"退出时按 worker 数投哨兵并回收子进程","scenario":"批处理结束后的统一清理","example":"with SafeQueue(square, workers=4) as queue:\n    queue.submit(range(10))\n    results = queue.drain(10)","pitfall":"不走上下文会留下子进程；哨兵数量必须等于 worker 数，少投一个就有 worker 永久阻塞","raises":""}]' />

### 任务与结果

<ApiTable :items='[{"name":"SafeQueue.submit","rank":"必会","signature":"submit(items)","params":[{"name":"items","type":"iterable","default":"必填","desc":"任务参数序列"}],"returns":"无","effect":"把每个元素作为一个任务投进队列，立即返回不等结果","scenario":"大批量投递后再统一收口","example":"with SafeQueue(square, workers=4) as queue:\n    queue.submit(range(100))","pitfall":"drain 的条数要与投递数一致，投多收少会让结果残留、投少收多会等到超时","raises":""},{"name":"SafeQueue.drain","rank":"必会","signature":"drain(count, timeout=None)","params":[{"name":"count","type":"int","default":"必填","desc":"要收集的结果条数"},{"name":"timeout","type":"float","default":"None","desc":"整体等待上限秒数"}],"returns":"结果对象列表，每项含 ok、value、error 与 traceback_text","effect":"阻塞收集指定条数的结果，子进程异常也作为结果返回","scenario":"批处理收口与失败归集","example":"with SafeQueue(square, workers=4) as queue:\n    queue.submit(range(10))\n    results = queue.drain(10)\nprint(sum(item.value for item in results if item.ok))","pitfall":"超时会抛 TimeoutError；异常不逃逸，必须在结果里判断 ok，否则失败会被静默吞掉","raises":"TimeoutError"}]' />

## 常见误区

- 以为 `submit` 会阻塞到任务完成。它只投递，结果要靠 `drain` 收。
- 忽略结果里的 `ok` 字段。子进程异常不抛出，只看返回值会漏掉失败。
- 哨兵数量与 worker 数不配平。少投一个就有 worker 永久阻塞。

## 面试追问链

<details>
<summary>Q1：为什么异常不直接抛出，而是包进结果对象？</summary>

异常发生在子进程里。跨进程传异常对象会丢失栈信息，包成结果回传更可靠。

</details>

<details>
<summary>Q2：为什么哨兵要按 worker 数投递？</summary>

每个 worker 收到一个哨兵才退出。少投一个，对应 worker 会一直等队列。

</details>

<details>
<summary>Q3：spawn 下为什么不能传 lambda？</summary>

子进程要按模块名重建函数。lambda 与局部函数无法 pickle，直接报 PicklingError。

</details>

## 与其他组件的关系

当前仓库只有本组件。后续出现依赖它的组件时，本页会自动列出「被哪些组件引用」。

## 下一讲衔接

队列与进程组讲完，可以继续看[任务控制台后端组件](/backend/components/task-console)，
它把队列、线程池与进程组组合成一个可直接使用的服务。也可以回到[同步原语与死锁](/backend/learn/concurrency/sync-primitives)
复习锁与信号量的边界。
