---
title: "队列与管道通信"
type: knowledge
domain: backend
knowledge_domain: communication
order: 1
level: intermediate
tags: [queue, pipe, sentinel, backpressure]
description: "线程队列、进程队列与管道的阻塞语义与退出约定"
source_module: "queue"
api_methods:
  - "queue.Queue"
  - "queue.Queue.put"
  - "queue.Queue.get"
  - "multiprocessing.Queue"
  - "multiprocessing.Pipe"
prerequisites:
  - /backend/learn/concurrency/thread-basics
  - /backend/learn/concurrency/process-basics
related_knowledge:
  - /backend/learn/concurrency/queue-pipe
  - /backend/learn/concurrency/sync-primitives
  - /backend/learn/communication/shared-state
related_components:
  - /backend/components/safe-queue
---

# 队列与管道通信

### 本讲要解决的问题

生产者比消费者快时，多出来的任务放在哪里？
消费者又怎么知道该收工了？
这一讲把线程队列、进程队列与管道放在一起对照。
目标是先选对通道，再定好退出约定。

## TL;DR

> 线程内用 `queue.Queue`，跨进程用 `multiprocessing.Queue`。
> 两者都自带锁，满了阻塞写，空了阻塞读。
> 结束信号靠哨兵值传递，哨兵数量等于消费者数量。
> 有界队列是背压工具，无界队列会把内存吃光。

## 概念定义

通信指两个并发单元交换数据或对齐节奏。
同一进程内的线程共享地址空间，交换对象只传引用。
不同进程各有独立地址空间，交换对象要先序列化。
队列在两者之上加了缓冲、加锁与阻塞语义。
管道是最小的通信原语，队列在管道之上加了锁与计数。
选择依据有三条：数据体积、方向数与退出方式。

## 原理图解

下图画出生产者、队列与消费者的握手，以及哨兵逐个唤醒消费者的次序。

<DiagramFrame src="/diagrams/queue-handshake.html" title="生产者消费者握手与哨兵（Archify 交互图）" :height="520" />

## 关键对比

| 维度 | queue.Queue | multiprocessing.Queue | multiprocessing.Pipe |
|---|---|---|---|
| 作用范围 | 同进程线程 | 跨进程 | 跨进程 |
| 底层实现 | 条件变量加锁 | 管道加锁加后台线程 | 管道 |
| 传大对象 | 引用传递 | 序列化传递 | 序列化传递 |
| 是否计数 | 有长度上限 | 有长度上限 | 无长度概念 |
| 端点数 | 多对多 | 多对多 | 两端 |
| 典型用途 | 任务分发 | worker 集群 | 父子进程问答 |

### 官方依据与版本差异

