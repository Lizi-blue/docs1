---
title: "Queue 通信"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 3
level: intermediate
tags: [queue, sentinel, producer-consumer]
description: "生产者消费者模型：queue.Queue 与 multiprocessing.Queue"
source_module: "queue"
api_methods:
  - "queue.Queue"
  - "multiprocessing.Queue"
  - "queue.Queue.join"
prerequisites:
  - /backend/learn/concurrency/thread-basics
  - /backend/learn/concurrency/process-basics
related_knowledge:
  - /backend/learn/concurrency/async-io
  - /backend/learn/concurrency/sync-primitives
  - /backend/learn/concurrency/executor-pools
related_components:
  - /backend/components/safe-queue
---

# Queue 通信

### 本讲要解决的问题

生产快过消费时会丢任务吗？消费者怎么知道该退出？
这一讲讲清队列的阻塞语义与哨兵结束标记。

## TL;DR

> 队列是生产者与消费者之间的缓冲。线程用 `queue.Queue`，跨进程用 `multiprocessing.Queue`。
> 结束信号用哨兵值传递。不要在消费者里假设队列会自动结束。

## 概念定义

队列是一种先进先出的缓冲区，用来解耦生产与消费的速度差。

生产者只负责放入任务。消费者只负责取出任务。队列自己带锁，作者不用手写锁。队列满时生产者阻塞，队列空时消费者阻塞。这样两端速率不同也不会丢数据。

## 原理图解

下图画出生产者、队列与消费者的握手，以及哨兵值如何逐个唤醒消费者。

<DiagramFrame src="/diagrams/queue-handshake.html" title="生产者消费者握手与哨兵（Archify 交互图）" :height="520" />

## 关键对比

| 维度 | queue.Queue | multiprocessing.Queue | asyncio.Queue |
|---|---|---|---|
| 使用范围 | 同进程内线程 | 跨进程 | 协程之间 |
| 底层实现 | 条件变量加锁 | 管道加锁 | 事件循环队列 |
| 阻塞方式 | 阻塞线程 | 阻塞进程 | await 让出控制权 |
| 放入大对象 | 引用传递 | 序列化后传递 | 引用传递 |

### 官方依据与版本差异

