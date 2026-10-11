---
title: "asyncio 进阶模式"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 9
level: advanced
tags: [asyncio, taskgroup, timeout, backpressure]
description: "任务组、超时与取消传播、背压与线程桥接"
source_module: "asyncio"
api_methods:
  - "asyncio.TaskGroup"
  - "asyncio.timeout"
  - "asyncio.Semaphore"
  - "asyncio.Queue"
  - "asyncio.to_thread"
prerequisites:
  - /backend/learn/concurrency/async-io
  - /backend/learn/concurrency/sync-primitives
related_knowledge:
  - /backend/learn/concurrency/async-io
  - /backend/learn/concurrency/executor-pools
related_components:
  - /backend/components/safe-queue
---

### 本讲要解决的问题

会写 await 只算入门。真实服务还要处理失败传播、超时、限流与背压。这一讲给出四个可复用的写法。

## TL;DR

> TaskGroup 让一组任务同生共死。timeout 给整段代码加取消。Semaphore 限并发，Queue 做背压。
> 同步库放进 to_thread，别让它阻塞事件循环。

## 概念定义

进阶模式解决的是并发任务之间的组织问题，而不是单个协程的写法。

任务组把一组协程当成一个整体。任何一个失败，其余任务会被取消。超时上下文给一段代码设截止时间，到期抛出取消。信号量限制同时进入的协程数量。队列在生产快于消费时形成背压，把压力传回生产方。

## 原理图解

下图画出事件循环的轮转与取消传播，并标出阻塞调用的破坏点。

<DiagramFrame src="/diagrams/async-event-loop.html" title="事件循环轮转与取消传播（Archify 交互图）" :height="520" />

## 关键对比

| 模式 | 解决什么 | 误用后果 |
|---|---|---|
| TaskGroup | 一组任务整体成败一致 | 单个失败被静默吞掉 |
| timeout | 给整段代码设截止时间 | 用 wait_for 包多任务只等一个 |
| Semaphore | 限制同时进行的请求数 | 限流过松或过紧 |
| Queue | 生产快于消费时的背压 | 无界队列吃光内存 |
| to_thread | 桥接同步库 | 线程池打满后退化成排队 |

### 官方依据与版本差异

