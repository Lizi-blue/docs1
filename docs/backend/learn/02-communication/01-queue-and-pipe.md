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






### 队列类型

<ApiTable :items='[{"name":"queue.Queue","rank":"必会","signature":"Queue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0","desc":"队列长度上限，0 表示不限制"}],"returns":"队列对象","methods":["put(item, block=True, timeout=None) — 放入元素","get(block=True, timeout=None) — 取出元素","put_nowait(item) — 不阻塞放入","get_nowait() — 不阻塞取出","task_done() — 标记一条任务已处理","join() — 等未完成任务归零","qsize() — 当前元素数","empty() — 是否为空","full() — 是否已满"],"effect":"自带锁与条件变量，生产者与消费者可并发存取","scenario":"线程池任务分发、结果回收、流水线缓冲","example":"from queue import Queue\n\nq: Queue = Queue(maxsize=10)\nq.put(\"job-1\")\nitem = q.get()\nq.task_done()\nq.join()","exampleLang":"python","pitfall":"maxsize 为 0 时队列无上限，生产过快会吃光内存"},{"name":"multiprocessing.Queue","rank":"必会","signature":"Queue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0","desc":"队列长度上限"}],"returns":"跨进程队列","methods":["put(obj, block=True, timeout=None) — 序列化后放入","get(block=True, timeout=None) — 取出并反序列化","close() — 停止放入","join_thread() — 等后台线程写完","cancel_join_thread() — 放弃等待后台线程"],"effect":"父子进程或兄弟进程之间的有界对象通道","scenario":"进程池任务下发与结果汇总","example":"import multiprocessing as mp\n\ndef main() -> None:\n    q: mp.Queue = mp.Queue()\n    p = mp.Process(target=q.put, args=(\"ok\",))\n    p.start()\n    print(q.get())\n    p.join()\n\nif __name__ == \"__main__\":\n    main()","exampleLang":"python","pitfall":"对象必须可 pickle，且子进程写完后要 join_thread"},{"name":"queue.LifoQueue","rank":"常用","signature":"LifoQueue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0","desc":"队列长度上限"}],"returns":"后进先出队列","effect":"取出顺序与放入顺序相反","scenario":"回溯、撤销栈、深度优先的任务调度","example":"from queue import LifoQueue\n\nstack: LifoQueue = LifoQueue()\nstack.put(1)\nstack.put(2)\nassert stack.get() == 2","exampleLang":"python","pitfall":"任务有先后依赖时用它会打乱公平性"},{"name":"queue.PriorityQueue","rank":"常用","signature":"PriorityQueue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0","desc":"队列长度上限"}],"returns":"优先队列","effect":"按元素大小排序，最小者先出","scenario":"按优先级调度任务、超时任务优先重试","example":"from queue import PriorityQueue\n\npq: PriorityQueue = PriorityQueue()\npq.put((2, \"low\"))\npq.put((1, \"high\"))\nassert pq.get()[1] == \"high\"","exampleLang":"python","pitfall":"优先级相同时会比较第二个字段，不可比较就报错"},{"name":"queue.SimpleQueue","rank":"常用","signature":"SimpleQueue()","params":[],"returns":"无界 FIFO 队列","effect":"去掉任务计数与 join，路径更短","scenario":"只要存取、不需要 join 的高频队列","example":"from queue import SimpleQueue\n\nq: SimpleQueue = SimpleQueue()\nq.put(1)\nprint(q.get())","exampleLang":"python","pitfall":"没有 maxsize 与 task_done，不能当任务账本"},{"name":"multiprocessing.JoinableQueue","rank":"常用","signature":"JoinableQueue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0","desc":"队列长度上限"}],"returns":"带 task_done 与 join 的进程队列","methods":["task_done() — 标记一条任务完成","join() — 等未完成任务归零"],"effect":"把完成记账搬到跨进程场景","scenario":"多 worker 消费，主进程等全部任务收工","example":"import multiprocessing as mp\n\nq = mp.JoinableQueue()\nq.put(\"job\")\nq.get()\nq.task_done()\nq.join()","exampleLang":"python","pitfall":"普通 multiprocessing.Queue 没有 task_done，会直接报属性不存在"}]' />

