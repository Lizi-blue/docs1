---
title: "并发问题定位"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 11
level: advanced
tags: [debugging, faulthandler, profiling, backpressure]
description: "用栈、指标与剖析判断卡死、变慢与积压"
source_module: "faulthandler"
api_methods:
  - "faulthandler.dump_traceback"
  - "threading.enumerate"
  - "asyncio.loop.set_debug"
  - "cProfile.Profile"
  - "queue.Queue.qsize"
prerequisites:
  - /backend/learn/concurrency/sync-primitives
  - /backend/learn/concurrency/gil-internals
related_knowledge:
  - /backend/learn/concurrency/sync-primitives
  - /backend/learn/concurrency/executor-pools
  - /backend/learn/concurrency/async-advanced
related_components:
  - /backend/components/safe-queue
---

### 本讲要解决的问题

并发问题难在复现。加日志往往改变时序，问题就消失了。这一讲给出一套不改代码的定位顺序。

## TL;DR

> 先看指标分清「慢」与「卡死」。卡死就抓全部线程栈。变慢就看热点与锁等待。
> 抓栈不需要重启，也不改变时序。

## 概念定义

定位并发问题分三层：观测、归因、验证。

观测层回答现象是什么，看队列长度、等待耗时与线程数。归因层回答卡在哪，看线程栈与调用链。验证层回答改动是否有效，用同一套指标回归。三层顺序不能颠倒。先改代码再找原因，通常会把现场破坏掉。

## 原理图解

下图给出三步定位的动作顺序：确认现象、抓栈对锁、改代码并回归。

<DiagramFrame src="/diagrams/debug-triage.html" title="并发卡死的三步定位（Archify 交互图）" :height="520" />

## 关键对比

| 现象 | 先看什么 | 常见根因 |
|---|---|---|
| 请求长时间不返回 | 全部线程栈 | 死锁或外部依赖阻塞 |
| 吞吐突然下降 | 队列长度与线程数 | 消费不足或锁争用 |
| CPU 打满但很慢 | 热点函数 | 忙等或过度切换 |
| 内存持续上涨 | 队列积压 | 无界队列无背压 |
| 事件循环告警 | 慢回调日志 | 同步调用阻塞循环 |

### 官方依据与版本差异

