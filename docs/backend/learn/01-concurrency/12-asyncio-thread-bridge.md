---
title: "异步与线程协作"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 12
level: advanced
tags: [asyncio, thread-bridge, run-in-executor, cross-thread]
description: "在事件循环与线程之间安全传递任务与结果"
source_module: "asyncio"
api_methods:
  - "loop.run_in_executor"
  - "loop.call_soon_threadsafe"
  - "asyncio.run_coroutine_threadsafe"
  - "asyncio.Event"
  - "asyncio.Lock"
prerequisites:
  - /backend/learn/concurrency/async-advanced
  - /backend/learn/concurrency/executor-pools
related_knowledge:
  - /backend/learn/concurrency/async-advanced
  - /backend/learn/concurrency/sync-primitives
related_components:
  - /backend/components/safe-queue
---

### 本讲要解决的问题

异步代码迟早要调同步库，或者从线程回调事件循环。跨世界调用很脆弱，写错就静默失效。这一讲给出四种安全写法。

## TL;DR

> 同步函数放进执行器，别直接调用。线程要通知事件循环，只能走线程安全入口。
> 不要在线程里直接 await，也不要在事件循环里阻塞等待。

## 概念定义

两个世界的边界有三条规则：谁拥有循环、谁在跑阻塞代码、通知走哪条通道。

事件循环只在自己的线程里执行。线程池里的代码在别的线程执行。线程要往循环里送协程，必须通过线程安全的方法排队。循环遇到阻塞代码时，必须把它交给执行器，否则整个循环停止推进。

## 原理图解

下图画出事件循环的轮转，以及与执行器之间的交接点。

<DiagramFrame src="/diagrams/async-event-loop.html" title="事件循环与阻塞调用的边界（Archify 交互图）" :height="500" />

## 关键对比

| 需求 | 正确写法 | 错误写法 |
|---|---|---|
| 协程里调同步库 | to_thread 或 run_in_executor | 直接调用阻塞函数 |
| 线程里通知循环 | call_soon_threadsafe | 直接改循环内部状态 |
| 线程里执行协程 | run_coroutine_threadsafe | 在线程里 await |
| 等待某个事件 | asyncio.Event | 忙轮询标志位 |
| 协程间互斥 | asyncio.Lock | threading.Lock |

## API 手册：跨世界调用

<ApiTable :items='[{"name": "loop.run_in_executor", "rank": "必会", "signature": "run_in_executor(executor, func, *args)", "params": [{"name": "executor", "type": "Executor | None", "default": "None", "desc": "None 表示默认线程池"}, {"name": "func", "type": "callable", "default": "必填", "desc": "同步函数"}], "returns": "可等待对象，完成时给出函数结果", "methods": ["run_in_executor() — 交出阻塞调用", "loop.set_default_executor() — 换默认执行器"], "effect": "把阻塞调用移出事件循环", "scenario": "调用无异步版本的库", "example": "import asyncio\n\ndef blocking(n):\n    return n * 2\n\nasync def main():\n    loop = asyncio.get_running_loop()\n    return await loop.run_in_executor(None, blocking, 21)\n\nprint(asyncio.run(main()))", "exampleLang": "python"}, {"name": "loop.call_soon_threadsafe", "rank": "必会", "signature": "call_soon_threadsafe(callback, *args)", "params": [{"name": "callback", "type": "callable", "default": "必填", "desc": "在循环线程里执行的函数"}], "returns": "Handle 对象", "methods": ["call_soon_threadsafe() — 线程安全地排队", "Handle.cancel() — 取消未执行的回调"], "effect": "让其他线程安全地触发循环动作", "scenario": "线程收到结果后唤醒循环", "example": "import asyncio\nimport threading\n\nasync def main():\n    loop = asyncio.get_running_loop()\n    done = loop.create_future()\n\n    def notify():\n        loop.call_soon_threadsafe(done.set_result, \"来自线程\")\n\n    threading.Thread(target=notify).start()\n    return await done\n\nprint(asyncio.run(main()))", "exampleLang": "python"}, {"name": "asyncio.run_coroutine_threadsafe", "rank": "常用", "signature": "run_coroutine_threadsafe(coro, loop)", "params": [{"name": "coro", "type": "coroutine", "default": "必填", "desc": "要在循环里执行的协程"}, {"name": "loop", "type": "AbstractEventLoop", "default": "必填", "desc": "目标事件循环"}], "returns": "concurrent.futures.Future", "methods": ["result(timeout=None) — 线程侧取结果", "cancel() — 请求取消"], "effect": "从线程提交协程到循环", "scenario": "同步入口调用异步服务", "example": "import asyncio\nimport threading\n\nasync def serve():\n    return \"ok\"\n\ndef worker(loop):\n    future = asyncio.run_coroutine_threadsafe(serve(), loop)\n    print(future.result(timeout=2))\n\nloop = asyncio.new_event_loop()\nthreading.Thread(target=lambda: (asyncio.set_event_loop(loop), loop.run_forever())).start()\nworker(loop)\nloop.call_soon_threadsafe(loop.stop)", "exampleLang": "python"}, {"name": "asyncio.Event", "rank": "常用", "signature": "Event()", "params": [], "returns": "异步事件对象", "methods": ["await wait() — 等到置位", "set() — 置位并唤醒等待者", "clear() — 复位"], "effect": "在协程之间传递一次性信号", "scenario": "启动完成后放行全部协程", "example": "import asyncio\n\nasync def waiter(event):\n    await event.wait()\n    return \"放行\"\n\nasync def main():\n    event = asyncio.Event()\n    task = asyncio.create_task(waiter(event))\n    event.set()\n    return await task\n\nprint(asyncio.run(main()))", "exampleLang": "python"}, {"name": "asyncio.Lock", "rank": "常用", "signature": "Lock()", "params": [], "returns": "异步互斥锁", "methods": ["async with lock — 获取与释放", "locked() — 是否被持有"], "effect": "保护协程之间的共享状态", "scenario": "刷新缓存的单飞控制", "example": "import asyncio\n\nasync def main():\n    lock = asyncio.Lock()\n    async with lock:\n        await asyncio.sleep(0.01)\n    return \"完成\"\n\nprint(asyncio.run(main()))", "exampleLang": "python"}]' />