- [TaskGroup](https://docs.python.org/3/library/asyncio-task.html#task-groups) — 3.11 起提供，替代部分 gather 用法。
- [asyncio.timeout](https://docs.python.org/3/library/asyncio-task.html#asyncio.timeout) — 3.11 起提供。
- [asyncio 队列](https://docs.python.org/3/library/asyncio-queue.html) — 3.4 起提供，支持 maxsize 背压。

## API 手册：asyncio 的组织工具

<ApiTable :items='[{"name": "asyncio.TaskGroup", "rank": "必会", "signature": "TaskGroup()", "params": [], "returns": "异步上下文管理器", "methods": ["create_task(coro) — 建任务", "__aexit__ — 全部完成或整体取消"], "effect": "组内任一任务失败就取消其余任务", "scenario": "需要整体成败一致的并发流程", "example": "import asyncio\n\nasync def work(i):\n    await asyncio.sleep(0.01)\n    return i\n\nasync def main():\n    async with asyncio.TaskGroup() as group:\n        tasks = [group.create_task(work(i)) for i in range(3)]\n    return [t.result() for t in tasks]\n\nprint(asyncio.run(main()))", "exampleLang": "python"}, {"name": "asyncio.timeout", "rank": "必会", "signature": "timeout(delay)", "params": [{"name": "delay", "type": "float", "default": "必填", "desc": "秒数，超时抛 TimeoutError"}], "returns": "异步上下文管理器", "methods": ["timeout() — 给代码块设截止时间", "timeout_at(when) — 用绝对时间"], "effect": "到期取消块内所有等待", "scenario": "单次请求或整段流程设上限", "example": "import asyncio\n\nasync def slow():\n    await asyncio.sleep(10)\n\nasync def main():\n    async with asyncio.timeout(0.1):\n        await slow()\n\ntry:\n    asyncio.run(main())\nexcept TimeoutError:\n    print(\"超时\")", "exampleLang": "python"}, {"name": "asyncio.Semaphore", "rank": "必会", "signature": "Semaphore(value=1)", "params": [{"name": "value", "type": "int", "default": "1", "desc": "并发上限"}], "returns": "异步信号量", "methods": ["async with sem — 取许可", "locked() — 是否耗尽"], "effect": "限制同时进行的协程数量", "scenario": "对下游接口做并发保护", "example": "import asyncio\n\nasync def fetch(sem, i):\n    async with sem:\n        await asyncio.sleep(0.01)\n        return i\n\nasync def main():\n    sem = asyncio.Semaphore(2)\n    return await asyncio.gather(*[fetch(sem, i) for i in range(5)])\n\nprint(asyncio.run(main()))", "exampleLang": "python"}, {"name": "asyncio.Queue", "rank": "常用", "signature": "Queue(maxsize=0)", "params": [{"name": "maxsize", "type": "int", "default": "0", "desc": "上限，0 表示不限"}], "returns": "异步队列", "methods": ["await put(item) — 满时挂起", "await get() — 空时挂起", "task_done() — 标记完成", "await join() — 等全部处理完"], "effect": "在生产者与消费者之间形成背压", "scenario": "抓取与写入速度不匹配", "example": "import asyncio\n\nasync def main():\n    queue = asyncio.Queue(maxsize=2)\n    await queue.put(1)\n    print(await queue.get())\n    queue.task_done()\n\nasyncio.run(main())", "exampleLang": "python"}, {"name": "asyncio.to_thread", "rank": "常用", "signature": "to_thread(func, /, *args, **kwargs)", "params": [{"name": "func", "type": "callable", "default": "必填", "desc": "同步函数"}], "returns": "协程，完成后返回函数结果", "methods": ["to_thread() — 在线程里跑同步函数"], "effect": "把阻塞调用移出事件循环", "scenario": "调用没有异步版本的库", "example": "import asyncio\nimport time\n\ndef blocking():\n    time.sleep(0.1)\n    return \"done\"\n\nasync def main():\n    return await asyncio.to_thread(blocking)\n\nprint(asyncio.run(main()))", "exampleLang": "python"}]' />

## 组合用法：限流抓取加失败快速返回

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [asyncio 进阶模式](/backend/learn/concurrency/async-advanced) | 任务组、超时与限流 |
| [异步 I/O](/backend/learn/concurrency/async-io) | 事件循环与协程基础 |
| [同步原语与死锁](/backend/learn/concurrency/sync-primitives) | 信号量语义 |

### 数据流图解

<DiagramFrame src="/diagrams/async-event-loop.html" title="限流与取消在循环里的传播（Archify 交互图）" :height="460" />

### 分步实现

1. 建信号量限制并发数。
2. 用任务组包住一批抓取任务。
3. 给整段流程套 timeout。
4. 任一任务失败时让任务组取消其余任务。
5. 把结果写进队列，由消费者落库。

### 对比表格

| 失败策略 | 写法 | 结果 |
|---|---|---|
| 部分成功即可 | gather 加 return_exceptions | 收齐全量结果 |
| 整体成败一致 | TaskGroup | 首个失败即取消其余 |
| 只要最快一个 | wait 加 FIRST_COMPLETED | 其余任务继续跑 |
| 超时即放弃 | timeout 上下文 | 块内等待全部取消 |

## 完整 Demo：限流加超时的并发抓取

### 场景描述

并发抓取二十个地址，最多五个同时进行，整段流程限时两秒，超时打印未完成数量。

### 完整代码

```python
import asyncio
import time

URLS = [f"https://example.com/?p={i}" for i in range(20)]
LIMIT = 5


async def fetch(url: str, sem: asyncio.Semaphore) -> str:
    async with sem:
        await asyncio.sleep(0.1)
        return url


async def main() -> None:
    sem = asyncio.Semaphore(LIMIT)
    start = time.perf_counter()
    done = 0
    try:
        async with asyncio.timeout(2):
            async with asyncio.TaskGroup() as group:
                tasks = [group.create_task(fetch(url, sem)) for url in URLS]
            done = len(tasks)
    except TimeoutError:
        done = sum(1 for task in tasks if task.done())
    print(f"完成 {done} 个，耗时 {time.perf_counter() - start:.2f}s")


if __name__ == "__main__":
    asyncio.run(main())
```

### 运行方式

```bash
python3 async_advanced_demo.py
```

### 常见误区

- 用 wait_for 逐个包任务。整体超时会被切成多段，语义不对。
- 在协程里直接调用 requests。它会阻塞整个事件循环。
- 把 to_thread 当无限资源。线程池满了以后请求会排队。
- 用无界队列做缓冲。生产过快时内存先出问题。

### 面试追问链

<details>
<summary>Q1：TaskGroup 与 gather 怎么选？</summary>

需要整体成败一致选 TaskGroup。允许部分成功选 gather。

</details>

<details>
<summary>Q2：超时之后协程会怎样？</summary>

等待被取消，取消沿 await 链向上传播。要清理资源就用 try 与 finally。

</details>

<details>
<summary>Q3：限流放在哪一层？</summary>

放在最接近外部依赖的位置。入口限流挡不住内部并发放大。

</details>

<details>
<summary>Q4：什么时候必须用 to_thread？</summary>

调用的库没有异步版本，且单次耗时明显。否则事件循环会被卡住。

</details>

### 下一讲衔接

异步进阶讲完。接着读[子进程与信号](/backend/learn/concurrency/subprocess-signals)，看怎么安全拉起外部命令。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 提供同步世界的队列语义。异步场景可对照它的背压设计。
