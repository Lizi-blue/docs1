---
title: "事件循环原理与 await 语义"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 14
level: advanced
tags: [asyncio, event-loop, await, coroutine, callback]
description: "await 挂起谁、恢复谁：两个任务同时等待时的回调顺序"
prerequisites:
  - /backend/learn/concurrency/async-io
related_knowledge:
  - /backend/learn/concurrency/async-advanced
  - /backend/learn/concurrency/thread-communication
---

### 本讲要解决的问题

`await` 到底交出什么。两个任务同时等待时，谁先恢复。
顺序与书写顺序是什么关系。写错顺序会怎样。

### 本讲要解决的问题

- 事件循环靠什么结构调度任务。
- `await` 时刻发生了什么。
- 两个任务都在等待时，恢复顺序由谁决定。

## TL;DR

事件循环是单线程调度器。它维护就绪回调、定时器与 IO 事件三份结构。
`await` 只挂起当前协程，把控制权交回循环。循环接着跑别的就绪任务。
两个任务同时等待时，循环里同时存在两个回调。谁先就绪谁先恢复。
恢复顺序看事件完成顺序，不看 `await` 的书写顺序。

## 概念定义

**协程**：可以暂停与恢复的函数。挂起时保存帧，恢复时从断点继续。

**任务**：协程的调度单位。`create_task` 之后协程才开始被循环推进。

**事件循环**：单线程调度器。循环体内做三件事：跑就绪回调、检查定时器、等待 IO。

**挂起**：协程遇到未完成的等待对象，注册回调后让出控制权。

**恢复**：回调被触发后，循环把该协程重新排进就绪队列，下一轮继续执行。

## 原理图解

下图回答一个问题：两个任务同时等待时，谁先恢复。

<DiagramFrame src="/diagrams/event-loop-suspend-resume.html" title="事件循环与 await：两个任务同时等待时的挂起与恢复顺序（Archify 交互图）" :height="560" />

```text
事件循环一轮
├── 1. 取就绪回调并执行（协程从这里恢复）
├── 2. 检查定时器，到点就把回调放进就绪队列
└── 3. 等 IO，谁就绪就把谁的回调放进就绪队列
```

## 关键对比

先分清两种写法。它们的语义完全不同。

```python
# 写法一：串行。task1 跑完才轮到 print
result1 = await task1()
print(123)
result2 = await task2()

# 写法二：并发。两个任务先被调度，再分别等待
t1 = asyncio.create_task(task1())
t2 = asyncio.create_task(task2())
result1 = await t1
print(123)
result2 = await t2
```

| 问题 | 写法一（直接 await 协程） | 写法二（先建任务） |
|---|---|---|
| 同时有几个任务在等 | 1 个 | 2 个 |
| `print(123)` 何时执行 | task1 完成后 | `await t1` 完成后 |
| 是否并发 | 否 | 是 |
| 恢复顺序 | 无竞争 | 由就绪顺序决定 |

| 恢复场景 | 结果 |
|---|---|
| t2 先完成、t1 后完成 | 循环先恢复 t2 的等待者。主协程仍在 `await t1` 处，先打印不了 |
| t1 完成后主协程恢复 | 先执行 `print(123)`，再 `await t2` 直接拿到已存结果 |
| 两者同一轮完成 | 按回调注册顺序执行，即先被 await 的先恢复 |

### 官方依据与版本差异

