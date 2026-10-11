---
title: "异步 I/O"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 4
level: advanced
tags: [asyncio, coroutine, event-loop]
description: "事件循环、协程与并发 I/O 的适用边界"
source_module: "asyncio"
api_methods:
  - "asyncio.run"
  - "asyncio.gather"
  - "asyncio.TaskGroup"
prerequisites:
  - /backend/learn/concurrency/thread-basics
related_knowledge:
  - /backend/learn/concurrency/queue-pipe
related_components:
  - /backend/components/safe-queue
---

# 异步 I/O

## TL;DR

> 协程在等待 I/O 时主动让出控制权，单线程就能撑住高并发。
> 同步库会阻塞事件循环。混用就退回串行。

## 概念定义

协程是可以暂停与恢复的函数，由事件循环调度。

`async def` 定义协程函数，`await` 交出控制权。事件循环维护就绪队列与定时器。等待网络时，循环去跑别的任务，网络就绪后再切回来。整套机制不创建线程，内存开销远小于线程模型。

## 原理图解

下图展示事件循环如何轮转就绪任务，以及阻塞调用如何卡住整个循环。

<DiagramFrame src="/diagrams/async-event-loop.html" title="事件循环轮转与阻塞点（Archify 交互图）" :height="520" />

## 关键对比

| 维度 | 多线程 | asyncio |
|---|---|---|
| 调度者 | 操作系统 | 事件循环 |
| 切换成本 | 微秒级 | 纳秒级 |
| 并发数量级 | 数百 | 数万 |
| 阻塞风险 | 只卡一个线程 | 卡住整个循环 |
| 生态依赖 | 库基本都同步 | 需要异步客户端 |

## API 手册：asyncio

<ApiTable :items='[{"name": "asyncio.run", "rank": "必会", "signature": "run(coro, debug=None)", "params": [{"name": "coro", "type": "coroutine", "default": "必填", "desc": "入口协程"}], "returns": "协程返回值", "methods": ["run() — 建循环并执行", "asyncio.get_running_loop() — 取当前循环"], "effect": "把协程作为程序入口跑起来，结束自动关闭循环", "scenario": "脚本入口、测试协程", "example": "import asyncio\n\nasync def main():\n    await asyncio.sleep(0.1)\n    return &#39;done&#39;\n\nprint(asyncio.run(main()))", "exampleLang": "python"}, {"name": "asyncio.gather", "rank": "必会", "signature": "gather(*aws, return_exceptions=False)", "params": [{"name": "aws", "type": "awaitable", "default": "必填", "desc": "一组可等待对象"}, {"name": "return_exceptions", "type": "bool", "default": "False", "desc": "为真时把异常当结果返回"}], "returns": "结果列表，顺序与入参一致", "methods": ["gather() — 并发等待全部", "as_completed() — 谁先完成先处理"], "effect": "并发发起多个 I/O，等全部完成后一次性收结果", "scenario": "并发请求多个接口、并发读写多个文件", "example": "import asyncio\n\nasync def fetch(n):\n    await asyncio.sleep(0.1)\n    return n\n\nasync def main():\n    return await asyncio.gather(*[fetch(i) for i in range(5)])\n\nprint(asyncio.run(main()))", "exampleLang": "python"}, {"name": "asyncio.TaskGroup", "rank": "常用", "signature": "TaskGroup()", "params": [], "returns": "异步上下文管理器", "methods": ["create_task(coro) — 建任务", "__aenter__ / __aexit__ — 自动等待与取消"], "effect": "结构化并发：组内任一任务失败就取消其余任务", "scenario": "需要整体成败一致的并发流程", "example": "import asyncio\n\nasync def work(i):\n    await asyncio.sleep(0.05)\n    return i\n\nasync def main():\n    async with asyncio.TaskGroup() as group:\n        tasks = [group.create_task(work(i)) for i in range(3)]\n    return [t.result() for t in tasks]\n\nprint(asyncio.run(main()))", "exampleLang": "python"}]' />

## 组合用法：异步队列加限流

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [异步 I/O](/backend/learn/concurrency/async-io) | 协程、gather、信号量 |
| [Queue 通信](/backend/learn/concurrency/queue-pipe) | 缓冲与背压思路 |
| [多线程基础](/backend/learn/concurrency/thread-basics) | 判断是否需要线程跑同步库 |

### 数据流图解

<DiagramFrame src="/diagrams/async-event-loop.html" title="异步抓取与限流（Archify 交互图）" :height="460" />

### 分步实现

1. 建信号量限制并发数。
2. 每个任务先抢信号量。
3. 任务内 await 网络调用。
4. 用完释放信号量。
5. 用 gather 收全部结果。

<CodeTabs :tabs='[{"label": "信号量限流", "lang": "python", "code": "sem = asyncio.Semaphore(10)\n\nasync def fetch(url):\n    async with sem:\n        return await client.get(url)"}, {"label": "同步库放线程", "lang": "python", "code": "await asyncio.to_thread(requests.get, url)"}]' />

### 对比表格

| 限流方式 | 位置 | 特点 |
|---|---|---|
| 信号量 | 任务内部 | 灵活，可按外部服务分别设 |
| 队列加消费者 | 生产者与消费者之间 | 天然背压 |
| 连接池上限 | 客户端层 | 配置简单，粒度粗 |

## 完整 Demo：并发抓取并限流

### 场景描述

并发抓取 20 个地址，最多同时 5 个在跑，统计成功数量与总耗时。

### 完整代码

```python
import asyncio
import time

URLS = [f"https://example.com/?p={i}" for i in range(20)]
LIMIT = 5


async def fetch(url: str, sem: asyncio.Semaphore) -> bool:
    async with sem:
        await asyncio.sleep(0.2)
        return True


async def main() -> None:
    sem = asyncio.Semaphore(LIMIT)
    start = time.perf_counter()
    results = await asyncio.gather(*(fetch(url, sem) for url in URLS))
    print(f"成功 {sum(results)} 条，耗时 {time.perf_counter() - start:.2f}s")


if __name__ == "__main__":
    asyncio.run(main())
```

### 运行方式

```bash
python3 async_fetch.py
```

### 面试追问链

<details>
<summary>Q1：为什么不能直接调用 requests？</summary>

requests 是同步库。它阻塞线程，也就阻塞整个事件循环。

</details>

<details>
<summary>Q2：asyncio.to_thread 的代价是什么？</summary>

每次调用占一个线程。线程池被打满后，异步并发退化为排队。

</details>

<details>
<summary>Q3：gather 与 TaskGroup 怎么选？</summary>

需要部分成功就选 gather。需要整体成败一致就选 TaskGroup。

</details>

### 关联组件

[进程安全队列](/backend/components/safe-queue) 提供同步世界的队列语义。异步场景可对照它的背压思路。
