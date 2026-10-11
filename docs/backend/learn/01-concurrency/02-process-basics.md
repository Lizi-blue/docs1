---
title: "多进程基础"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 2
level: basic
tags: [multiprocessing, pickle, fork]
description: "绕过 GIL：进程创建、启动方式与进程间数据传递"
source_module: "multiprocessing"
api_methods:
  - "multiprocessing.Process"
  - "multiprocessing.Pool"
  - "concurrent.futures.ProcessPoolExecutor"
prerequisites:
  - /backend/learn/concurrency/thread-basics
related_knowledge:
  - /backend/learn/concurrency/queue-pipe
  - /backend/learn/concurrency/executor-pools
  - /backend/learn/concurrency/shared-memory
related_components:
  - /backend/components/safe-queue
---

# 多进程基础

### 本讲要解决的问题

CPU 密集任务加线程为什么还是慢？进程之间怎么交换数据？
这一讲讲清进程的启动方式与序列化成本。

## TL;DR

> CPU 密集任务用多进程。每个进程有独立解释器与 GIL，能真正并行。
> 代价是进程创建贵、内存不共享，参数与结果要能被 pickle。

## 概念定义

进程是操作系统分配资源的基本单位，拥有独立内存空间。

进程之间不共享变量。要交换数据，进程就要序列化。Linux 默认用 fork 启动子进程，macOS 与 Windows 用 spawn。spawn 会重新导入主模块，因此入口必须放在 `if __name__ == "__main__":` 里。

## 原理图解

下图对比线程共享内存与进程独立内存，并标出数据跨界时要过的序列化关口。

<DiagramFrame src="/diagrams/process-model.html" title="线程与进程的内存模型（Archify 交互图）" :height="520" />

## 关键对比

| 维度 | 线程 | 进程 |
|---|---|---|
| GIL | 共享一个 | 每进程一个 |
| 并行能力 | 只在 I/O 等待时重叠 | 真并行 |
| 启动开销 | 约几十微秒 | 约几十毫秒 |
| 数据传递 | 直接读变量 | 需要 pickle |
| 崩溃影响 | 拖垮整个进程 | 只影响子进程 |

### 官方依据与版本差异

