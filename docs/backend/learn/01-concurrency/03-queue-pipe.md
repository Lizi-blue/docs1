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



### 队列类型

<ApiTable :items='[{"name":"queue.Queue","rank":"必会","signature":"Queue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0","desc":"队列上限，0 表示不限"}],"returns":"队列对象","methods":["qsize() — 当前长度","Queue.put_nowait(item) — 不阻塞入队","Queue.get_nowait() — 不阻塞出队","Queue.empty() — 判断是否为空","Queue.full() — 判断是否已满"],"effect":"解耦生产与消费，自带锁与阻塞语义","scenario":"线程池任务分发、结果回收","example":"from queue import Queue\n\nq: Queue = Queue(maxsize=100)\nq.put(&#39;job-1&#39;)\nitem = q.get()\nq.task_done()\nq.join()","exampleLang":"python","pitfall":"qsize 与 empty 只是瞬时快照。多线程下据此做控制会误判。","raises":"queue.Empty 与 queue.Full，非阻塞或超时时抛出"},{"name":"queue.LifoQueue","rank":"常用","signature":"LifoQueue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0","desc":"队列上限，0 表示不限"}],"returns":"后进先出队列对象","effect":"让最后放入的任务最先被取走","scenario":"深度优先的目录遍历、回溯类任务","example":"from queue import LifoQueue\n\nq = LifoQueue()\nq.put(1)\nq.put(2)\nprint(q.get())","exampleLang":"python","pitfall":"LIFO 顺序会让先入任务长期得不到执行。要求公平时不要用它。","raises":"queue.Empty 与 queue.Full，非阻塞或超时时抛出"},{"name":"queue.SimpleQueue","rank":"常用","signature":"SimpleQueue()","params":[],"returns":"无界简单队列对象","effect":"用更少的锁开销做线程间传递","scenario":"高频日志收集、简单生产消费","example":"from queue import SimpleQueue\n\nq = SimpleQueue()\nq.put(&#39;a&#39;)\nprint(q.get())","exampleLang":"python","pitfall":"它没有 maxsize 与 task_done，不能用来做背压。","raises":"queue.Empty，非阻塞取值且队列为空时"},{"name":"multiprocessing.Queue","rank":"必会","signature":"Queue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0","desc":"队列上限"}],"returns":"跨进程队列","methods":["close() — 关闭","join_thread() — 等待后台线程收尾"],"effect":"让父子进程或兄弟进程交换对象","scenario":"进程池结果汇总、任务下发","example":"import multiprocessing as mp\n\nif __name__ == &#39;__main__&#39;:\n    q = mp.Queue()\n    p = mp.Process(target=lambda: q.put(42))\n    p.start()\n    print(q.get())\n    p.join()","exampleLang":"python","pitfall":"父子进程两侧各有一层缓冲。put 之后要 close 与 join_thread 才能保证送达。","raises":"queue.Empty 与 queue.Full，超时或队列已关闭"},{"name":"queue.PriorityQueue","rank":"常用","signature":"PriorityQueue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0","desc":"上限，0 表示不限"}],"returns":"优先队列对象","effect":"按优先级而不是到达顺序消费","scenario":"任务分级：告警优先于统计","example":"import queue\n\nq = queue.PriorityQueue()\nq.put((2, \"低\"))\nq.put((1, \"高\"))\nprint(q.get())","exampleLang":"python","pitfall":"元素按元组逐项比较，优先级相同时会比第二个字段。字段不可比较就抛 TypeError。","raises":"TypeError，元素之间无法比较时抛出"},{"name":"multiprocessing.JoinableQueue","rank":"常用","signature":"JoinableQueue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0","desc":"队列上限"}],"returns":"可计数队列","effect":"让主进程等到全部任务真正处理完","scenario":"采集完成后统一退出","example":"import multiprocessing as mp\n\nif __name__ == \"__main__\":\n    q = mp.JoinableQueue()\n    q.put(1)\n    q.get()\n    q.task_done()\n    q.join()\n    print(\"全部处理完成\")","exampleLang":"python","pitfall":"task_done 次数必须等于 get 次数，否则 join 永久阻塞。多调一次会抛 ValueError。","raises":"ValueError，task_done 次数多于 get 次数"}]' />

### 入队与出队

<ApiTable :items='[{"name":"queue.Queue.put","rank":"必会","signature":"put(item, block=True, timeout=None)","params":[{"name":"item","type":"object","default":"必填","desc":"入队对象"},{"name":"timeout","type":"float","default":"None","desc":"满时等待上限"}],"returns":"无","effect":"入队；有界队列满时按 block 决定阻塞或抛错","scenario":"生产者投递任务，形成背压","example":"import queue\n\nq = queue.Queue(maxsize=2)\nq.put(\"a\")\nq.put(\"b\", timeout=1)","pitfall":"maxsize=0 表示无上限，生产过快会吃光内存。","raises":"queue.Full"},{"name":"queue.Queue.get","rank":"必会","signature":"get(block=True, timeout=None)","params":[{"name":"block","type":"bool","default":"True","desc":"空时是否阻塞"},{"name":"timeout","type":"float","default":"None","desc":"等待上限"}],"returns":"出队对象","effect":"出队；空时按 block 决定阻塞或抛错","scenario":"消费者取任务","example":"import queue\n\nq = queue.Queue()\nq.put(1)\nprint(q.get(timeout=1))","pitfall":"get 后必须 task_done()，否则 join() 永远不返回。","raises":"queue.Empty"}]' />

### 完成与同步

<ApiTable :items='[{"name":"queue.Queue.task_done","rank":"必会","signature":"task_done()","params":[],"returns":"无","effect":"标记一条任务已处理完，供 join 计数","scenario":"等全部任务处理完再退出","example":"import queue\n\nq = queue.Queue()\nq.put(1)\nq.get()\nq.task_done()\nq.join()","pitfall":"调用次数多于 get 次数抛 ValueError。","raises":"ValueError"},{"name":"queue.Queue.join","rank":"必会","signature":"join()","params":[],"returns":"无","effect":"阻塞直到所有入队任务都被 task_done 标记","scenario":"主线程等消费者清空队列","example":"import queue\n\nq = queue.Queue()\nq.put(\"job\")\nq.get()\nq.task_done()\nq.join()\nprint(\"清空完毕\")","pitfall":"忘记 task_done 会永久阻塞；消费者异常退出同样阻塞。"}]' />

### 必会接口

<ApiTable :items='[{"name":"哨兵结束标记","rank":"必会","signature":"SENTINEL = None","params":[],"returns":"None，消费者靠循环判断退出","effect":"让消费者知道没有新任务，可以退出循环","scenario":"多消费者线程或进程的优雅退出","example":"for _ in workers:\n    q.put(None)\n\nwhile True:\n    item = q.get()\n    if item is None:\n        q.task_done()\n        break","exampleLang":"python","pitfall":"哨兵数量要与消费者数量一致。用 None 当哨兵时业务数据不能再传 None。","raises":"无异常，哨兵就是普通对象"}]' />
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