- [asyncio 事件循环](https://docs.python.org/3/library/asyncio-eventloop.html) — 3.13 起提供 `loop.call_soon` 等调度接口。`run` 与 `TaskGroup` 的行为在 3.11 后稳定。
- [asyncio 协程与任务](https://docs.python.org/3/library/asyncio-task.html) — 3.11 起 `TaskGroup` 正式可用。3.13 起取消语义更严格。
- [PEP 492](https://peps.python.org/pep-0492/) — `async` 与 `await` 语法自 3.5 起提供，3.7 起成为关键字。

## API 手册：事件循环与挂起

### 事件循环与任务

<ApiTable :items='[{"name":"asyncio.create_task","rank":"必会","signature":"create_task(coro)","params":[{"name":"coro","type":"coroutine","default":"必填","desc":"要调度的协程"}],"returns":"Task 对象","methods":["cancel() — 请求取消","done() — 是否结束","result() — 取结果或抛异常"],"effect":"把协程交给循环，立即排队","scenario":"需要两个任务同时等待","example":"task = asyncio.create_task(work())\nawait task","exampleLang":"python","pitfall":"只创建不保存引用，任务可能被回收。要 await 它或持有引用。","raises":"RuntimeError，没有运行中的循环"},{"name":"loop.call_soon","rank":"常用","signature":"call_soon(callback, *args)","params":[{"name":"callback","type":"callable","default":"必填","desc":"下一轮要执行的回调"}],"returns":"Handle 对象","effect":"把回调放进就绪队列","scenario":"理解挂起与恢复的最小手段","example":"loop.call_soon(print, \"下一轮执行\")","exampleLang":"python","pitfall":"回调里不能做阻塞操作。会卡住整轮循环。","raises":"RuntimeError，循环已关闭"}]' />

### 挂起与恢复

<ApiTable :items='[{"name":"asyncio.Future","rank":"必会","signature":"Future()","params":[],"returns":"可等待对象","methods":["set_result(value) — 置结果并唤醒等待者","set_exception(exc) — 置异常","add_done_callback(fn) — 注册完成回调"],"effect":"表达一个尚未完成的结果","scenario":"封装回调式接口为可等待对象","example":"fut = loop.create_future()\nfut.add_done_callback(lambda f: print(f.result()))","exampleLang":"python","pitfall":"先 await 后置结果最稳。先置结果再 await 会立刻返回。","raises":"InvalidStateError，重复置结果时抛出"},{"name":"asyncio.gather","rank":"常用","signature":"gather(*aws, return_exceptions=False)","params":[{"name":"aws","type":"awaitable","default":"必填","desc":"要并发等待的对象"},{"name":"return_exceptions","type":"bool","default":"False","desc":"为真时把异常当结果返回"}],"returns":"结果列表，顺序与传入顺序一致","effect":"并发等待多个任务","scenario":"需要一次性拿到多个结果","example":"results = await asyncio.gather(t1, t2)","exampleLang":"python","pitfall":"结果顺序按传入顺序，不按完成顺序。不要用完成顺序推断。","raises":"第一个未处理的异常，除非 return_exceptions 为真"}]' />

## 组合用法：可观察的恢复顺序

### 组合了哪些知识？

组合了三件事：任务创建、等待时长差异、结果收集。

### 数据流图解

```text
任务 A（0.1 秒）──┐
                  ├──▶ 事件循环按就绪顺序恢复 ──▶ 收集结果
任务 B（0.3 秒）──┘
```

### 分步实现

1. 建两个任务。让两个协程各自等待不同时长。
2. 并发等待。用 `gather` 收集。
3. 打印完成顺序。观察恢复顺序与等待时长的关系。
4. 换成串行写法。对比总耗时。

### 对比表格

| 写法 | 总耗时 | 完成顺序 | 结果顺序 |
|---|---|---|---|
| 串行 await | 两段之和 | 固定为书写顺序 | 与书写一致 |
| gather | 取最长的一段 | 由等待时长决定 | 与传入顺序一致 |

## 完整 Demo：串行与并发的顺序差异

### 场景描述

用两个不同时长的任务对比串行与并发。打印完成顺序与总耗时。

### 完整代码

```python
"""串行与并发：观察恢复顺序与总耗时。"""

import asyncio
import time


async def job(name, seconds):
    await asyncio.sleep(seconds)
    print(f"{name} 完成于 {time.monotonic():.2f}")
    return name


async def sequential():
    print("串行开始")
    await job("A", 0.1)
    print(123)
    await job("B", 0.3)


async def concurrent():
    print("并发开始")
    t1 = asyncio.create_task(job("A", 0.1))
    t2 = asyncio.create_task(job("B", 0.3))
    await t1
    print(123)
    await t2


if __name__ == "__main__":
    start = time.monotonic()
    asyncio.run(sequential())
    print(f"串行耗时 {time.monotonic() - start:.2f}")
    start = time.monotonic()
    asyncio.run(concurrent())
    print(f"并发耗时 {time.monotonic() - start:.2f}")
```

### 运行方式

```bash
python3 demo.py
```

串行耗时接近 0.4 秒。并发耗时接近 0.3 秒。
并发版本里 A 先完成，`print(123)` 仍在 A 之后、B 之前执行。

### 常见误区

- 以为 `await` 是「同时等待两个」。直接 await 协程是串行。
- 把 `gather` 的结果顺序当成完成顺序。结果顺序等于传入顺序。

### 面试追问链

<details>
<summary>await 时控制权交给了谁？</summary>

交回事件循环。循环继续跑就绪回调，不保证回到你刚等待的那个协程。
</details>

<details>
<summary>如果 B 先完成、A 后完成，主协程会先打印吗？</summary>

不会。主协程挂在 `await A` 上。B 只在任务内完成，主协程要等 A 才恢复。
</details>

<details>
<summary>同一轮里两个都就绪，谁先？</summary>

按回调注册顺序。先被 await 的先注册，所以先恢复。
</details>

<details>
<summary>阻塞调用会怎样？</summary>

整个循环停住。所有任务都不能推进，等于把并发退化成串行。
</details>

### 下一讲衔接

下一讲 [异步与线程协作](/backend/learn/concurrency/asyncio-thread-bridge) 讲两种模型混用。重点是把阻塞调用挪出循环。

### 关联组件

暂无。并发原语在组件页中按需组合。