### 入队与出队

<ApiTable :items='[{"name":"queue.Queue.put","rank":"必会","signature":"put(item, block=True, timeout=None)","params":[{"name":"item","type":"object","default":"-","desc":"要放入的对象"},{"name":"block","type":"bool","default":"True","desc":"队列满时是否阻塞"},{"name":"timeout","type":"float","default":"None","desc":"阻塞等待的秒数"}],"returns":"None","effect":"队列满时挂起调用线程，直到有空位或超时","scenario":"生产者限速写入，用队列长度做背压","example":"try:\n    q.put(item, timeout=0.5)\nexcept Exception:\n    pass  # 队列满，稍后重试","exampleLang":"python","pitfall":"block 为 False 且队列满时抛 Full，不是静默丢弃"},{"name":"queue.Queue.get","rank":"必会","signature":"get(block=True, timeout=None)","params":[{"name":"block","type":"bool","default":"True","desc":"队列空时是否阻塞"},{"name":"timeout","type":"float","default":"None","desc":"阻塞等待的秒数"}],"returns":"队首元素","effect":"队列空时挂起调用线程，直到有元素或超时","scenario":"消费者循环取任务，配超时以支持退出检查","example":"from queue import Empty\n\ntry:\n    item = q.get(timeout=0.2)\nexcept Empty:\n    continue","exampleLang":"python","pitfall":"超时抛 Empty。不捕获就退出消费者循环"},{"name":"queue.Queue.put_nowait","rank":"常用","signature":"put_nowait(item)","params":[{"name":"item","type":"object","default":"-","desc":"要放入的对象"}],"returns":"None","effect":"等价于 put(item, block=False)","scenario":"不允许生产者被拖慢时，满即放弃","example":"from queue import Full\n\ntry:\n    q.put_nowait(item)\nexcept Full:\n    dropped += 1","exampleLang":"python","pitfall":"丢弃前要计数，否则任务缺口无声无息"},{"name":"queue.Queue.get_nowait","rank":"常用","signature":"get_nowait()","params":[],"returns":"队首元素","effect":"等价于 get(block=False)","scenario":"非阻塞轮询与批量排空","example":"from queue import Empty\n\nwhile True:\n    try:\n        batch.append(q.get_nowait())\n    except Empty:\n        break","exampleLang":"python","pitfall":"空队列轮询要配休眠，否则空转烧 CPU"}]' />

### 完成与同步

<ApiTable :items='[{"name":"queue.Queue.task_done","rank":"必会","signature":"task_done()","params":[],"returns":"None","methods":["join() — 与 task_done 配对使用"],"effect":"把未完成任务计数减一，唤醒等待 join 的一方","scenario":"处理完一条任务后记账，便于主线程判断收工","example":"item = q.get()\ntry:\n    handle(item)\nfinally:\n    q.task_done()","exampleLang":"python","pitfall":"调用次数多于 get 次数时抛 ValueError"},{"name":"queue.Queue.join","rank":"必会","signature":"join()","params":[],"returns":"None","effect":"阻塞到未完成任务计数归零","scenario":"主线程等全部任务处理完再关闭","example":"q.join()\nprint(\"全部任务已完成\")","exampleLang":"python","pitfall":"少调一次 task_done 就会永久阻塞"}]' />

### 常用接口

<ApiTable :items='[{"name":"multiprocessing.Pipe","rank":"常用","signature":"Pipe(duplex=True)","params":[{"name":"duplex","type":"bool","default":"True","desc":"是否双向"}],"returns":"(conn1, conn2) 两个连接对象","methods":["send(obj) — 发送对象","recv() — 接收对象","poll(timeout) — 是否有数据","close() — 关闭连接"],"effect":"两个端点之间的低开销通道，不带队列缓冲","scenario":"父子进程一问一答、进程内代理","example":"import multiprocessing as mp\n\nparent, child = mp.Pipe()\nchild.send({\"cmd\": \"ping\"})\nprint(parent.recv())","exampleLang":"python","pitfall":"两端同时读或同时写会互相阻塞，协议要先定收发次序"}]' />
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