- [multiprocessing 官方文档](https://docs.python.org/3/library/multiprocessing.html) — 3.8 及以后适用，3.14 起默认启动方式有变。
- [启动方式与上下文](https://docs.python.org/3/library/multiprocessing.html#contexts-and-start-methods) — 3.14 起 POSIX 默认由 fork 改为 forkserver。
- [pickle 官方文档](https://docs.python.org/3/library/pickle.html) — 3.8 及以后要求对象可序列化。

## API 手册：multiprocessing

<ApiTable :items='[{&quot;name&quot;:&quot;multiprocessing.Process&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;Process(group=None, target=None, name=None, args=(), kwargs={}, daemon=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;target&quot;,&quot;type&quot;:&quot;callable&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;子进程执行的函数&quot;},{&quot;name&quot;:&quot;args&quot;,&quot;type&quot;:&quot;tuple&quot;,&quot;default&quot;:&quot;()&quot;,&quot;desc&quot;:&quot;位置参数，必须可 pickle&quot;},{&quot;name&quot;:&quot;daemon&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;守护进程随父进程退出&quot;}],&quot;returns&quot;:&quot;Process 实例&quot;,&quot;methods&quot;:[&quot;start() — 启动子进程&quot;,&quot;join(timeout=None) — 等待结束&quot;,&quot;is_alive() — 判断存活&quot;,&quot;terminate() — 强制终止&quot;,&quot;daemon — 守护标志，父进程退出即终止&quot;,&quot;pid — 子进程号&quot;,&quot;exitcode — 退出码，未结束时为 None&quot;],&quot;effect&quot;:&quot;把函数放到独立解释器里跑，绕开 GIL&quot;,&quot;scenario&quot;:&quot;图像处理、数值计算、压缩与加密&quot;,&quot;example&quot;:&quot;import multiprocessing\n\ndef work(n):\n    return n * n\n\nif __name__ == &#39;__main__&#39;:\n    p = multiprocessing.Process(target=work, args=(5,))\n    p.start()\n    p.join()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;子进程不共享内存，改掉的全局变量只留在副本里。daemon 进程不能再建子进程。&quot;,&quot;raises&quot;:&quot;RuntimeError，重复 start 或 join 未启动的进程时抛出&quot;},{&quot;name&quot;:&quot;multiprocessing.Queue&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;Queue(maxsize=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;maxsize&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;队列上限，0 表示不限&quot;}],&quot;returns&quot;:&quot;跨进程队列对象&quot;,&quot;methods&quot;:[&quot;Queue.put(obj, block=True, timeout=None) — 阻塞入队&quot;,&quot;Queue.get(block=True, timeout=None) — 阻塞出队&quot;,&quot;Queue.empty() — 判断是否为空&quot;,&quot;Queue.qsize() — 粗略的队列长度&quot;,&quot;Queue.close() — 关闭队列&quot;],&quot;effect&quot;:&quot;把对象序列化后交给另一个进程&quot;,&quot;scenario&quot;:&quot;父进程下发任务、回收子进程结果&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\ndef worker(q):\n    q.put(&#39;done&#39;)\n\nif __name__ == &#39;__main__&#39;:\n    q = mp.Queue()\n    p = mp.Process(target=worker, args=(q,))\n    p.start()\n    print(q.get(timeout=3))\n    p.join()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;队列有内部缓冲线程。put 后立刻 join 子进程可能丢数据，要先取空再 join。&quot;,&quot;raises&quot;:&quot;queue.Empty 与 queue.Full，超时或非阻塞时抛出&quot;},{&quot;name&quot;:&quot;multiprocessing.Lock&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;Lock()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;跨进程锁对象&quot;,&quot;methods&quot;:[&quot;Lock.acquire(block=True, timeout=None) — 加锁&quot;,&quot;Lock.release() — 解锁&quot;],&quot;effect&quot;:&quot;让多个进程互斥访问共享资源&quot;,&quot;scenario&quot;:&quot;共享文件、共享内存、共享容器&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\nlock = mp.Lock()\nn = mp.Value(&#39;i&#39;, 0)\n\ndef add(lock, n):\n    for _ in range(1000):\n        with lock:\n            n.value += 1\n\nif __name__ == &#39;__main__&#39;:\n    ps = [mp.Process(target=add, args=(lock, n)) for _ in range(2)]\n    [p.start() for p in ps]\n    [p.join() for p in ps]\n    print(n.value)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;锁要随参数传给子进程。绕过锁直接改共享对象会读到脏数据。&quot;,&quot;raises&quot;:&quot;无异常，acquire 超时返回 False&quot;},{&quot;name&quot;:&quot;multiprocessing.Event&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;Event()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;跨进程事件对象&quot;,&quot;methods&quot;:[&quot;Event.set() — 置位&quot;,&quot;Event.wait(timeout=None) — 等待置位&quot;,&quot;Event.clear() — 复位&quot;],&quot;effect&quot;:&quot;让子进程等到父进程放行再开始&quot;,&quot;scenario&quot;:&quot;多进程统一起跑、通知退出&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\ndef wait_it(e):\n    e.wait(timeout=3)\n    print(&#39;go&#39;)\n\nif __name__ == &#39;__main__&#39;:\n    e = mp.Event()\n    p = mp.Process(target=wait_it, args=(e,))\n    p.start()\n    e.set()\n    p.join()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;普通布尔变量改不动子进程里的副本，跨进程放行要用 Event。&quot;,&quot;raises&quot;:&quot;无异常，wait 超时返回 False&quot;},{&quot;name&quot;:&quot;multiprocessing.Manager&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;Manager()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;管理器对象&quot;,&quot;methods&quot;:[&quot;Manager.dict() — 共享字典代理&quot;,&quot;Manager.list() — 共享列表代理&quot;,&quot;Manager.Queue() — 队列代理&quot;,&quot;Manager.shutdown() — 关闭管理进程&quot;],&quot;effect&quot;:&quot;把容器放进管理进程，其他进程用代理读写&quot;,&quot;scenario&quot;:&quot;共享嵌套结构、共享计数字典&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\ndef put(d):\n    d[&#39;k&#39;] = 2\n\nif __name__ == &#39;__main__&#39;:\n    with mp.Manager() as m:\n        d = m.dict()\n        p = mp.Process(target=put, args=(d,))\n        p.start()\n        p.join()\n        print(d)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;代理每次读写都走管理进程。高频小操作会明显变慢。&quot;,&quot;raises&quot;:&quot;BrokenPipeError，管理进程退出之后&quot;},{&quot;name&quot;:&quot;multiprocessing.cpu_count&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;cpu_count()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;整数 CPU 核数&quot;,&quot;methods&quot;:[&quot;cpu_count() — 返回可用 CPU 数&quot;],&quot;effect&quot;:&quot;给进程池规模一个参考值&quot;,&quot;scenario&quot;:&quot;配置 worker 数、判断是否值得多进程&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\nprint(mp.cpu_count())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;它返回机器核数，读不到 cgroup 配额。容器里要按限额自己算并发度。&quot;,&quot;raises&quot;:&quot;无异常，读不到配额时退回机器核数&quot;},{&quot;name&quot;:&quot;multiprocessing.current_process&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;current_process()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;当前 Process 对象&quot;,&quot;methods&quot;:[&quot;current_process() — 取当前进程对象&quot;,&quot;active_children() — 取存活子进程&quot;,&quot;freeze_support() — 冻结程序的入口守卫&quot;],&quot;effect&quot;:&quot;在子进程里拿到自己的名字与进程号&quot;,&quot;scenario&quot;:&quot;日志标记进程、清理残留子进程&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\ndef who():\n    print(mp.current_process().name, mp.current_process().pid)\n\nif __name__ == &#39;__main__&#39;:\n    mp.Process(target=who).start()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;active_children 只列本进程直接创建的子进程，不会递归到孙进程。&quot;,&quot;raises&quot;:&quot;无异常，任意进程里都能调用&quot;},{&quot;name&quot;:&quot;concurrent.futures.ProcessPoolExecutor&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;ProcessPoolExecutor(max_workers=None, mp_context=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;max_workers&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;CPU 核数&quot;,&quot;desc&quot;:&quot;进程数上限&quot;},{&quot;name&quot;:&quot;mp_context&quot;,&quot;type&quot;:&quot;BaseContext&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;指定 fork 或 spawn&quot;}],&quot;returns&quot;:&quot;执行器对象&quot;,&quot;methods&quot;:[&quot;submit(fn, *args) — 提交单任务&quot;,&quot;map(fn, iterable) — 顺序映射&quot;,&quot;shutdown(wait=True) — 关闭&quot;],&quot;effect&quot;:&quot;把任务摊到多个 CPU 核上跑，主进程拿 Future 收结果&quot;,&quot;scenario&quot;:&quot;批量计算、批量转码&quot;,&quot;example&quot;:&quot;from concurrent.futures import ProcessPoolExecutor\n\ndef heavy(n):\n    return sum(i * i for i in range(n))\n\nif __name__ == &#39;__main__&#39;:\n    with ProcessPoolExecutor(max_workers=4) as pool:\n        print(list(pool.map(heavy, [10**6, 10**6])))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;任务函数与参数必须可 pickle。缺少 __main__ 守卫会让 spawn 反复导入模块。&quot;,&quot;raises&quot;:&quot;BrokenProcessPool，子进程异常退出之后&quot;},{&quot;name&quot;:&quot;multiprocessing.set_start_method&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;set_start_method(method, force=False)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;method&quot;,&quot;type&quot;:&quot;str&quot;,&quot;default&quot;:&quot;必填&quot;,&quot;desc&quot;:&quot;spawn / fork / forkserver&quot;},{&quot;name&quot;:&quot;force&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;False&quot;,&quot;desc&quot;:&quot;是否强制覆盖已有设置&quot;}],&quot;returns&quot;:&quot;None，只改全局启动方式&quot;,&quot;methods&quot;:[&quot;get_start_method() — 查询当前方式&quot;,&quot;get_context(method) — 取上下文对象&quot;],&quot;effect&quot;:&quot;决定子进程的启动方式与可传递的对象&quot;,&quot;scenario&quot;:&quot;跨平台一致性与 fork 安全性&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\nif __name__ == \&quot;__main__\&quot;:\n    mp.set_start_method(\&quot;spawn\&quot;, force=True)\n    print(mp.get_start_method())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;多线程进程用 fork 容易死锁。Python 3.14 起 Linux 默认改用 forkserver。&quot;,&quot;raises&quot;:&quot;RuntimeError，启动方式已经被设置过&quot;},{&quot;name&quot;:&quot;multiprocessing.Pool&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;Pool(processes=None, initializer=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;processes&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;CPU 核数&quot;,&quot;desc&quot;:&quot;工作进程数&quot;},{&quot;name&quot;:&quot;initializer&quot;,&quot;type&quot;:&quot;callable&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;每个进程的初始化函数&quot;}],&quot;returns&quot;:&quot;进程池对象&quot;,&quot;methods&quot;:[&quot;map(func, iterable) — 分块映射&quot;,&quot;apply_async(func, args) — 异步提交&quot;,&quot;imap_unordered(...) — 边完成边产出&quot;,&quot;close() 与 join() — 关闭并回收&quot;],&quot;effect&quot;:&quot;用固定进程数处理批量任务&quot;,&quot;scenario&quot;:&quot;大量同质计算任务&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\ndef square(n):\n    return n * n\n\nif __name__ == \&quot;__main__\&quot;:\n    with mp.Pool(2) as pool:\n        print(pool.map(square, [1, 2, 3]))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;Pool 要用 with 或在 close 之后 join。子进程里的异常只在取结果时抛出。&quot;,&quot;raises&quot;:&quot;ValueError，池关闭之后还提交任务&quot;},{&quot;name&quot;:&quot;multiprocessing.Pipe&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;Pipe(duplex=True)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;duplex&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;True&quot;,&quot;desc&quot;:&quot;是否双向&quot;}],&quot;returns&quot;:&quot;两端连接对象&quot;,&quot;methods&quot;:[&quot;send(obj) — 发送对象&quot;,&quot;recv() — 接收对象&quot;,&quot;close() — 关闭一端&quot;],&quot;effect&quot;:&quot;在两个进程间建立点对点通道&quot;,&quot;scenario&quot;:&quot;父子进程一对一通信&quot;,&quot;example&quot;:&quot;import multiprocessing as mp\n\ndef child(conn):\n    conn.send(\&quot;来自子进程\&quot;)\n    conn.close()\n\nif __name__ == \&quot;__main__\&quot;:\n    parent, kid = mp.Pipe()\n    mp.Process(target=child, args=(kid,)).start()\n    print(parent.recv())&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;两个进程同时读写同一端会弄坏数据。传大对象时 send 会阻塞到对端读取。&quot;,&quot;raises&quot;:&quot;EOFError，对端关闭之后继续 recv&quot;}]' />

## 组合用法：进程池并行计算

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [多进程基础](/backend/learn/concurrency/process-basics) | 进程池与任务分发 |
| [多线程基础](/backend/learn/concurrency/thread-basics) | 判定任务是 CPU 密集还是 I/O 密集 |
| [Queue 通信](/backend/learn/concurrency/queue-pipe) | 汇总子进程结果 |

### 数据流图解

<DiagramFrame src="/diagrams/process-model.html" title="任务分发与结果回收（Archify 交互图）" :height="460" />

### 分步实现

1. 把大任务切成独立小块，每块可单独计算。
2. 建进程池，池大小取 CPU 核数。
3. 用 map 提交分块，收集 Future。
4. 主进程汇总结果并打印。

### 对比表格

| 方案 | 并行方式 | 数据传递成本 | 适合 |
|---|---|---|---|
| 多线程 | 分时，受 GIL 限制 | 无 | I/O 密集 |
| 多进程 | 多核真并行 | 序列化 | CPU 密集 |
| 多进程加共享内存 | 多核真并行 | 近乎为零 | 大数组运算 |

## 完整 Demo：分块求和

### 场景描述

把一个千万级整数区间切成 8 块，用进程池并行求和，对比单进程耗时。

### 完整代码

```python
import time
from concurrent.futures import ProcessPoolExecutor

LIMIT = 20_000_000
CHUNKS = 8


def partial(start: int, end: int) -> int:
    return sum(range(start, end))


def main() -> None:
    step = LIMIT // CHUNKS
    ranges = [(i * step, (i + 1) * step) for i in range(CHUNKS)]

    start = time.perf_counter()
    with ProcessPoolExecutor(max_workers=CHUNKS) as pool:
        total = sum(pool.map(partial, [r[0] for r in ranges], [r[1] for r in ranges]))
    print(f"多进程结果 {total}，耗时 {time.perf_counter() - start:.2f}s")


if __name__ == "__main__":
    main()
```

### 运行方式

```bash
python3 parallel_sum.py
```

### 常见误区

- 「多进程一定比多线程快」是错的。进程启动贵，参数与结果还要序列化。
- 「子进程能改父进程的变量」是错的。两者内存独立，改动不会回传。
- 「进程池不需要 __main__ 保护」是错的。spawn 会重新导入主模块，不加保护就递归建进程。

### 面试追问链

<details>
<summary>Q1：为什么入口要放在 if __name__ == &quot;__main__&quot; 里？</summary>

spawn 启动方式会重新导入主模块。不加保护就会递归创建子进程。

</details>

<details>
<summary>Q2：入口保护之后，进程池大小怎么定？</summary>

CPU 密集任务取核数。I/O 密集任务可以超配。真实系统还要看内存与外部限流。

</details>

<details>
<summary>Q3：池子开大以后，传大数组会怎样？</summary>

每次调用都会 pickle 并复制。数组很大时改用共享内存或内存映射文件。

</details>

### 下一讲衔接

子进程的结果要收回来，下一讲 [Queue 通信](/backend/learn/concurrency/queue-pipe) 讲队列与结束标记。

### 关联组件

组件 [进程安全队列](/backend/components/safe-queue) 用同样的进程池与队列组合，封装了结束标记与异常回传。
