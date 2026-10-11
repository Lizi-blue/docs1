---
title: "多线程基础"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 1
level: basic
tags: [threading, gil, sync]
description: "Python 多线程的创建、同步与通信"
source_module: "threading"
api_methods:
  - "threading.Thread"
  - "threading.Lock"
  - "threading.Event"
prerequisites: []
related_knowledge:
  - /backend/learn/concurrency/process-basics
  - /backend/learn/concurrency/queue-pipe
related_components:
  - /backend/components/safe-queue
---

# 多线程基础

### 本讲要解决的问题

I/O 密集任务用线程能提速吗？GIL 会不会让多线程失效？
这一讲讲清线程的创建、同步与 GIL 的约束。

## TL;DR

> 多线程适合 I/O 密集任务。线程共享进程内存，创建与切换便宜。
> CPython 有 GIL，同一时刻只有一个线程跑字节码。CPU 密集任务请换多进程。

## 概念定义

线程是进程内的执行单元，由操作系统按时间片调度。

一个进程可以有多个线程。这些线程共享进程的堆与文件描述符。每个线程有自己的栈和寄存器现场。创建线程比创建进程便宜，切换也更快。代价是共享内存带来竞态，需要锁来保护临界区。

## 原理图解

下图展示 GIL 的持有与释放，以及线程在等待 I/O 时如何让出解释器。

<DiagramFrame src="/diagrams/gil-workflow.html" title="GIL 与线程调度（Archify 交互图）" :height="560" />

## 关键对比

| 维度 | 线程 | 进程 | 协程 |
|---|---|---|---|
| 内存空间 | 共享进程内存 | 各自独立 | 共享进程内存 |
| 创建开销 | 小 | 大 | 最小 |
| 切换成本 | 由操作系统决定 | 由操作系统决定 | 由事件循环决定 |
| 适用任务 | I/O 密集 | CPU 密集 | 高并发 I/O |
| 数据传递 | 直接读共享变量 | 需要序列化 | 直接读共享变量 |
| 并发上限 | 数百 | 受内存限制 | 数千到数万 |

## API 手册：threading

<ApiTable :items='[{"name": "threading.Thread", "rank": "必会", "signature": "Thread(group=None, target=None, name=None, args=(), kwargs={}, daemon=None)", "params": [{"name": "target", "type": "callable", "default": "None", "desc": "线程启动后执行的函数"}, {"name": "args", "type": "tuple", "default": "()", "desc": "传给 target 的位置参数"}, {"name": "kwargs", "type": "dict", "default": "{}", "desc": "传给 target 的关键字参数"}, {"name": "daemon", "type": "bool", "default": "None", "desc": "守护线程随主线程退出"}], "returns": "Thread 实例", "methods": ["start() — 启动线程", "join(timeout=None) — 等待结束", "is_alive() — 判断存活", "setDaemon(bool) — 设置守护"], "effect": "把函数放到独立执行单元里跑，主线程可以继续做别的事", "scenario": "并发等待网络响应、并发读写多个文件", "example": "import threading\n\ndef worker(name):\n    print(name)\n\nt = threading.Thread(target=worker, args=(&#39;A&#39;,), daemon=True)\nt.start()\nt.join(timeout=5)", "exampleLang": "python"}, {"name": "threading.Lock", "rank": "必会", "signature": "Lock()", "params": [], "returns": "锁对象", "methods": ["acquire(blocking=True, timeout=-1) — 加锁", "release() — 解锁", "locked() — 查询状态"], "effect": "把临界区串行化，避免两个线程同时改一个变量", "scenario": "累加计数器、写同一个文件、改同一份缓存", "example": "import threading\n\nlock = threading.Lock()\ntotal = 0\n\ndef add():\n    global total\n    with lock:\n        total += 1\n\nts = [threading.Thread(target=add) for _ in range(100)]\n[t.start() for t in ts]\n[t.join() for t in ts]\nprint(total)", "exampleLang": "python"}, {"name": "threading.Event", "rank": "常用", "signature": "Event()", "params": [], "returns": "事件对象", "methods": ["set() — 置位", "clear() — 复位", "wait(timeout=None) — 等待置位", "is_set() — 查询"], "effect": "让一个线程等待另一个线程发出开始或停止信号", "scenario": "优雅停止后台线程、等待初始化完成", "example": "import threading\n\nready = threading.Event()\n\ndef boot():\n    ready.set()\n\nthreading.Thread(target=boot).start()\nready.wait(timeout=3)\nprint(&#39;booted&#39;)", "exampleLang": "python"}]' />