## 组合用法：同步回调驱动的异步流水线

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [异步与线程协作](/backend/learn/concurrency/asyncio-thread-bridge) | 跨世界调用 |
| [asyncio 进阶模式](/backend/learn/concurrency/async-advanced) | 任务组与超时 |
| [执行器与任务编排](/backend/learn/concurrency/executor-pools) | 默认线程池 |

### 数据流图解

<DiagramFrame src="/diagrams/executor-lifecycle.html" title="线程与循环的交接点（Archify 交互图）" :height="460" />

### 分步实现

1. 主线程建循环并 run_forever。
2. 同步库回调拿到结果后，用 call_soon_threadsafe 唤醒循环。
3. 循环里的任务组处理结果。
4. 需要阻塞动作时交给执行器。
5. 退出时先停循环再回收线程池。

### 对比表格

| 调用方向 | 线程安全入口 | 返回形态 |
|---|---|---|
| 循环调用线程 | to_thread 或 run_in_executor | 可等待对象 |
| 线程调用循环 | call_soon_threadsafe | 回调句柄 |
| 线程取协程结果 | run_coroutine_threadsafe | Future |
| 协程之间 | Event 或 Lock | 协程内等待 |

## 完整 Demo：线程回调驱动异步处理

### 场景描述

一个模拟的同步客户端在后台线程产出数据。主线程跑事件循环，用线程安全入口把数据送进队列并异步处理。

### 完整代码

```python
import asyncio
import threading
import time

DATA = [1, 2, 3, 4, 5]


def producer(loop: asyncio.AbstractEventLoop, queue: asyncio.Queue) -> None:
    for item in DATA:
        time.sleep(0.05)
        loop.call_soon_threadsafe(queue.put_nowait, item)
    loop.call_soon_threadsafe(queue.put_nowait, None)


async def consumer(queue: asyncio.Queue) -> list[int]:
    seen: list[int] = []
    while True:
        item = await queue.get()
        if item is None:
            return seen
        seen.append(item * 10)


async def main() -> list[int]:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    thread = threading.Thread(target=producer, args=(loop, queue))
    thread.start()
    result = await asyncio.wait_for(consumer(queue), timeout=5)
    thread.join(timeout=1)
    return result


if __name__ == "__main__":
    print(asyncio.run(main()))
```

### 运行方式

```bash
python3 bridge_demo.py
```

### 常见误区

- 在线程里直接操作 asyncio.Queue。它不是线程安全的。
- 用 asyncio.Lock 保护跨线程状态。它只在循环线程内有效。
- 把 run_coroutine_threadsafe 的结果直接 await。它返回的是同步 Future。
- 忘了在退出时停止循环。进程会一直挂着不退。

### 面试追问链

<details>
<summary>Q1：为什么线程不能直接 await？</summary>

await 需要一个正在执行的事件循环。线程里没有可用的循环上下文。

</details>

<details>
<summary>Q2：call_soon_threadsafe 与直接调用有什么差别？</summary>

它把回调排队到循环线程执行。直接调用会跨线程改状态，导致竞态。

</details>

<details>
<summary>Q3：两种 Future 怎么区分？</summary>

协程世界的 Future 由循环驱动。线程侧的 Future 用 result 阻塞取结果。

</details>

<details>
<summary>Q4：什么时候不该用异步？</summary>

纯 CPU 密集任务交给进程。异步只解决等待重叠，不解决算力。

</details>

### 下一讲衔接

本域十二讲讲完。回到[并发编程入口](/backend/learn/)可复习整条路径，也可以直接进[组件页](/backend/components/safe-queue)看工业级写法。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 把线程、进程与队列组合成可复用组件，与本讲的桥接思路互补。
