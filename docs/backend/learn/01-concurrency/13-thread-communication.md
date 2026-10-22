---
title: "线程间通信与共享内存范围"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 13
level: advanced
tags: [threading, shared-memory, lock, condition, queue]
description: "线程共享什么、不共享什么，以及共享之后怎么安全通信"
prerequisites:
  - /backend/learn/concurrency/thread-basics
related_knowledge:
  - /backend/learn/concurrency/sync-primitives
  - /backend/learn/concurrency/queue-pipe
  - /backend/learn/concurrency/shared-memory
---

### 本讲要解决的问题

线程共用一块堆内存。哪些数据因此共享，哪些仍然私有。
共享之后怎么安全通信。除了共享内存，还有哪些手段。

### 本讲要解决的问题

- 线程共享的内存范围有多大。
- 变量与它指向的对象，谁共享谁不共享。
- 除共享内存外，线程之间怎么通信。

## TL;DR

线程共享同一块堆。模块全局、类属性、实例属性、闭包捕获的变量都能互相看到。
局部变量在线程栈上，本身不共享。但它指向的对象通常在堆上，仍然共享。
共享之后要么加锁，要么改用队列。
更推荐队列：它自带锁与阻塞语义，把同步问题收进一个对象。

## 概念定义

**共享内存**：多个线程能读写同一块地址空间。线程模型默认如此。

**共享范围**：不是按变量名划分，而是按对象所在位置划分。堆上的对象共享，栈上的帧私有。

**通信**：一个线程把信息交给另一个线程。可以用共享变量，也可以用队列、事件与回调。

**竞态**：两个线程同时读写同一份数据，结果取决于调度顺序。

**原子性**：一个操作不可被打断。`+=` 不是原子操作，它包含读、改、写三步。

## 原理图解

下图回答一个问题：哪些数据在线程之间共享，哪些属于单个线程。

<DiagramFrame src="/diagrams/thread-shared-memory.html" title="线程共享内存范围：堆共享，栈私有（Archify 交互图）" :height="560" />

```text
进程
├── 堆（所有线程共享）
│   ├── 模块全局变量
│   ├── 类属性
│   ├── 实例属性（同一实例）
│   └── 闭包捕获的变量
└── 线程 A：栈（局部变量）        线程 B：栈（局部变量）
```

## 关键对比

| 数据 | 是否共享 | 原因 |
|---|---|---|
| 模块级全局变量 | 共享 | 存在模块命名空间，位于堆 |
| 类属性 | 共享 | 挂在类对象上 |
| 实例属性 | 共享（同一实例） | 实例在堆上 |
| 函数默认参数里的可变对象 | 共享 | 默认值在定义时创建一次 |
| 闭包捕获的变量 | 共享 | 多个闭包引用同一 cell |
| 函数局部变量 | 不共享 | 在各自线程栈帧里 |
| `threading.local` 的属性 | 不共享 | 每个线程一份副本 |

| 通信手段 | 适用 | 代价 |
|---|---|---|
| 共享变量 + 锁 | 少量状态、计数 | 容易漏锁，复合操作要整体保护 |
| `Condition` | 等待某个条件成立 | 需要正确配对 wait 与 notify |
| `Event` | 一次性信号或开关 | 只表达发生与否，不带数据 |
| `Semaphore` | 限制并发数 | 释放次数必须与获取次数匹配 |
| `Barrier` | 多线程集合点 | 参与者数量必须固定 |
| `queue.Queue` | 传递数据与任务 | 有内存上限时要处理阻塞 |
| `Future` 与回调 | 取异步结果 | 回调里不能做重活 |

### 官方依据与版本差异