## 组合用法：线程池批量取数

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [多线程基础](/backend/learn/concurrency/thread-basics) | Thread 的创建与 join |
| [Queue 通信](/backend/learn/concurrency/queue-pipe) | 线程间传结果 |
| [多进程基础](/backend/learn/concurrency/process-basics) | 判断要不要换进程 |

### 数据流图解

<DiagramFrame src="/diagrams/thread-pool-flow.html" title="线程池批量取数数据流（Archify 交互图）" :height="480" />

### 分步实现

1. 建一个队列存放待取 URL。
2. 建 4 个 worker 线程，每个线程循环取 URL。
3. worker 取到响应后写入结果队列。
4. 主线程消费结果队列并打印。
5. 全部取完后，向队列投递结束标记。

<CodeTabs :tabs='[{"label": "线程池", "lang": "python", "code": "from concurrent.futures import ThreadPoolExecutor\n\nwith ThreadPoolExecutor(max_workers=4) as pool:\n    results = list(pool.map(fetch, urls))"}, {"label": "进程池", "lang": "python", "code": "from concurrent.futures import ProcessPoolExecutor\n\nwith ProcessPoolExecutor(max_workers=4) as pool:\n    results = list(pool.map(parse_heavy, payloads))"}]' />

### 对比表格

| 方案 | 吞吐 | 内存 | 适合 |
|---|---|---|---|
| 手动建线程 | 一般 | 线程栈随线程数增长 | 线程数固定的小任务 |
| 线程池 | 高 | 线程复用，栈数量固定 | 大量短任务 |
| asyncio 并发 | 最高 | 单线程，无栈开销 | 纯网络 I/O |

## 完整 Demo：并发下载器

### 场景描述

给一组 URL，限制并发数为 4，统计成功与失败数量，并打印总耗时。

### 完整代码

```python
import threading
import time
import urllib.request
from queue import Queue

URLS = [f"https://example.com/?page={i}" for i in range(20)]
WORKERS = 4


def worker(tasks: Queue, results: Queue) -> None:
    while True:
        url = tasks.get()
        if url is None:
            tasks.task_done()
            return
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                results.put((url, resp.status))
        except Exception as exc:
            results.put((url, str(exc)))
        finally:
            tasks.task_done()


def main() -> None:
    tasks: Queue = Queue()
    results: Queue = Queue()
    for url in URLS:
        tasks.put(url)

    threads = [
        threading.Thread(target=worker, args=(tasks, results), daemon=True)
        for _ in range(WORKERS)
    ]
    start = time.perf_counter()
    for t in threads:
        t.start()
    tasks.join()
    for _ in threads:
        tasks.put(None)

    ok = sum(1 for _, value in iter(results.get, None) if isinstance(value, int))
    print(f"成功 {ok} 条，耗时 {time.perf_counter() - start:.2f}s")


if __name__ == "__main__":
    main()
```

### 运行方式

```bash
python3 thread_downloader.py
```

### 常见误区

- 「线程越多吞吐越高」是错的。切换成本会吃掉收益，网络还有连接上限。
- 「加了锁就一定慢」是错的。锁只串行化临界区，临界区外的代码照常跑。
- 「daemon 线程能保证任务做完」是错的。主线程退出时守护线程直接消失，结果会丢。

### 面试追问链

<details>
<summary>Q1：为什么用 daemon=True？</summary>

主线程退出时守护线程不会阻塞进程。真实任务要拿到全部结果，就不该用 daemon，而应显式 join。

</details>

<details>
<summary>Q2：既然不能靠 daemon 收尾，为什么还要 task_done 与 join？</summary>

Queue.join 等到所有任务被标记完成。task_done 是标记动作。少一次调用就会永久阻塞。

</details>

<details>
<summary>Q3：靠线程数提吞吐，为什么并发数不是越大越好？</summary>

线程过多会让切换成本超过收益。网络 I/O 还会触发连接数上限与远端限流。

</details>

<details>
<summary>Q4：既然并发数有上限，这个场景换成 asyncio 会怎样？</summary>

单线程事件循环即可支撑同样并发。代码要去掉线程，改用 aiohttp 之类的异步客户端。

</details>

### 下一讲衔接

线程受 GIL 限制，下一讲 [多进程基础](/backend/learn/concurrency/process-basics) 讲进程如何拿到真并行。

### 关联组件

本 Demo 的「队列 + 结束标记 + 多 worker」模式被组件 [进程安全队列](/backend/components/safe-queue) 复用。