- [queue 官方文档](https://docs.python.org/3/library/queue.html) — 3.8 及以后接口稳定。
- [跨进程队列](https://docs.python.org/3/library/multiprocessing.html#multiprocessing.Queue) — 3.8 及以后提供 put 与 get 的超时参数。
- [PEP 371 multiprocessing](https://peps.python.org/pep-0371/) — 2.6 起进入标准库。

## API 手册：queue

<ApiTable :items='[{&quot;name&quot;: &quot;queue.Queue&quot;, &quot;rank&quot;: &quot;必会&quot;, &quot;signature&quot;: &quot;Queue(maxsize=0)&quot;, &quot;params&quot;: [{&quot;name&quot;: &quot;maxsize&quot;, &quot;type&quot;: &quot;int&quot;, &quot;default&quot;: &quot;0&quot;, &quot;desc&quot;: &quot;队列上限，0 表示不限&quot;}], &quot;returns&quot;: &quot;队列对象&quot;, &quot;methods&quot;: [&quot;put(item, block=True, timeout=None) — 放入&quot;, &quot;get(block=True, timeout=None) — 取出&quot;, &quot;task_done() — 标记完成&quot;, &quot;join() — 等全部完成&quot;, &quot;qsize() — 当前长度&quot;], &quot;effect&quot;: &quot;解耦生产与消费，自带锁与阻塞语义&quot;, &quot;scenario&quot;: &quot;线程池任务分发、结果回收&quot;, &quot;example&quot;: &quot;from queue import Queue\n\nq: Queue = Queue(maxsize=100)\nq.put(&#39;job-1&#39;)\nitem = q.get()\nq.task_done()\nq.join()&quot;, &quot;exampleLang&quot;: &quot;python&quot;}, {&quot;name&quot;: &quot;multiprocessing.Queue&quot;, &quot;rank&quot;: &quot;必会&quot;, &quot;signature&quot;: &quot;Queue(maxsize=0)&quot;, &quot;params&quot;: [{&quot;name&quot;: &quot;maxsize&quot;, &quot;type&quot;: &quot;int&quot;, &quot;default&quot;: &quot;0&quot;, &quot;desc&quot;: &quot;队列上限&quot;}], &quot;returns&quot;: &quot;跨进程队列&quot;, &quot;methods&quot;: [&quot;put(obj) — 放入，需可 pickle&quot;, &quot;get() — 取出&quot;, &quot;close() — 关闭&quot;, &quot;join_thread() — 等待后台线程收尾&quot;], &quot;effect&quot;: &quot;让父子进程或兄弟进程交换对象&quot;, &quot;scenario&quot;: &quot;进程池结果汇总、任务下发&quot;, &quot;example&quot;: &quot;import multiprocessing as mp\n\nif __name__ == &#39;__main__&#39;:\n    q = mp.Queue()\n    p = mp.Process(target=lambda: q.put(42))\n    p.start()\n    print(q.get())\n    p.join()&quot;, &quot;exampleLang&quot;: &quot;python&quot;}, {&quot;name&quot;: &quot;哨兵结束标记&quot;, &quot;rank&quot;: &quot;必会&quot;, &quot;signature&quot;: &quot;SENTINEL = None&quot;, &quot;params&quot;: [], &quot;returns&quot;: &quot;无&quot;, &quot;methods&quot;: [&quot;put(SENTINEL) — 每个消费者投一次&quot;], &quot;effect&quot;: &quot;让消费者知道没有新任务，可以退出循环&quot;, &quot;scenario&quot;: &quot;多消费者线程或进程的优雅退出&quot;, &quot;example&quot;: &quot;for _ in workers:\n    q.put(None)\n\nwhile True:\n    item = q.get()\n    if item is None:\n        q.task_done()\n        break&quot;, &quot;exampleLang&quot;: &quot;python&quot;}, {&quot;name&quot;: &quot;queue.PriorityQueue&quot;, &quot;rank&quot;: &quot;常用&quot;, &quot;signature&quot;: &quot;PriorityQueue(maxsize=0)&quot;, &quot;params&quot;: [{&quot;name&quot;: &quot;maxsize&quot;, &quot;type&quot;: &quot;int&quot;, &quot;default&quot;: &quot;0&quot;, &quot;desc&quot;: &quot;上限，0 表示不限&quot;}], &quot;returns&quot;: &quot;优先队列对象&quot;, &quot;methods&quot;: [&quot;put(item) — 放入元组，首元素为优先级&quot;, &quot;get() — 取优先级最小项&quot;], &quot;effect&quot;: &quot;按优先级而不是到达顺序消费&quot;, &quot;scenario&quot;: &quot;任务分级：告警优先于统计&quot;, &quot;example&quot;: &quot;import queue\n\nq = queue.PriorityQueue()\nq.put((2, \&quot;低\&quot;))\nq.put((1, \&quot;高\&quot;))\nprint(q.get())&quot;, &quot;exampleLang&quot;: &quot;python&quot;}, {&quot;name&quot;: &quot;multiprocessing.JoinableQueue&quot;, &quot;rank&quot;: &quot;常用&quot;, &quot;signature&quot;: &quot;JoinableQueue(maxsize=0)&quot;, &quot;params&quot;: [{&quot;name&quot;: &quot;maxsize&quot;, &quot;type&quot;: &quot;int&quot;, &quot;default&quot;: &quot;0&quot;, &quot;desc&quot;: &quot;队列上限&quot;}], &quot;returns&quot;: &quot;可计数队列&quot;, &quot;methods&quot;: [&quot;task_done() — 标记一条处理完成&quot;, &quot;join() — 等全部处理完成&quot;], &quot;effect&quot;: &quot;让主进程等到全部任务真正处理完&quot;, &quot;scenario&quot;: &quot;采集完成后统一退出&quot;, &quot;example&quot;: &quot;import multiprocessing as mp\n\nif __name__ == \&quot;__main__\&quot;:\n    q = mp.JoinableQueue()\n    q.put(1)\n    q.get()\n    q.task_done()\n    q.join()\n    print(\&quot;全部处理完成\&quot;)&quot;, &quot;exampleLang&quot;: &quot;python&quot;}]' />

## 组合用法：优雅停止的多消费者

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [Queue 通信](/backend/learn/concurrency/queue-pipe) | 队列与哨兵 |
| [多线程基础](/backend/learn/concurrency/thread-basics) | 消费者线程的创建 |
| [多进程基础](/backend/learn/concurrency/process-basics) | 跨进程版本的差别 |

### 数据流图解

<DiagramFrame src="/diagrams/queue-handshake.html" title="哨兵逐个唤醒消费者（Archify 交互图）" :height="440" />

### 分步实现

1. 建队列，容量按内存与延迟目标设定。
2. 生产者投递任务，投完投哨兵。
3. 每个消费者循环取出任务。
4. 取到哨兵就退出循环。
5. 主线程 join 全部消费者与队列。

### 对比表格

| 结束方式 | 行为 | 风险 |
|---|---|---|
| 投哨兵 | 消费者主动退出 | 哨兵数量要等于消费者数 |
| daemon 线程 | 主线程退出即消失 | 任务可能被丢弃 |
| 强制终止 | 立即停止 | 数据与锁状态不确定 |

## 完整 Demo：带哨兵的任务队列

### 场景描述

三个消费者线程处理任务队列，任务全部完成后优雅退出，并统计处理条数。

### 完整代码

```python
import threading
import time
from queue import Queue

TASKS = 30
WORKERS = 3
SENTINEL = None


def consume(tasks: Queue, counter: list) -> None:
    while True:
        item = tasks.get()
        if item is SENTINEL:
            tasks.task_done()
            return
        time.sleep(0.01)
        counter[0] += 1
        tasks.task_done()


def main() -> None:
    tasks: Queue = Queue(maxsize=50)
    counter = [0]
    workers = [
        threading.Thread(target=consume, args=(tasks, counter), daemon=True)
        for _ in range(WORKERS)
    ]
    for worker in workers:
        worker.start()
    for index in range(TASKS):
        tasks.put(index)
    for _ in workers:
        tasks.put(SENTINEL)
    tasks.join()
    print(f"处理 {counter[0]} 条")


if __name__ == "__main__":
    main()
```

### 运行方式

```bash
python3 queue_demo.py
```

### 常见误区

- 「队列空了消费者会自动退出」是错的。队列不发结束信号，要自己投哨兵。
- 「一个哨兵能唤醒全部消费者」是错的。一个哨兵只唤醒一个消费者，其余永久阻塞在 get。
- 「task_done 可有可无」是错的。少一次调用，join 就会一直等。

### 面试追问链

<details>
<summary>Q1：哨兵为什么每消费者一个？</summary>

一个哨兵只唤醒一个消费者。投一个，另外两个会永久阻塞在 get 上。

</details>

<details>
<summary>Q2：哨兵退出之后，计数器为什么用列表而不是全局变量？</summary>

闭包内改整数需要 global。列表是可变对象，闭包直接原地修改。

</details>

<details>
<summary>Q3：换成跨进程队列后，这些约定哪里会变？</summary>

任务与结果都必须可 pickle。子进程写队列后要 join_thread，否则数据可能丢。

</details>

### 下一讲衔接

线程与队列都在等 I/O，下一讲 [异步 I/O](/backend/learn/concurrency/async-io) 讲单线程事件循环怎么接手。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 把哨兵、异常回传与关闭流程封成一个类。
