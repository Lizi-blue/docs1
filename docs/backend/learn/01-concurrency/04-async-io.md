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
  - /backend/learn/concurrency/async-advanced
  - /backend/learn/concurrency/executor-pools
related_components:
  - /backend/components/safe-queue
---

# 异步 I/O

### 本讲要解决的问题

单线程怎么扛住上万并发连接？同步库为什么拖垮整个循环？
这一讲讲清事件循环的调度与协程的适用边界。

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

### 官方依据与版本差异

- [asyncio 任务与协程](https://docs.python.org/3/library/asyncio-task.html) — TaskGroup 与 timeout 自 3.11 起提供。
- [asyncio 事件循环](https://docs.python.org/3/library/asyncio-eventloop.html) — loop 接口自 3.4 起提供。
- [PEP 3156 asyncio](https://peps.python.org/pep-3156/) — 3.4 起进入标准库。

## API 手册：asyncio

<ApiTable :items='[{&quot;name&quot;:&quot;asyncio.run&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;run(coro, debug=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;coro&quot;,&quot;type&quot;:&quot;coroutine&quot;,&quot;default&quot;:&quot;必填&quot;,&quot;desc&quot;:&quot;入口协程&quot;}],&quot;returns&quot;:&quot;协程返回值&quot;,&quot;methods&quot;:[&quot;run() — 建循环并执行&quot;,&quot;asyncio.get_running_loop() — 取当前循环&quot;],&quot;effect&quot;:&quot;把协程作为程序入口跑起来，结束自动关闭循环&quot;,&quot;scenario&quot;:&quot;脚本入口、测试协程&quot;,&quot;example&quot;:&quot;import asyncio\n\nasync def main():\n    await asyncio.sleep(0.1)\n    return &#39;done&#39;\n\nprint(asyncio.run(main()))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;一个线程只能有一个运行中的循环。在协程里再调 run 会抛 RuntimeError。&quot;,&quot;raises&quot;:&quot;RuntimeError，当前线程已有运行中的循环&quot;},{&quot;name&quot;:&quot;asyncio.gather&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;gather(*aws, return_exceptions=False)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;aws&quot;,&quot;type&quot;:&quot;awaitable&quot;,&quot;default&quot;:&quot;必填&quot;,&quot;desc&quot;:&quot;一组可等待对象&quot;},{&quot;name&quot;:&quot;return_exceptions&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;False&quot;,&quot;desc&quot;:&quot;为真时把异常当结果返回&quot;}],&quot;returns&quot;:&quot;结果列表，顺序与入参一致&quot;,&quot;methods&quot;:[&quot;gather() — 并发等待全部&quot;,&quot;as_completed() — 谁先完成先处理&quot;],&quot;effect&quot;:&quot;并发发起多个 I/O，等全部完成后一次性收结果&quot;,&quot;scenario&quot;:&quot;并发请求多个接口、并发读写多个文件&quot;,&quot;example&quot;:&quot;import asyncio\n\nasync def fetch(n):\n    await asyncio.sleep(0.1)\n    return n\n\nasync def main():\n    return await asyncio.gather(*[fetch(i) for i in range(5)])\n\nprint(asyncio.run(main()))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;默认遇到第一个异常就向上抛，其余任务仍在后台跑。要收全部异常就传 return_exceptions=True。&quot;,&quot;raises&quot;:&quot;首个异常原样抛出，其余任务不会自动取消&quot;},{&quot;name&quot;:&quot;asyncio.wait&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;wait(fs, *, timeout=None, return_when=ALL_COMPLETED)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;fs&quot;,&quot;type&quot;:&quot;Task 集合&quot;,&quot;default&quot;:&quot;必填&quot;,&quot;desc&quot;:&quot;要等待的任务&quot;},{&quot;name&quot;:&quot;timeout&quot;,&quot;type&quot;:&quot;float&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;最长等待秒数&quot;},{&quot;name&quot;:&quot;return_when&quot;,&quot;type&quot;:&quot;str&quot;,&quot;default&quot;:&quot;ALL_COMPLETED&quot;,&quot;desc&quot;:&quot;返回时机策略&quot;}],&quot;returns&quot;:&quot;done 与 pending 两个集合&quot;,&quot;methods&quot;:[&quot;asyncio.wait(fs, timeout=None) — 按策略等待&quot;,&quot;asyncio.as_completed(fs) — 按完成顺序迭代&quot;],&quot;effect&quot;:&quot;拿到部分结果后继续推进其余任务&quot;,&quot;scenario&quot;:&quot;批量请求里先处理已完成部分&quot;,&quot;example&quot;:&quot;import asyncio\n\nasync def work(n):\n    await asyncio.sleep(n)\n    return n\n\nasync def main():\n    tasks = [asyncio.create_task(work(i)) for i in (0.1, 1)]\n    done, pending = await asyncio.wait(tasks, timeout=0.5)\n    print(len(done), len(pending))\n    for t in pending:\n        t.cancel()\n\nasyncio.run(main())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;3.11 起不能直接传协程，要先用 create_task 包一层。&quot;,&quot;raises&quot;:&quot;无异常，超时只让任务留在 pending 集合&quot;},{&quot;name&quot;:&quot;asyncio.TaskGroup&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;TaskGroup()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;异步上下文管理器&quot;,&quot;methods&quot;:[&quot;create_task(coro) — 建任务&quot;,&quot;__aenter__ / __aexit__ — 自动等待与取消&quot;],&quot;effect&quot;:&quot;结构化并发：组内任一任务失败就取消其余任务&quot;,&quot;scenario&quot;:&quot;需要整体成败一致的并发流程&quot;,&quot;example&quot;:&quot;import asyncio\n\nasync def work(i):\n    await asyncio.sleep(0.05)\n    return i\n\nasync def main():\n    async with asyncio.TaskGroup() as group:\n        tasks = [group.create_task(work(i)) for i in range(3)]\n    return [t.result() for t in tasks]\n\nprint(asyncio.run(main()))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;组内一个任务抛错，其余任务会被取消。退出 with 块时抛的是 ExceptionGroup。&quot;,&quot;raises&quot;:&quot;ExceptionGroup，组内任一任务失败时&quot;},{&quot;name&quot;:&quot;asyncio.create_task&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;create_task(coro)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;coro&quot;,&quot;type&quot;:&quot;coroutine&quot;,&quot;default&quot;:&quot;必填&quot;,&quot;desc&quot;:&quot;要调度的协程&quot;}],&quot;returns&quot;:&quot;Task 对象&quot;,&quot;methods&quot;:[&quot;create_task() — 立即排入事件循环&quot;,&quot;Task.cancel() — 请求取消&quot;,&quot;Task.result() — 取结果&quot;],&quot;effect&quot;:&quot;把协程变成并行推进的任务&quot;,&quot;scenario&quot;:&quot;需要边跑边做其他事&quot;,&quot;example&quot;:&quot;import asyncio\n\nasync def work():\n    await asyncio.sleep(0.01)\n    return \&quot;done\&quot;\n\nasync def main():\n    task = asyncio.create_task(work())\n    await asyncio.sleep(0)\n    return await task\n\nprint(asyncio.run(main()))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;要保存返回的 Task 引用。只创建不持有，任务可能被垃圾回收。&quot;,&quot;raises&quot;:&quot;RuntimeError，没有运行中的事件循环&quot;},{&quot;name&quot;:&quot;asyncio.wait_for&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;wait_for(aw, timeout)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;aw&quot;,&quot;type&quot;:&quot;awaitable&quot;,&quot;default&quot;:&quot;必填&quot;,&quot;desc&quot;:&quot;等待对象&quot;},{&quot;name&quot;:&quot;timeout&quot;,&quot;type&quot;:&quot;float&quot;,&quot;default&quot;:&quot;必填&quot;,&quot;desc&quot;:&quot;超时秒数&quot;}],&quot;returns&quot;:&quot;等待对象的结果&quot;,&quot;methods&quot;:[&quot;wait_for() — 到期取消并抛 TimeoutError&quot;],&quot;effect&quot;:&quot;给单个等待加截止时间&quot;,&quot;scenario&quot;:&quot;单次调用超时兜底&quot;,&quot;example&quot;:&quot;import asyncio\n\nasync def main():\n    try:\n        await asyncio.wait_for(asyncio.sleep(1), timeout=0.1)\n    except TimeoutError:\n        return \&quot;超时\&quot;\n\nprint(asyncio.run(main()))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;超时会取消被等待的协程。取消后的清理逻辑要自己写。&quot;,&quot;raises&quot;:&quot;TimeoutError，到期后取消被等待对象&quot;},{&quot;name&quot;:&quot;asyncio.sleep&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;sleep(delay, result=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;delay&quot;,&quot;type&quot;:&quot;float&quot;,&quot;default&quot;:&quot;必填&quot;,&quot;desc&quot;:&quot;秒数，0 表示让出一次&quot;}],&quot;returns&quot;:&quot;延迟后的 result&quot;,&quot;methods&quot;:[&quot;sleep(0) — 主动让出执行权&quot;],&quot;effect&quot;:&quot;挂起当前协程但不阻塞线程&quot;,&quot;scenario&quot;:&quot;轮询间隔与节流&quot;,&quot;example&quot;:&quot;import asyncio\n\nasync def main():\n    await asyncio.sleep(0)\n    await asyncio.sleep(0.01)\n    return \&quot;ok\&quot;\n\nprint(asyncio.run(main()))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;它只挂起当前协程，不阻塞线程。线程里的定时器不能用它。&quot;,&quot;raises&quot;:&quot;CancelledError，所在任务被取消时&quot;}]' />

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

### 常见误区

- 「协程是更快的线程」是错的。协程只在 await 时让出，阻塞调用会卡住整个循环。
- 「把 requests 放进协程就能并发」是错的。requests 是同步库，要改用异步客户端或 to_thread。
- 「gather 与 TaskGroup 随便换」是错的。一个允许部分成功，一个要求整体成败一致。

### 面试追问链

<details>
<summary>Q1：为什么不能直接调用 requests？</summary>

requests 是同步库。它阻塞线程，也就阻塞整个事件循环。

</details>

<details>
<summary>Q2：改用 to_thread 绕开阻塞，代价是什么？</summary>

每次调用占一个线程。线程池被打满后，异步并发退化为排队。

</details>

<details>
<summary>Q3：并发发起多个任务后，gather 与 TaskGroup 怎么选？</summary>

需要部分成功就选 gather。需要整体成败一致就选 TaskGroup。

</details>

### 下一讲衔接

本域路径到此收尾，可看组件 [进程安全队列](/backend/components/safe-queue) 复用同步队列语义。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 提供同步世界的队列语义。异步场景可对照它的背压思路。