- [threading 文档](https://docs.python.org/3/library/threading.html) — 3.13 起 `Thread` 与锁接口稳定。`threading.local` 行为在各版本一致。
- [queue 文档](https://docs.python.org/3/library/queue.html) — 3.0 起提供线程安全队列，`Queue` 与 `SimpleQueue` 的实现细节不同。
- [PEP 703](https://peps.python.org/pep-0703/) — 可选的无 GIL 构建自 3.13 起提供。无 GIL 时共享变量的原子性假设不再成立。

## API 手册：线程间通信

### 共享与互斥

<ApiTable :items='[{"name":"threading.Lock","rank":"必会","signature":"Lock()","params":[],"returns":"锁对象，支持 with 语句","methods":["acquire() — 获取锁，可阻塞","release() — 释放锁","locked() — 是否已上锁"],"effect":"把一段临界区变成互斥执行","scenario":"多个线程读改写同一份数据","example":"import threading\n\nlock = threading.Lock()\ntotal = 0\n\ndef add(n):\n    global total\n    for _ in range(n):\n        with lock:\n            total += 1","exampleLang":"python","pitfall":"只保护写不保护读仍会读到中间态。锁要覆盖完整的读改写。","raises":"RuntimeError，释放未持有的锁时抛出"},{"name":"threading.Condition","rank":"必会","signature":"Condition(lock=None)","params":[{"name":"lock","type":"Lock","default":"None","desc":"底层锁，默认新建一个可重入锁"}],"returns":"条件变量对象","methods":["wait(timeout=None) — 释放锁并等待通知","notify(n=1) — 唤醒一个等待者","notify_all() — 唤醒全部"],"effect":"让线程等待某个条件成立","scenario":"生产者消费者、队列空与满的等待","example":"cond = threading.Condition()\nready = []\n\nwith cond:\n    while not ready:\n        cond.wait()","exampleLang":"python","pitfall":"wait 必须放在 while 里。被唤醒不代表条件成立。","raises":"RuntimeError，未持有锁时调用 wait 或 notify"}]' />

### 线程间通知

<ApiTable :items='[{"name":"threading.Event","rank":"必会","signature":"Event()","params":[],"returns":"事件对象","methods":["set() — 置位，唤醒所有等待者","clear() — 复位","wait(timeout=None) — 等待置位","is_set() — 当前状态"],"effect":"广播一个发生与否的信号","scenario":"启动开关、退出信号","example":"import threading\n\nstarted = threading.Event()\n\ndef worker():\n    started.wait()\n    print(\"开始干活\")\n\nthreading.Thread(target=worker).start()\nstarted.set()","exampleLang":"python","pitfall":"Event 不带数据。需要传值时改用队列或条件变量。","raises":"无"},{"name":"queue.Queue","rank":"必会","signature":"Queue(maxsize=0)","params":[{"name":"maxsize","type":"int","default":"0 表示不限","desc":"队列容量上限"}],"returns":"线程安全队列","methods":["put(item, block=True, timeout=None) — 入队，满时阻塞","get(block=True, timeout=None) — 出队，空时阻塞","task_done() — 标记一个任务完成","join() — 等待全部任务完成"],"effect":"把数据传递与同步合并成一个对象","scenario":"线程池分发任务、生产者消费者","example":"import queue\n\nq = queue.Queue(maxsize=10)\nq.put(\"任务\")\nitem = q.get()","exampleLang":"python","pitfall":"用了 join 就必须配对调用 task_done。maxsize 太小时生产者与消费者会互相等待。","raises":"queue.Full 与 queue.Empty，带超时的阻塞调用超时后抛出"}]' />

## 组合用法：共享计数加事件通知

### 组合了哪些知识？

组合了三件事：共享变量、互斥锁、事件通知。

### 数据流图解

```text
线程 A ──▶ 加锁 ──▶ 改计数 ──▶ 解锁 ──▶ 置位事件
                                        │
线程 B ──▶ 等事件 ──▶ 读计数 ──▶ 打印结果
```

### 分步实现

1. 定共享状态。只放必须共享的最小集合。
2. 包一层锁。所有读改写都在锁内完成。
3. 加通知。用 Event 告诉其他线程可以读了。
4. 收尾。主线程 join 所有工作线程。

### 对比表格

| 方案 | 是否安全 | 代码量 | 适用 |
|---|---|---|---|
| 裸共享变量 | 不安全 | 最少 | 只读或单线程写 |
| 共享变量加锁 | 安全 | 中等 | 少量状态 |
| 共享变量加条件变量 | 安全 | 较多 | 需要等待条件 |
| 队列传递 | 安全 | 中等 | 数据与任务传递 |

## 完整 Demo：竞争与修复

### 场景描述

两个线程各给同一个计数加一万次。先跑无锁版本，观察丢更新。
再加锁重跑，对比结果。

### 完整代码

```python
"""共享变量竞争与修复：无锁会丢更新，加锁后结果正确。"""

import threading

ROUNDS = 10000
total = 0
lock = threading.Lock()


def add_unsafe():
    global total
    for _ in range(ROUNDS):
        total += 1


def add_safe():
    global total
    for _ in range(ROUNDS):
        with lock:
            total += 1


def run(target):
    global total
    total = 0
    threads = [threading.Thread(target=target) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return total


if __name__ == "__main__":
    print("无锁:", run(add_unsafe))
    print("加锁:", run(add_safe))
```

### 运行方式

```bash
python3 demo.py
```

无锁版本常小于两万。加锁版本稳定等于两万。
把 `ROUNDS` 调大，差异更明显。

### 常见误区

- 只给写加锁，读不加锁。读到的可能是中间态。
- 认为 GIL 保证原子性。`+=` 包含三步，仍会被切换。

### 面试追问链

<details>
<summary>局部变量不共享，为什么还会出问题？</summary>

变量私有，但它指向的对象可能在堆上。两个线程拿到同一引用，仍会竞争。
</details>

<details>
<summary>什么时候必须用队列而不是锁？</summary>

需要传递数据或任务时。队列把同步藏在内部，少一类漏锁的风险。
</details>

<details>
<summary>无 GIL 构建下这份代码还成立吗？</summary>

加锁版本成立。无锁版本的原子性假设更不成立。
</details>

### 下一讲衔接

下一讲 [事件循环原理与 await 语义](/backend/learn/concurrency/event-loop-internals) 换一种调度模型。它讲单线程下怎么同时等待多个任务。

### 关联组件

暂无。并发原语在组件页中按需组合。
