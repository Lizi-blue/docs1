---
title: "执行器与任务编排"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 7
level: intermediate
tags: [concurrent-futures, threadpool, processpool, future]
description: "用 concurrent.futures 统一编排线程池与进程池"
source_module: "concurrent.futures"
api_methods:
  - "concurrent.futures.ThreadPoolExecutor"
  - "concurrent.futures.ProcessPoolExecutor"
  - "concurrent.futures.as_completed"
  - "concurrent.futures.wait"
  - "concurrent.futures.Future"
prerequisites:
  - /backend/learn/concurrency/thread-basics
  - /backend/learn/concurrency/process-basics
related_knowledge:
  - /backend/learn/concurrency/gil-internals
  - /backend/learn/concurrency/queue-pipe
related_components:
  - /backend/components/safe-queue
---

### 本讲要解决的问题

手工建线程、手工收结果、手工处理异常，代码很快失控。这一讲用执行器把提交、排队、取值与回收统一成一套接口。

## TL;DR

> 提交任务拿 Future。取值时才阻塞，异常也在取值时抛出。
> 线程池适合 I/O 密集，进程池适合 CPU 密集。超时只影响等待方，不影响任务本身。

## 概念定义

执行器是任务池的抽象，统一管理执行单元、任务队列与结果对象。

提交任务后立刻得到 Future。Future 记录任务状态与结果。执行单元从队列取任务执行，并把结果写回 Future。调用方在需要结果时取用。取值、超时、取消与批量等待都通过 Future 完成。线程池与进程池共用同一套接口，切换只需换类名。

## 原理图解

下图画出任务从提交到取值的一次完整生命周期，标出超时与取消的作用边界。

<DiagramFrame src="/diagrams/executor-lifecycle.html" title="执行器里一个任务的生命周期（Archify 交互图）" :height="560" />

## 关键对比

| 维度 | 线程池 | 进程池 |
|---|---|---|
| 并行能力 | 受 GIL 限制 | 真并行 |
| 任务函数要求 | 无 | 必须可 pickle |
| 参数与返回值 | 引用传递 | 序列化传递 |
| 单任务开销 | 微秒级 | 毫秒级 |
| 适合任务 | I/O 密集 | CPU 密集 |

### 官方依据与版本差异