- [queue 模块官方文档](https://docs.python.org/3/library/queue.html) — 3.8 起接口稳定，3.13 起新增 `Queue.shutdown`。
- [multiprocessing 队列文档](https://docs.python.org/3/library/multiprocessing.html#multiprocessing.Queue) — 3.8 起 `put` 与 `get` 支持超时参数。
- [PEP 371 multiprocessing](https://peps.python.org/pep-0371/) — 2.6 起进入标准库。

## API 手册：queue 与 multiprocessing

<ApiTable :items='[{&quot;name&quot;:&quot;queue.Queue&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;Queue(maxsize=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;maxsize&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;队列长度上限，0 表示不限制&quot;}],&quot;returns&quot;:&quot;队列对象&quot;,&quot;methods&quot;:[&quot;put(item, block=True, timeout=None) — 放入元素&quot;,&quot;get(block=True, timeout=None) — 取出元素&quot;,&quot;put_nowait(item) — 不阻塞放入&quot;,&quot;get_nowait() — 不阻塞取出&quot;,&quot;task_done() — 标记一条任务已处理&quot;,&quot;join() — 等未完成任务归零&quot;,&quot;qsize() — 当前元素数&quot;,&quot;empty() — 是否为空&quot;,&quot;full() — 是否已满&quot;],&quot;effect&quot;:&quot;自带锁与条件变量，生产者与消费者可并发存取&quot;,&quot;scenario&quot;:&quot;线程池任务分发、结果回收、流水线缓冲&quot;,&quot;example&quot;:&quot;from queue import Queue\n\nq: Queue = Queue(maxsize=10)\nq.put(\&quot;job-1\&quot;)\nitem = q.get()\nq.task_done()\nq.join()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;maxsize 为 0 时队列无上限，生产过快会吃光内存&quot;},{&quot;name&quot;:&quot;queue.Queue.put&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;put(item, block=True, timeout=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;item&quot;,&quot;type&quot;:&quot;object&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;要放入的对象&quot;},{&quot;name&quot;:&quot;block&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;True&quot;,&quot;desc&quot;:&quot;队列满时是否阻塞&quot;},{&quot;name&quot;:&quot;timeout&quot;,&quot;type&quot;:&quot;float&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;阻塞等待的秒数&quot;}],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;队列满时挂起调用线程，直到有空位或超时&quot;,&quot;scenario&quot;:&quot;生产者限速写入，用队列长度做背压&quot;,&quot;example&quot;:&quot;try:\n    q.put(item, timeout=0.5)\nexcept Exception:\n    pass  # 队列满，稍后重试&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;block 为 False 且队列满时抛 Full，不是静默丢弃&quot;},{&quot;name&quot;:&quot;queue.Queue.get&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;get(block=True, timeout=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;block&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;True&quot;,&quot;desc&quot;:&quot;队列空时是否阻塞&quot;},{&quot;name&quot;:&quot;timeout&quot;,&quot;type&quot;:&quot;float&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;阻塞等待的秒数&quot;}],&quot;returns&quot;:&quot;队首元素&quot;,&quot;effect&quot;:&quot;队列空时挂起调用线程，直到有元素或超时&quot;,&quot;scenario&quot;:&quot;消费者循环取任务，配超时以支持退出检查&quot;,&quot;example&quot;:&quot;from queue import Empty\n\ntry:\n    item = q.get(timeout=0.2)\nexcept Empty:\n    continue&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;超时抛 Empty。不捕获就退出消费者循环&quot;},{&quot;name&quot;:&quot;queue.Queue.task_done&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;task_done()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;None&quot;,&quot;methods&quot;:[&quot;join() — 与 task_done 配对使用&quot;],&quot;effect&quot;:&quot;把未完成任务计数减一，唤醒等待 join 的一方&quot;,&quot;scenario&quot;:&quot;处理完一条任务后记账，便于主线程判断收工&quot;,&quot;example&quot;:&quot;item = q.get()\ntry:\n    handle(item)\nfinally:\n    q.task_done()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;调用次数多于 get 次数时抛 ValueError&quot;},{&quot;name&quot;:&quot;queue.Queue.join&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;join()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;阻塞到未完成任务计数归零&quot;,&quot;scenario&quot;:&quot;主线程等全部任务处理完再关闭&quot;,&quot;example&quot;:&quot;q.join()\nprint(\&quot;全部任务已完成\&quot;)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;少调一次 task_done 就会永久阻塞&quot;},{&quot;name&quot;:&quot;queue.Queue.put_nowait&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;put_nowait(item)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;item&quot;,&quot;type&quot;:&quot;object&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;要放入的对象&quot;}],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;等价于 put(item, block=False)&quot;,&quot;scenario&quot;:&quot;不允许生产者被拖慢时，满即放弃&quot;,&quot;example&quot;:&quot;from queue import Full\n\ntry:\n    q.put_nowait(item)\nexcept Full:\n    dropped += 1&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;丢弃前要计数，否则任务缺口无声无息&quot;},{&quot;name&quot;:&quot;queue.Queue.get_nowait&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;get_nowait()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;队首元素&quot;,&quot;effect&quot;:&quot;等价于 get(block=False)&quot;,&quot;scenario&quot;:&quot;非阻塞轮询与批量排空&quot;,&quot;example&quot;:&quot;from queue import Empty\n\nwhile True:\n    try:\n        batch.append(q.get_nowait())\n    except Empty:\n        break&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;空队列轮询要配休眠，否则空转烧 CPU&quot;},{&quot;name&quot;:&quot;queue.LifoQueue&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;LifoQueue(maxsize=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;maxsize&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;队列长度上限&quot;}],&quot;returns&quot;:&quot;后进先出队列&quot;,&quot;effect&quot;:&quot;取出顺序与放入顺序相反&quot;,&quot;scenario&quot;:&quot;回溯、撤销栈、深度优先的任务调度&quot;,&quot;example&quot;:&quot;from queue import LifoQueue\n\nstack: LifoQueue = LifoQueue()\nstack.put(1)\nstack.put(2)\nassert stack.get() == 2&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;任务有先后依赖时用它会打乱公平性&quot;},{&quot;name&quot;:&quot;queue.PriorityQueue&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;PriorityQueue(maxsize=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;maxsize&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;队列长度上限&quot;}],&quot;returns&quot;:&quot;优先队列&quot;,&quot;effect&quot;:&quot;按元素大小排序，最小者先出&quot;,&quot;scenario&quot;:&quot;按优先级调度任务、超时任务优先重试&quot;,&quot;example&quot;:&quot;from queue import PriorityQueue\n\npq: PriorityQueue = PriorityQueue()\npq.put((2, \&quot;low\&quot;))\npq.put((1, \&quot;high\&quot;))\nassert pq.get()[1] == \&quot;high\&quot;&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;优先级相同时会比较第二个字段，不可比较就报错&quot;},{&quot;name&quot;:&quot;queue.SimpleQueue&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;SimpleQueue()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;无界 FIFO 队列&quot;,&quot;effect&quot;:&quot;去掉任务计数与 join，路径更短&quot;,&quot;scenario&quot;:&quot;只要存取、不需要 join 的高频队列&quot;,&quot;example&quot;:&quot;from queue import SimpleQueue\n\nq: SimpleQueue = SimpleQueue()\nq.put(1)\nprint(q.get())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;没有 maxsize 与 task_done，不能当任务账本&quot;},{&quot;name&quot;:&quot;multiprocessing.Queue&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;Queue(maxsize=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;maxsize&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;队列长度上限&quot;}],&quot;returns&quot;:&quot;跨进程队列&quot;,&quot;methods&quot;:[&quot;put(obj, block=True, timeout=None) — 序列化后放入&quot;,&quot;get(block=True, timeout=None) — 取出并反序列化&quot;,&quot;close() — 停止放入&quot;,&quot;join_thread() — 等后台线程写完&quot;,&quot;cancel_join_thread() — 放弃等待后台线程&quot;],&quot;effect&quot;:&quot;父子进程或兄弟进程之间的有界对象通道&quot;,&quot;scenario&quot;:&quot;进程池任务下发与结果汇总&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\ndef main() -&gt; None:\n    q: mp.Queue = mp.Queue()\n    p = mp.Process(target=q.put, args=(\&quot;ok\&quot;,))\n    p.start()\n    print(q.get())\n    p.join()\n\nif __name__ == \&quot;__main__\&quot;:\n    main()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;对象必须可 pickle，且子进程写完后要 join_thread&quot;},{&quot;name&quot;:&quot;multiprocessing.JoinableQueue&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;JoinableQueue(maxsize=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;maxsize&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;队列长度上限&quot;}],&quot;returns&quot;:&quot;带 task_done 与 join 的进程队列&quot;,&quot;methods&quot;:[&quot;task_done() — 标记一条任务完成&quot;,&quot;join() — 等未完成任务归零&quot;],&quot;effect&quot;:&quot;把完成记账搬到跨进程场景&quot;,&quot;scenario&quot;:&quot;多 worker 消费，主进程等全部任务收工&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\nq = mp.JoinableQueue()\nq.put(\&quot;job\&quot;)\nq.get()\nq.task_done()\nq.join()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;普通 multiprocessing.Queue 没有 task_done，会直接报属性不存在&quot;},{&quot;name&quot;:&quot;multiprocessing.Pipe&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;Pipe(duplex=True)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;duplex&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;True&quot;,&quot;desc&quot;:&quot;是否双向&quot;}],&quot;returns&quot;:&quot;(conn1, conn2) 两个连接对象&quot;,&quot;methods&quot;:[&quot;send(obj) — 发送对象&quot;,&quot;recv() — 接收对象&quot;,&quot;poll(timeout) — 是否有数据&quot;,&quot;close() — 关闭连接&quot;],&quot;effect&quot;:&quot;两个端点之间的低开销通道，不带队列缓冲&quot;,&quot;scenario&quot;:&quot;父子进程一问一答、进程内代理&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\nparent, child = mp.Pipe()\nchild.send({\&quot;cmd\&quot;: \&quot;ping\&quot;})\nprint(parent.recv())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;两端同时读或同时写会互相阻塞，协议要先定收发次序&quot;}]' />

## 组合用法：带背压与哨兵的任务通道

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [同步原语与死锁](/backend/learn/concurrency/sync-primitives) | 队列内部的等待与通知 |
| [多进程基础](/backend/learn/concurrency/process-basics) | 进程启动与序列化边界 |
| [执行器与任务编排](/backend/learn/concurrency/executor-pools) | 任务分发与结果回收 |

### 数据流图解

下图画出跨进程队列的两次序列化，以及管道与锁的位置。

<DiagramFrame src="/diagrams/process-model.html" title="跨进程队列走管道与序列化（Archify 交互图）" :height="480" />

### 分步实现

1. 按内存上限建一个带容量的队列。
2. 生产者投递任务，队列满时自动阻塞。
3. 消费者循环取出任务并处理。
4. 每条处理完调用 `task_done()` 记账。
5. 停止时给每个消费者投一个哨兵。
6. 主线程调用 `join()` 等队列清空。

### 对比表格

| 结束方式 | 行为 | 风险 |
|---|---|---|
| 投哨兵 | 消费者主动退出 | 少投一个就有消费者挂住 |
| 设 daemon 线程 | 主线程退出即结束 | 未处理的任务直接丢 |
| 强制终止进程 | 立即停止 | 锁与数据状态不确定 |
| 关闭队列 | 3.13 起拒绝新任务 | 旧版本没有该接口 |

## 完整 Demo：有界队列加多消费者

### 场景描述

三个消费者处理 30 条任务。
队列容量设为 10，用来演示背压。
生产完毕后投三个哨兵，主线程等全部任务完成。

### 完整代码

```python
"""有界队列加多消费者：背压、哨兵与完成记账。"""
import threading
import time
from queue import Queue

TASKS = 30
WORKERS = 3
SENTINEL = None


def consume(tasks: Queue, seen: list) -> None:
    while True:
        item = tasks.get()
        if item is SENTINEL:
            tasks.task_done()
            return
        time.sleep(0.01)
        seen.append(item)
        tasks.task_done()


def main() -> None:
    tasks: Queue = Queue(maxsize=10)
    seen: list = []
    workers = [
        threading.Thread(target=consume, args=(tasks, seen), daemon=True)
        for _ in range(WORKERS)
    ]
    for worker in workers:
        worker.start()
    for index in range(TASKS):
        tasks.put(index)
    for _ in workers:
        tasks.put(SENTINEL)
    tasks.join()
    print(f"完成 {len(seen)} 条")


if __name__ == "__main__":
    main()
```

### 运行方式

```bash
python3 bounded_queue_demo.py
```

输出一行：完成 30 条。

### 常见误区

- 「队列空了消费者会自动退出」是错的。队列不发结束信号。
- 「一个哨兵能唤醒全部消费者」是错的。一个哨兵只唤醒一个。
- 「`task_done()` 可以省」是错的。少一次调用，`join()` 会一直等。
- 「队列越大越好」是错的。无界队列只是把内存压力藏起来。

### 面试追问链

<details>
<summary>Q1：为什么每个消费者都要投一个哨兵？</summary>

一个哨兵只唤醒一个消费者。
少投一个，那个消费者会永久阻塞在 `get()` 上。

</details>

<details>
<summary>Q2：消费者数量会变时，哨兵方案怎么改？</summary>

数量在运行时变化，哨兵就很难对齐。
改用 3.13 的 `Queue.shutdown`，或者用超时轮询加事件判断。

</details>

<details>
<summary>Q3：换成进程队列后，哪些约定会变？</summary>

任务与结果都要可 pickle。
子进程写完后要 `join_thread()`，否则数据可能留在缓冲区。

</details>

<details>
<summary>Q4：进程队列为什么还要一个后台线程？</summary>

写入端把对象交给 feeder 线程做序列化。
所以 `put()` 返回时，对端还未必收到。

</details>

<details>
<summary>Q5：背压应该设在哪一层？</summary>

设在与内存和延迟目标匹配的那一层。
队列满会让上游阻塞，而不是无声堆积。

</details>

### 下一讲衔接

队列会把数据复制一份给对端。
下一讲 [共享状态与共享内存](/backend/learn/communication/shared-state) 讲零拷贝的做法与代价。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 把哨兵、异常回传与关闭流程封成一个类。
它直接复用本讲的通道与退出约定。