- [faulthandler 官方文档](https://docs.python.org/3/library/faulthandler.html) — 3.3 起提供。
- [asyncio 调试模式](https://docs.python.org/3/library/asyncio-dev.html#debug-mode) — 3.7 起可在 run 上开启慢回调告警。
- [cProfile 官方文档](https://docs.python.org/3/library/profile.html) — 3.12 起实现改为 _lsprof。

## API 手册：定位工具



### 必会接口

<ApiTable :items='[{"name":"faulthandler.dump_traceback","rank":"必会","signature":"dump_traceback(file=sys.stderr, all_threads=True)","params":[{"name":"all_threads","type":"bool","default":"True","desc":"是否打印所有线程"}],"returns":"None，调用栈写到 file 指定的流","methods":["dump_traceback() — 立即抓一次","dump_traceback_later() — 定时抓"],"effect":"在卡死瞬间打印全部调用栈","scenario":"线上疑似死锁","example":"import faulthandler\n\nfaulthandler.dump_traceback()","exampleLang":"python","pitfall":"它写向 stderr 或已打开的文件描述符，不会主动结束进程。","raises":"无异常，转储失败时保持静默"},{"name":"threading.enumerate","rank":"必会","signature":"enumerate()","params":[],"returns":"线程对象列表","methods":["enumerate() — 列出存活线程","thread.name — 线程名","thread.is_alive() — 是否存活"],"effect":"把线程数与名字对到业务角色","scenario":"确认线程是否泄漏","example":"import threading\n\nprint([t.name for t in threading.enumerate()])","exampleLang":"python","pitfall":"只列 Python 线程，看不到线程池内部状态。数量下降不代表资源已回收。","raises":"无异常，只读线程列表"}]' />

### 常用接口

<ApiTable :items='[{"name":"faulthandler.disable","rank":"常用","signature":"disable()","params":[],"returns":"None，转储开关在模块级生效","methods":["faulthandler.disable() — 关闭故障转储","faulthandler.is_enabled() — 查询是否开启"],"effect":"关掉崩溃时的调用栈转储","scenario":"临时接管崩溃处理、减少日志噪声","example":"import faulthandler\n\nfaulthandler.disable()\nprint(faulthandler.is_enabled())","exampleLang":"python","pitfall":"关闭后原有的信号处理器也一起撤销，崩溃时只剩默认行为。","raises":"无异常，重复调用也安全"},{"name":"faulthandler.cancel_dump_traceback_later","rank":"常用","signature":"cancel_dump_traceback_later()","params":[],"returns":"None，只撤销待触发的定时器","methods":["faulthandler.cancel_dump_traceback_later() — 取消定时转储","faulthandler.register(signum, file=...) — 为信号注册转储"],"effect":"任务提前结束时取消定时抓栈","scenario":"给一次性任务加看门狗","example":"import faulthandler\n\nfaulthandler.dump_traceback_later(30, exit=True)\nfaulthandler.cancel_dump_traceback_later()","exampleLang":"python","pitfall":"没有待取消的定时器时调用会抛 RuntimeError。","raises":"RuntimeError，没有待取消的定时器时"},{"name":"asyncio.loop.set_debug","rank":"常用","signature":"set_debug(enabled)","params":[{"name":"enabled","type":"bool","default":"必填","desc":"是否开启调试"}],"returns":"None，调试开关挂在循环上","methods":["set_debug(True) — 打开慢回调告警","get_debug() — 查询状态"],"effect":"让阻塞事件循环的回调暴露出来","scenario":"异步服务响应变慢","example":"import asyncio\n\nasync def main():\n    asyncio.get_running_loop().set_debug(True)\n    await asyncio.sleep(0)\n\nasyncio.run(main())","exampleLang":"python","pitfall":"它给事件循环加开销。生产常开会让吞吐下降。","raises":"无异常，只改调试开关"},{"name":"cProfile.Profile","rank":"常用","signature":"Profile()","params":[],"returns":"剖析对象","methods":["enable() 与 disable() — 开始与结束采样","print_stats(sort=\"cumulative\") — 输出热点"],"effect":"给出函数级耗时与调用次数","scenario":"定位 CPU 热点","example":"import cProfile\n\nprof = cProfile.Profile()\nprof.enable()\nsum(i * i for i in range(100000))\nprof.disable()\nprof.print_stats(sort=\"cumulative\")","exampleLang":"python","pitfall":"它只统计 Python 层调用，测不准 C 扩展与 I/O 等待。","raises":"无异常，剖析失败时只丢样本"},{"name":"queue.Queue.qsize","rank":"常用","signature":"qsize()","params":[],"returns":"当前元素个数","methods":["qsize() — 读取积压量","empty() 与 full() — 状态判断","join() — 等消费完"],"effect":"把背压从感觉变成数字","scenario":"判断生产是否快于消费","example":"import queue\n\nq = queue.Queue(maxsize=10)\nq.put(1)\nprint(q.qsize())","exampleLang":"python","pitfall":"qsize 是瞬时值，多线程下不可靠，别用它做精确限流。","raises":"无异常，读到的只是瞬时值"}]' />
## 组合用法：给并发服务加观测点

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [并发问题定位](/backend/learn/concurrency/concurrency-debugging) | 栈与指标 |
| [同步原语与死锁](/backend/learn/concurrency/sync-primitives) | 对锁判断 |
| [执行器与任务编排](/backend/learn/concurrency/executor-pools) | 池内排队观测 |

### 数据流图解

<DiagramFrame src="/diagrams/debug-triage.html" title="指标、栈与验证的推进顺序（Archify 交互图）" :height="460" />

### 分步实现

1. 给队列与池加长度与耗时指标。
2. 卡死告警触发时自动抓栈。
3. 按栈里的等待点判断是锁还是外部依赖。
4. 改一处并只改一处。
5. 用同一指标回归对比。

### 对比表格

| 手段 | 是否需要重启 | 是否改变时序 | 适用 |
|---|---|---|---|
| 抓线程栈 | 否 | 否 | 卡死与死锁 |
| 加日志 | 是 | 是 | 复现困难时 |
| 剖析热点 | 否 | 轻微 | CPU 变慢 |
| 指标监控 | 否 | 否 | 长期趋势 |
| 断点调试 | 是 | 是 | 本地复现 |

## 完整 Demo：卡死现场三段式采集

### 场景描述

两个线程以相反顺序获取两把锁，制造死锁。主线程抓一次全部线程栈，再把栈里的等待点打印出来。

### 完整代码

```python
import faulthandler
import threading
import time

first = threading.Lock()
second = threading.Lock()


def worker_a() -> None:
    with first:
        time.sleep(0.2)
        with second:
            print("A 完成")


def worker_b() -> None:
    with second:
        time.sleep(0.2)
        with first:
            print("B 完成")


if __name__ == "__main__":
    faulthandler.dump_traceback_later(1, repeat=False)
    threads = [threading.Thread(target=worker_a, name="A"), threading.Thread(target=worker_b, name="B")]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=2)
    print(f"仍有存活线程 {[t.name for t in threads if t.is_alive()]}")
```

### 运行方式

```bash
python3 deadlock_triage.py
```

### 常见误区

- 先加日志再找原因。日志会改变时序，现场可能消失。
- 只看单线程栈。死锁要靠两个线程的等待点配对。
- 把 CPU 高当成瓶颈。忙等与过度切换也会打满。
- 不看队列长度。积压往往先于超时出现。

### 面试追问链

<details>
<summary>Q1：怎么在不重启的情况下看卡在哪？</summary>

用 faulthandler 抓全部线程栈，或用信号触发抓栈。

</details>

<details>
<summary>Q2：怎么区分慢与死？</summary>

看队列长度与等待耗时的趋势。持续上涨且线程都在等待就是死。

</details>

<details>
<summary>Q3：为什么要先只改一处？</summary>

同时改多处就无法归因。一次只改一处，回归指标才可信。

</details>

<details>
<summary>Q4：异步服务怎么发现阻塞？</summary>

开事件循环调试模式。慢回调会打出告警与调用位置。

</details>

### 下一讲衔接

定位讲完。最后一讲看异步与线程如何协作，把两种世界接起来。接着读[异步与线程协作](/backend/learn/concurrency/asyncio-thread-bridge)。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 的哨兵与异常回传设计，可直接复用到观测点采集。
