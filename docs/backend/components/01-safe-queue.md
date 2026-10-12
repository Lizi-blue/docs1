---
title: "进程安全队列"
type: component
domain: backend
component_type: library
order: 1
install_command: "pip install py-safe-queue"
depends_on_knowledge:
  - /backend/learn/concurrency/queue-pipe
  - /backend/learn/concurrency/process-basics
related_components: []
tags_index: [multiprocessing, queue, sentinel]
reusability: high
description: "把队列、哨兵与异常回传封成一个可复用的进程池执行器"
---

# 进程安全队列

## 组件简介

一个 200 行的执行器：投任务进队列，多个 worker 消费，异常沿队列回传，关闭时优雅退出。

它解决三个常见坑：哨兵数量不够导致消费者挂死、子进程异常丢失、结束顺序不对导致数据丢。源码不依赖本仓任何私有资源，复制走即可用。

## 涉及的知识点

| 知识点 | 对应学习页面 | 在本组件中的作用 |
|---|---|---|
| 生产者消费者模型 | [Queue 通信](/backend/learn/concurrency/queue-pipe) | 队列缓冲与哨兵结束 |
| 进程池与序列化 | [多进程基础](/backend/learn/concurrency/process-basics) | worker 进程与结果回收 |
| 线程同步 | [多线程基础](/backend/learn/concurrency/thread-basics) | 单进程模式的线程 worker |

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


## API 手册：SafeQueue



- [multiprocessing 官方文档](https://docs.python.org/3/library/multiprocessing.html) — 3.8 及以后可用，3.14 起 POSIX 默认 forkserver。
- [concurrent.futures 官方文档](https://docs.python.org/3/library/concurrent.futures.html) — 3.8 及以后线程池默认上限为核数加四与 32 的较小值。

### 构造与生命周期

<ApiTable :items='[{"name":"SafeQueue.__init__","rank":"必会","signature":"SafeQueue(func, workers=4, maxsize=0)","params":[{"name":"func","type":"callable","default":"必填","desc":"子进程要执行的函数"},{"name":"workers","type":"int","default":"4","desc":"worker 进程数"},{"name":"maxsize","type":"int","default":"0","desc":"任务队列上限，0 表示不限"}],"returns":"SafeQueue 实例","effect":"建任务队列与 worker 进程池，等待提交流水线","scenario":"把可并行的大批量数据交给多进程处理","example":"from safe_queue import SafeQueue\n\ndef square(value: int) -> int:\n    return value * value\n\nwith SafeQueue(square, workers=4) as queue:\n    queue.submit(range(100))","pitfall":"func 必须定义在模块顶层且可 pickle，lambda 与局部函数在 spawn 下直接报 PicklingError","raises":"ValueError"},{"name":"SafeQueue.__exit__","rank":"必会","signature":"with SafeQueue(...) as queue / __exit__()","params":[],"returns":"无","effect":"退出时按 worker 数投哨兵并回收子进程","scenario":"批处理结束后的统一清理","example":"with SafeQueue(square, workers=4) as queue:\n    queue.submit(range(10))\n    results = queue.drain(10)","pitfall":"不走上下文会留下子进程；哨兵数量必须等于 worker 数，少投一个就有 worker 永久阻塞","raises":""}]' />

### 任务与结果

<ApiTable :items='[{"name":"SafeQueue.submit","rank":"必会","signature":"submit(items)","params":[{"name":"items","type":"iterable","default":"必填","desc":"任务参数序列"}],"returns":"无","effect":"把每个元素作为一个任务投进队列，立即返回不等结果","scenario":"大批量投递后再统一收口","example":"with SafeQueue(square, workers=4) as queue:\n    queue.submit(range(100))","pitfall":"drain 的条数要与投递数一致，投多收少会让结果残留、投少收多会等到超时","raises":""},{"name":"SafeQueue.drain","rank":"必会","signature":"drain(count, timeout=None)","params":[{"name":"count","type":"int","default":"必填","desc":"要收集的结果条数"},{"name":"timeout","type":"float","default":"None","desc":"整体等待上限秒数"}],"returns":"结果对象列表，每项含 ok、value、error 与 traceback_text","effect":"阻塞收集指定条数的结果，子进程异常也作为结果返回","scenario":"批处理收口与失败归集","example":"with SafeQueue(square, workers=4) as queue:\n    queue.submit(range(10))\n    results = queue.drain(10)\nprint(sum(item.value for item in results if item.ok))","pitfall":"超时会抛 TimeoutError；异常不逃逸，必须在结果里判断 ok，否则失败会被静默吞掉","raises":"TimeoutError"}]' />
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

## 与其他组件的关系

当前仓库只有本组件。后续出现依赖它的组件时，本页会自动列出「被哪些组件引用」。
