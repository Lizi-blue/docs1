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
  - /backend/learn/concurrency/gil-internals
  - /backend/learn/concurrency/sync-primitives
  - /backend/learn/concurrency/executor-pools
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

### 官方依据与版本差异

- [threading 官方文档](https://docs.python.org/3/library/threading.html) — 适用 Python 3.8 及以后。
- [切换间隔 sys.setswitchinterval](https://docs.python.org/3/library/sys.html#sys.setswitchinterval) — 默认 5 毫秒，自 3.2 起提供。
- [PEP 703 自由线程](https://peps.python.org/pep-0703/) — 3.13 起实验性提供，GIL 可关闭。

## API 手册：threading






### 线程对象与生命周期

<ApiTable :items='[{"name":"threading.Thread","rank":"必会","signature":"Thread(group=None, target=None, name=None, args=(), kwargs={}, daemon=None)","params":[{"name":"target","type":"callable","default":"None","desc":"线程启动后执行的函数"},{"name":"args","type":"tuple","default":"()","desc":"传给 target 的位置参数"},{"name":"kwargs","type":"dict","default":"{}","desc":"传给 target 的关键字参数"},{"name":"daemon","type":"bool","default":"None","desc":"守护线程随主线程退出"}],"returns":"Thread 实例","effect":"把函数放到独立执行单元里跑，主线程可以继续做别的事","scenario":"并发等待网络响应、并发读写多个文件","example":"import threading\n\ndef worker(name):\n    print(name)\n\nt = threading.Thread(target=worker, args=(&#39;A&#39;,), daemon=True)\nt.start()\nt.join(timeout=5)","exampleLang":"python","pitfall":"daemon 必须在 start 之前设定。线程里抛出的异常不会回到主线程。","raises":"RuntimeError，重复 start 或 join 未启动的线程时抛出"},{"name":"threading.current_thread","rank":"必会","signature":"current_thread()","params":[],"returns":"当前线程的 Thread 对象","methods":["current_thread() — 取当前线程对象","main_thread() — 取主线程对象"],"effect":"在任意函数里认出自己跑在哪个线程","scenario":"日志埋点、按线程分流、断言主线程","example":"import threading\n\ndef who():\n    t = threading.current_thread()\n    print(t.name, t.ident)\n\nthreading.Thread(target=who, name=&#39;worker&#39;).start()\nprint(threading.main_thread().name)","exampleLang":"python","pitfall":"主线程改名后它也跟着变。不要拿线程名当唯一标识。","raises":"无异常，任意线程里都能调用"},{"name":"threading.enumerate","rank":"常用","signature":"enumerate()","params":[],"returns":"存活线程对象列表","methods":["enumerate() — 列出全部存活线程","active_count() — 返回存活线程数"],"effect":"把线程数量与名字对到业务角色","scenario":"排查线程泄漏、确认池外线程","example":"import threading\nimport time\n\nthreading.Thread(target=time.sleep, args=(5,), name=&#39;worker&#39;).start()\nfor t in threading.enumerate():\n    print(t.name, t.is_alive())\nprint(threading.active_count())","exampleLang":"python","pitfall":"只列 Python 线程，看不到已退出的池内线程。列表顺序不稳定。","raises":"无异常，只读当前进程的线程列表"},{"name":"threading.get_ident","rank":"常用","signature":"get_ident()","params":[],"returns":"整数线程标识","methods":["get_ident() — 取解释器内标识","get_native_id() — 取内核线程号"],"effect":"给日志一条稳定的线程标识","scenario":"关联日志与操作系统线程","example":"import threading\n\ndef show():\n    print(threading.get_ident(), threading.get_native_id())\n\nthreading.Thread(target=show).start()","exampleLang":"python","pitfall":"线程退出后编号会被复用，不能当长期主键。","raises":"无异常，任意线程里都能调用"},{"name":"threading.Thread.start","rank":"必会","signature":"start()","params":[],"returns":"无","effect":"启动线程，由解释器安排执行 run()","scenario":"创建 Thread 实例后开始执行","example":"import threading\n\ndef work():\n    print(\"running\")\n\nt = threading.Thread(target=work)\nt.start()\nt.join()","pitfall":"重复调用抛 RuntimeError。同一 Thread 实例只能 start 一次。","raises":"RuntimeError"},{"name":"threading.Thread.join","rank":"必会","signature":"join(timeout=None)","params":[{"name":"timeout","type":"float","default":"None","desc":"等待秒数，None 表示一直等"}],"returns":"无","effect":"阻塞当前线程直到目标线程结束或超时","scenario":"主线程等待工作线程收尾","example":"import threading\n\ndef work():\n    pass\n\nt = threading.Thread(target=work)\nt.start()\nt.join(timeout=5)\nprint(t.is_alive())","pitfall":"超时返回后线程仍在跑，必须用 is_alive() 复查。对自己 join 会死锁。","raises":"RuntimeError"},{"name":"threading.Thread.is_alive","rank":"必会","signature":"is_alive()","params":[],"returns":"布尔值","effect":"判断线程是否处于运行中（start 后到结束前）","scenario":"join 超时后复查，或判断是否可再次回收","example":"import threading\n\nt = threading.Thread(target=lambda: None)\nprint(t.is_alive())\nt.start()\nprint(t.is_alive())\nt.join()\nprint(t.is_alive())","pitfall":"未 start 与已结束都返回 False，不能用来区分这两种状态。"},{"name":"threading.Thread.daemon","rank":"必会","signature":"daemon","params":[],"returns":"布尔值属性","effect":"守护标志：为真时随主线程退出而终止","scenario":"后台心跳、监控采集等可被强杀的线程","example":"import threading\n\nt = threading.Thread(target=lambda: None)\nt.daemon = True\nt.start()","pitfall":"必须在 start() 之前设置，启动后赋值抛 RuntimeError。守护线程不保证收尾。","raises":"RuntimeError"},{"name":"threading.Thread.ident","rank":"必会","signature":"ident","params":[],"returns":"整数或 None","effect":"解释器内线程标识，未启动时为 None","scenario":"日志里区分线程，或作为字典键","example":"import threading\n\nt = threading.Thread(target=lambda: None)\nprint(t.ident)\nt.start()\nprint(t.ident)","pitfall":"线程结束后该标识可能被新线程复用，不能当永久主键。"},{"name":"threading.Thread.native_id","rank":"必会","signature":"native_id","params":[],"returns":"整数或 None","effect":"内核线程号，与操作系统工具对齐","scenario":"用 ps 或 top 定位具体线程","example":"import threading\n\nt = threading.Thread(target=lambda: None)\nt.start()\nprint(t.native_id)","pitfall":"3.8 起才有；未启动为 None，内核复用时同号会指向新线程。"},{"name":"threading.Thread.setDaemon","rank":"必会","signature":"setDaemon(daemonic)","params":[{"name":"daemonic","type":"bool","default":"必填","desc":"是否守护"}],"returns":"无","effect":"旧式写法设置守护标志","scenario":"维护老代码时对齐写法","example":"import threading\n\nt = threading.Thread(target=lambda: None)\nt.setDaemon(True)","pitfall":"3.10 起废弃，改用 daemon 属性。同样必须在 start() 前调用。","raises":"RuntimeError"}]' />

### 锁与互斥

<ApiTable :items='[{"name":"threading.Lock","rank":"必会","signature":"Lock()","params":[],"returns":"锁对象","methods":["locked() — 查询状态"],"effect":"把临界区串行化，避免两个线程同时改一个变量","scenario":"累加计数器、写同一个文件、改同一份缓存","example":"import threading\n\nlock = threading.Lock()\ntotal = 0\n\ndef add():\n    global total\n    with lock:\n        total += 1\n\nts = [threading.Thread(target=add) for _ in range(100)]\n[t.start() for t in ts]\n[t.join() for t in ts]\nprint(total)","exampleLang":"python","pitfall":"Lock 不可重入，同一线程重复 acquire 会自锁。漏掉 release 会让其他线程永久等待。","raises":"RuntimeError，release 未持有的锁时抛出"},{"name":"threading.Lock.acquire","rank":"必会","signature":"acquire(blocking=True, timeout=-1)","params":[{"name":"blocking","type":"bool","default":"True","desc":"是否阻塞等待"},{"name":"timeout","type":"float","default":"-1","desc":"阻塞上限秒数，-1 表示不设"}],"returns":"是否拿到锁","effect":"获取互斥锁，拿不到就等待或立即返回","scenario":"保护共享计数与共享容器","example":"import threading\n\nlock = threading.Lock()\nwith lock:\n    print(\"临界区\")","pitfall":"非阻塞返回 False 时容易忘记判断，从而进入未受保护的临界区。"},{"name":"threading.Lock.release","rank":"必会","signature":"release()","params":[],"returns":"无","effect":"释放互斥锁并唤醒等待者","scenario":"手工配平加锁与解锁","example":"import threading\n\nlock = threading.Lock()\nlock.acquire()\ntry:\n    pass\nfinally:\n    lock.release()","pitfall":"未持锁时调用抛 RuntimeError。优先用 with，避免泄漏。","raises":"RuntimeError"}]' />

### 条件与同步原语

<ApiTable :items='[{"name":"threading.Event","rank":"常用","signature":"Event()","params":[],"returns":"事件对象","methods":["set() — 置位","clear() — 复位","wait(timeout=None) — 等待置位","is_set() — 查询"],"effect":"让一个线程等待另一个线程发出开始或停止信号","scenario":"优雅停止后台线程、等待初始化完成","example":"import threading\n\nready = threading.Event()\n\ndef boot():\n    ready.set()\n\nthreading.Thread(target=boot).start()\nready.wait(timeout=3)\nprint(&#39;booted&#39;)","exampleLang":"python","pitfall":"Event 只表达一次信号，不保存历史。wait 超时返回 False，调用方要自己判断。","raises":"无异常，超时由 wait 的返回值表达"}]' />

### 线程本地与定时器

<ApiTable :items='[{"name":"threading.local","rank":"常用","signature":"local()","params":[],"returns":"线程本地对象","methods":["local() — 每线程独立副本","属性访问 — 各线程互不可见"],"effect":"给每个线程一份独立数据，避免共享竞争","scenario":"每线程一个数据库连接或请求上下文","example":"import threading\nlocal = threading.local()\n\ndef worker(name):\n    local.name = name\n    print(local.name)\n\nfor n in [\"A\", \"B\"]:\n    threading.Thread(target=worker, args=(n,)).start()","exampleLang":"python","pitfall":"local 按线程隔离，线程池复用线程时旧值会残留。用完要显式清理。","raises":"无异常，属性按线程各自保存"},{"name":"threading.Timer","rank":"了解","signature":"Timer(interval, function, args=None)","params":[{"name":"interval","type":"float","default":"必填","desc":"延迟秒数"},{"name":"function","type":"callable","default":"必填","desc":"到期执行的函数"}],"returns":"定时器对象","methods":["cancel() — 取消未触发的定时器"],"effect":"延迟执行一次函数，底层仍是线程","scenario":"超时兜底与延迟探测","example":"import threading\n\ntimer = threading.Timer(1.0, lambda: print(\"到期\"))\ntimer.start()\ntimer.cancel()","exampleLang":"python"}]' />
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