- [concurrent.futures 官方文档](https://docs.python.org/3/library/concurrent.futures.html) — 3.8 起线程池默认上限为核数加四与 32 的较小值。
- [PEP 3148 futures](https://peps.python.org/pep-3148/) — 3.2 起进入标准库。
- [Executor.shutdown](https://docs.python.org/3/library/concurrent.futures.html#concurrent.futures.Executor.shutdown) — 3.9 起支持 cancel_futures。

## API 手册：concurrent.futures

<ApiTable :items='[{&quot;name&quot;:&quot;ThreadPoolExecutor&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;ThreadPoolExecutor(max_workers=None, thread_name_prefix=\&quot;\&quot;)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;max_workers&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;min(32, CPU+4)&quot;,&quot;desc&quot;:&quot;线程数上限&quot;},{&quot;name&quot;:&quot;thread_name_prefix&quot;,&quot;type&quot;:&quot;str&quot;,&quot;default&quot;:&quot;空&quot;,&quot;desc&quot;:&quot;线程名前缀，便于日志定位&quot;}],&quot;returns&quot;:&quot;执行器对象&quot;,&quot;methods&quot;:[&quot;submit(fn, *args) — 提交单任务返回 Future&quot;,&quot;map(fn, iterable) — 顺序映射，惰性取值&quot;,&quot;shutdown(wait=True) — 停止接收并回收&quot;],&quot;effect&quot;:&quot;复用线程执行大量短任务&quot;,&quot;scenario&quot;:&quot;并发请求外部接口、并发读写文件&quot;,&quot;example&quot;:&quot;from concurrent.futures import ThreadPoolExecutor\n\nwith ThreadPoolExecutor(max_workers=4) as pool:\n    futures = [pool.submit(pow, 2, i) for i in range(5)]\n    print([f.result() for f in futures])&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;默认线程数是 min(32, CPU 数加 4)。任务长期阻塞会占满线程并排队。&quot;,&quot;raises&quot;:&quot;RuntimeError，关闭之后继续提交任务&quot;},{&quot;name&quot;:&quot;ProcessPoolExecutor&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;ProcessPoolExecutor(max_workers=None, mp_context=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;max_workers&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;CPU 核数&quot;,&quot;desc&quot;:&quot;进程数上限&quot;},{&quot;name&quot;:&quot;mp_context&quot;,&quot;type&quot;:&quot;BaseContext&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;指定 spawn 或 forkserver&quot;}],&quot;returns&quot;:&quot;执行器对象&quot;,&quot;methods&quot;:[&quot;submit() — 提交任务&quot;,&quot;map() — 顺序映射&quot;,&quot;shutdown() — 回收进程&quot;],&quot;effect&quot;:&quot;把 CPU 密集任务摊到多核&quot;,&quot;scenario&quot;:&quot;批量计算、图像处理、压缩&quot;,&quot;example&quot;:&quot;from concurrent.futures import ProcessPoolExecutor\n\ndef square(n):\n    return n * n\n\nif __name__ == \&quot;__main__\&quot;:\n    with ProcessPoolExecutor(max_workers=4) as pool:\n        print(list(pool.map(square, range(10))))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;提交的函数与参数必须可 pickle。子进程崩溃会让 Future 抛 BrokenProcessPool。&quot;,&quot;raises&quot;:&quot;BrokenProcessPool，子进程异常退出之后&quot;},{&quot;name&quot;:&quot;Future&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;Future()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;结果对象&quot;,&quot;methods&quot;:[&quot;result(timeout=None) — 阻塞取值，异常在此抛出&quot;,&quot;done() — 是否结束&quot;,&quot;cancel() — 取消未启动任务&quot;,&quot;add_done_callback(fn) — 完成回调&quot;,&quot;Future.exception(timeout=None) — 取异常，无异常返回 None&quot;,&quot;Future.running() — 是否正在执行&quot;,&quot;Future.cancelled() — 是否已被取消&quot;],&quot;effect&quot;:&quot;把异步结果变成可查询对象&quot;,&quot;scenario&quot;:&quot;需要部分结果或超时控制&quot;,&quot;example&quot;:&quot;from concurrent.futures import ThreadPoolExecutor\n\nwith ThreadPoolExecutor() as pool:\n    future = pool.submit(int, \&quot;42\&quot;)\n    print(future.result(timeout=1))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;Future 不能新建后手工执行。result 在未完成时默认永久阻塞。&quot;,&quot;raises&quot;:&quot;TimeoutError 与任务自身抛出的异常&quot;},{&quot;name&quot;:&quot;as_completed&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;as_completed(fs, timeout=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;fs&quot;,&quot;type&quot;:&quot;iterable&quot;,&quot;default&quot;:&quot;必填&quot;,&quot;desc&quot;:&quot;Future 集合&quot;},{&quot;name&quot;:&quot;timeout&quot;,&quot;type&quot;:&quot;float&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;整体等待上限&quot;}],&quot;returns&quot;:&quot;迭代器，谁先完成先产出&quot;,&quot;methods&quot;:[&quot;as_completed() — 按完成顺序迭代&quot;],&quot;effect&quot;:&quot;先处理已完成的任务，缩短整体等待&quot;,&quot;scenario&quot;:&quot;多个接口取数，谁快先用谁&quot;,&quot;example&quot;:&quot;from concurrent.futures import ThreadPoolExecutor, as_completed\n\nwith ThreadPoolExecutor() as pool:\n    futures = [pool.submit(pow, 2, i) for i in range(3)]\n    for future in as_completed(futures):\n        print(future.result())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;它只给已完成的 Future，原始顺序丢失。超时抛 TimeoutError 不代表任务停跑。&quot;,&quot;raises&quot;:&quot;TimeoutError，到期仍有任务未完成&quot;},{&quot;name&quot;:&quot;wait&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;wait(fs, timeout=None, return_when=ALL_COMPLETED)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;fs&quot;,&quot;type&quot;:&quot;iterable&quot;,&quot;default&quot;:&quot;必填&quot;,&quot;desc&quot;:&quot;Future 集合&quot;},{&quot;name&quot;:&quot;return_when&quot;,&quot;type&quot;:&quot;str&quot;,&quot;default&quot;:&quot;ALL_COMPLETED&quot;,&quot;desc&quot;:&quot;FIRST_COMPLETED 等策略&quot;}],&quot;returns&quot;:&quot;done 与 not_done 两个集合&quot;,&quot;methods&quot;:[&quot;wait() — 按策略等待并分组返回&quot;,&quot;ALL_COMPLETED — 全部完成才返回&quot;,&quot;FIRST_COMPLETED — 首个完成就返回&quot;,&quot;FIRST_EXCEPTION — 首个异常就返回&quot;],&quot;effect&quot;:&quot;在批量任务上做分阶段推进&quot;,&quot;scenario&quot;:&quot;拿到首个结果就继续，其余后台跑&quot;,&quot;example&quot;:&quot;from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED\n\nwith ThreadPoolExecutor() as pool:\n    futures = [pool.submit(pow, 2, i) for i in range(3)]\n    done, pending = wait(futures, timeout=1, return_when=FIRST_COMPLETED)\n    print(len(done), len(pending))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;wait 不会取消未完成任务。返回的是集合，拿不到结果顺序。&quot;,&quot;raises&quot;:&quot;无异常，超时只影响返回的集合&quot;}]' />

## 组合用法：限流并发抓取加超时兜底

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [执行器与任务编排](/backend/learn/concurrency/executor-pools) | 池与 Future |
| [同步原语与死锁](/backend/learn/concurrency/sync-primitives) | 信号量限流 |
| [GIL 内部机制](/backend/learn/concurrency/gil-internals) | 选择线程池还是进程池 |

### 数据流图解

<DiagramFrame src="/diagrams/executor-lifecycle.html" title="提交、执行、取值与超时（Archify 交互图）" :height="460" />

### 分步实现

1. 建池并固定线程数。
2. 提交任务并收集 Future。
3. 用 as_completed 按完成顺序处理。
4. 对超时的 Future 记录并放弃等待。
5. 退出 with 块时统一回收。

### 对比表格

| 取值方式 | 顺序 | 阻塞点 | 适用 |
|---|---|---|---|
| result | 按提交顺序 | 每个结果 | 结果互相依赖 |
| map | 按输入顺序 | 迭代时 | 批量转换 |
| as_completed | 按完成顺序 | 无 | 尽快消费 |
| wait | 按策略 | 策略满足时 | 分批推进 |

## 完整 Demo：带超时的批量任务

### 场景描述

十个任务并发执行，其中一个故意慢。整体等待上限两秒，超时的任务只记录不阻塞。

### 完整代码

```python
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError, as_completed


def work(index: int) -> str:
    if index == 3:
        time.sleep(5)
    else:
        time.sleep(0.1)
    return f"任务 {index} 完成"


def main() -> None:
    done: list[str] = []
    slow: list[int] = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(work, index): index for index in range(10)}
        for future in as_completed(futures, timeout=2):
            try:
                done.append(future.result())
            except TimeoutError:
                slow.append(futures[future])
    print(f"完成 {len(done)} 个，未完成 {len(slow)} 个")


if __name__ == "__main__":
    main()
```

### 运行方式

```bash
python3 executor_demo.py
```

### 常见误区

- 以为超时会终止任务。任务仍在执行，只是调用方不再等。
- 以为 cancel 能中断正在跑的任务。它只对未启动的任务有效。
- 在进程池里传 lambda 或局部函数。spawn 方式下无法 pickle。
- 用无界队列提交上百万任务。内存会先于 CPU 出问题。

### 面试追问链

<details>
<summary>Q1：Future 的异常在哪一步抛出？</summary>

在 result() 时抛出，不是在提交时。提交阶段只负责排队。

</details>

<details>
<summary>Q2：超时之后任务会怎样？</summary>

线程或进程继续执行到结束。结果写回 Future，但没人读取。

</details>

<details>
<summary>Q3：池大小怎么定？</summary>

CPU 密集取核数。I/O 密集按等待比与外部限流估算，再压测校准。

</details>

<details>
<summary>Q4：进程池为什么要求函数可 pickle？</summary>

子进程需要重建调用对象。spawn 与 forkserver 都按模块名导入并传参。

</details>

### 下一讲衔接

执行器解决了任务编排。任务之间还要共享大数据时，拷贝成本成为新瓶颈。接着读[共享内存与进程间数据](/backend/learn/concurrency/shared-memory)。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 用队列与哨兵补充执行器缺失的流式消费能力。
