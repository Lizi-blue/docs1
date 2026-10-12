---
title: "信号量与信号"
type: knowledge
domain: backend
knowledge_domain: communication
order: 3
level: intermediate
tags: [semaphore, event, barrier, signal, graceful-shutdown]
description: "信号量的通信语义、信号处理与进程组的优雅退出"
source_module: "signal"
api_methods:
  - "signal.signal"
  - "signal.SIGTERM"
  - "threading.Semaphore"
  - "multiprocessing.Event"
  - "os.killpg"
prerequisites:
  - /backend/learn/communication/queue-and-pipe
  - /backend/learn/concurrency/sync-primitives
related_knowledge:
  - /backend/learn/concurrency/subprocess-signals
  - /backend/learn/communication/shared-state
  - /backend/learn/concurrency/async-advanced
related_components:
  - /backend/components/safe-queue
---

# 信号量与信号

### 本讲要解决的问题

多个进程抢同一份资源时，怎么排队而不互相踩？
服务收到 SIGTERM 后，怎么把手上的活干完再退？
这一讲把信号量、事件、屏障与信号串成一条退场路径。
目标是让协调有额度，让退出有次序。

## TL;DR

> 信号量管并发额度，事件管一次广播，屏障管一批进程对齐。
> 三者不只是同步工具，它们都在传递状态。
> 信号由内核投递，Python 里只在主线程处理。
> SIGTERM 是退场请求，收到后要先收尾再退出。

## 概念定义

信号量内部有一个计数器，取许可减一，还许可加一。
计数为零时，后来的调用方阻塞等待。
事件是一个布尔标志，置位后全部等待者一起醒来。
屏障让一批进程互相等待，凑齐之后一起放行。
信号是内核发给进程的异步通知，用来表达终止或闹钟。
信号能表达的事件很少，所以只当退场开关用。

## 原理图解

下图画出条件变量与信号量上的等待与通知。

<DiagramFrame src="/diagrams/lock-wait-notify.html" title="条件变量与信号量的等待通知（Archify 交互图）" :height="540" />

## 关键对比

| 原语 | 计数 | 唤醒范围 | 典型用途 |
|---|---|---|---|
| Semaphore | 有，可大于一 | 唤醒一个等待者 | 限流与连接池 |
| BoundedSemaphore | 有，带上限 | 唤醒一个等待者 | 防止归还次数写错 |
| Event | 无，只有真假 | 唤醒全部等待者 | 启动与退场广播 |
| Barrier | 有，等于参与方 | 凑齐后全部放行 | 分批计算与对齐 |
| Condition | 无 | 可指定一个或全部 | 有界缓冲区的等待 |
| signal | 无 | 内核投递 | 退场与定时 |

### 官方依据与版本差异

- [signal 官方文档](https://docs.python.org/3/library/signal.html) — 3.8 起提供 `raise_signal`，3.13 起 `strsignal` 输出更完整。
- [threading 同步原语](https://docs.python.org/3/library/threading.html#semaphore-objects) — `Semaphore` 与 `BoundedSemaphore` 从 3.2 起可用。
- [multiprocessing 同步原语](https://docs.python.org/3/library/multiprocessing.html#synchronization-primitives) — `Semaphore` 与 `Barrier` 从 3.3 起可用。
- [PEP 475 重试系统调用](https://peps.python.org/pep-0475/) — 3.5 起系统调用遇到信号后会自动重试。

## API 手册：信号量与信号



### 必会接口

<ApiTable :items='[{"name":"signal.signal","rank":"必会","signature":"signal(signalnum, handler)","params":[{"name":"signalnum","type":"int | Signals","default":"-","desc":"信号编号，例如 SIGTERM"},{"name":"handler","type":"callable | int | None","default":"-","desc":"处理函数，或 SIG_IGN、SIG_DFL"}],"returns":"旧的处理函数或 SIG_DFL、SIG_IGN","methods":["SIG_IGN — 忽略该信号","SIG_DFL — 恢复系统默认动作","Signals and threads — 信号只在主线程处理"],"effect":"把某个信号交给指定函数处理","scenario":"容器里接收 SIGTERM 后准备退场","example":"import signal\n\ndef handle(signum: int, frame: object) -> None:\n    print(f\"收到 {signum}\")\n\nsignal.signal(signal.SIGTERM, handle)","exampleLang":"python","pitfall":"只有主线程能注册，子线程调用会抛 ValueError"},{"name":"signal.SIGTERM","rank":"必会","signature":"signal.SIGTERM","params":[],"returns":"信号编号常量","effect":"表达终止请求，进程可以捕获并收尾","scenario":"容器编排停止服务时先发的信号","example":"import os\nimport signal\n\nos.kill(os.getpid(), signal.SIGTERM)","exampleLang":"python","pitfall":"默认动作是直接退出，不注册处理函数就没有收尾机会"},{"name":"signal.SIGINT","rank":"必会","signature":"signal.SIGINT","params":[],"returns":"信号编号常量","effect":"终端按 Ctrl-C 时投递，默认抛 KeyboardInterrupt","scenario":"交互式脚本与本地调试","example":"import signal\n\nsignal.signal(signal.SIGINT, signal.SIG_IGN)  # 忽略 Ctrl-C","exampleLang":"python","pitfall":"忽略它会让脚本停不下来，生产代码要保留退出路径"},{"name":"threading.Semaphore","rank":"必会","signature":"Semaphore(value=1)","params":[{"name":"value","type":"int","default":"1","desc":"初始许可数"}],"returns":"计数信号量","methods":["acquire(blocking=True, timeout=None) — 取一个许可","release(n=1) — 归还许可","__enter__ / __exit__ — with 语法"],"effect":"把并发额度做成一个可等待的计数","scenario":"连接池、限流、限制同时读写磁盘的任务数","example":"import threading\n\nsem = threading.Semaphore(3)\nwith sem:\n    do_work()","exampleLang":"python","pitfall":"release 可以多加，计数会虚增，用 BoundedSemaphore 兜住"}]' />

### 常用接口

<ApiTable :items='[{"name":"signal.SIGHUP","rank":"常用","signature":"signal.SIGHUP","params":[],"returns":"信号编号常量","effect":"终端断开时投递，常被借来表示重载","scenario":"守护进程重读配置文件","example":"signal.signal(signal.SIGHUP, reload_config)","exampleLang":"python","pitfall":"非守护进程收到它默认直接退出，注册前要确认语义"},{"name":"signal.SIGKILL","rank":"常用","signature":"signal.SIGKILL","params":[],"returns":"信号编号常量","effect":"内核强制结束进程，不可捕获也不可忽略","scenario":"卡死进程的最后手段","example":"os.kill(pid, signal.SIGKILL)","exampleLang":"python","pitfall":"数据与锁状态无法保证，只能当兜底"},{"name":"signal.SIGCHLD","rank":"常用","signature":"signal.SIGCHLD","params":[],"returns":"信号编号常量","effect":"子进程状态变化时通知父进程","scenario":"父进程及时回收子进程，避免僵尸进程","example":"signal.signal(signal.SIGCHLD, reap)","exampleLang":"python","pitfall":"多个子进程同时退出时只合并投递一次，回收要循环"},{"name":"signal.raise_signal","rank":"常用","signature":"raise_signal(signum)","params":[{"name":"signum","type":"int","default":"-","desc":"要投递的信号编号"}],"returns":"None","effect":"向当前进程投递一个信号","scenario":"自测退场流程与故障注入","example":"import signal\n\nsignal.raise_signal(signal.SIGTERM)","exampleLang":"python","pitfall":"3.8 之前没有这个函数，旧版本要用 os.kill"},{"name":"signal.getsignal","rank":"常用","signature":"getsignal(signalnum)","params":[{"name":"signalnum","type":"int","default":"-","desc":"信号编号"}],"returns":"当前处理函数或 SIG_DFL、SIG_IGN","effect":"读回当前的处理函数，便于保存与恢复","scenario":"写库或框架时保存调用方的处理函数","example":"old = signal.getsignal(signal.SIGTERM)\ntry:\n    signal.signal(signal.SIGTERM, handle)\nfinally:\n    signal.signal(signal.SIGTERM, old)","exampleLang":"python","pitfall":"子线程读到的值可能不是主线程设置的那个"},{"name":"signal.strsignal","rank":"常用","signature":"strsignal(signum)","params":[{"name":"signum","type":"int","default":"-","desc":"信号编号"}],"returns":"可读的信号说明文本","effect":"把编号转成便于排查的文本","scenario":"日志里打印收到的是哪个信号","example":"print(signal.strsignal(signal.SIGTERM))","exampleLang":"python","pitfall":"文本随系统语言变化，不要拿它做分支判断"},{"name":"threading.BoundedSemaphore","rank":"常用","signature":"BoundedSemaphore(value=1)","params":[{"name":"value","type":"int","default":"1","desc":"初始许可数，也是上限"}],"returns":"带上限的计数信号量","effect":"release 超过上限时立刻抛 ValueError","scenario":"防止代码路径漏掉一次 acquire","example":"sem = threading.BoundedSemaphore(2)\nsem.release()  # ValueError","exampleLang":"python","pitfall":"只在超额归还时报错，漏归还它管不了"},{"name":"threading.Event","rank":"常用","signature":"Event()","params":[],"returns":"事件对象","methods":["set() — 置位并唤醒全部等待者","clear() — 复位","wait(timeout=None) — 等置位","is_set() — 读当前状态"],"effect":"一次置位唤醒所有等待者，是最简单的广播","scenario":"启动信号、退出信号、一次性就绪通知","example":"import threading\n\nstop = threading.Event()\nstop.wait(timeout=1.0)\nif stop.is_set():\n    pass","exampleLang":"python","pitfall":"置位不排队，先 set 再 wait 会立刻返回"},{"name":"threading.Barrier","rank":"常用","signature":"Barrier(parties, action=None, timeout=None)","params":[{"name":"parties","type":"int","default":"-","desc":"需要凑齐的等待方数量"},{"name":"action","type":"callable | None","default":"None","desc":"放行前由一个线程执行"},{"name":"timeout","type":"float | None","default":"None","desc":"默认等待上限"}],"returns":"屏障对象","methods":["wait(timeout=None) — 到场并等待","reset() — 复位屏障","abort() — 打断等待并抛 BrokenBarrierError","parties / n_waiting — 数量信息"],"effect":"让一批调用方互相等待，凑齐后一起继续","scenario":"分批计算、分阶段压测、生产者与消费者对齐轮次","example":"import threading\n\nbarrier = threading.Barrier(3)\nbarrier.wait(timeout=5)","exampleLang":"python","pitfall":"有人中途退出就会卡住，异常路径要记得 abort"},{"name":"multiprocessing.Event","rank":"常用","signature":"Event()","params":[],"returns":"跨进程事件","methods":["set() — 置位","clear() — 复位","wait(timeout=None) — 等待置位","is_set() — 读状态"],"effect":"把广播语义带进多进程场景","scenario":"主进程通知全部 worker 停止取新任务","example":"import multiprocessing as mp\n\nstop = mp.Event()\nstop.set()\nassert stop.is_set()","exampleLang":"python","pitfall":"它只传状态，不传数据，数据仍要走队列"},{"name":"os.killpg","rank":"常用","signature":"os.killpg(pgid, sig)","params":[{"name":"pgid","type":"int","default":"-","desc":"进程组编号"},{"name":"sig","type":"int","default":"-","desc":"信号编号"}],"returns":"None","effect":"把信号发给整个进程组","scenario":"一次停掉命令行拉起的整棵进程树","example":"import os\nimport signal\n\nos.killpg(os.getpgid(child.pid), signal.SIGTERM)","exampleLang":"python","pitfall":"组号取错会打到自己的进程组，先确认子进程已独立成组"},{"name":"os.getpgid","rank":"常用","signature":"os.getpgid(pid)","params":[{"name":"pid","type":"int","default":"-","desc":"进程编号"}],"returns":"进程组编号","effect":"查出某个进程所属的组号","scenario":"给 killpg 准备参数","example":"pgid = os.getpgid(child.pid)\nprint(pgid)","exampleLang":"python","pitfall":"进程已退出时抛 ProcessLookupError"}]' />

### 进阶与了解

<ApiTable :items='[{"name":"signal.pause","rank":"进阶","signature":"pause()","params":[],"returns":"None，直到收到信号才返回","effect":"挂起当前线程等待任意信号","scenario":"单线程守护进程的主循环","example":"signal.pause()","exampleLang":"python","pitfall":"收到信号后返回，处理函数抛错会直接终止进程"},{"name":"signal.alarm","rank":"进阶","signature":"alarm(seconds)","params":[{"name":"seconds","type":"int","default":"-","desc":"多少秒后发 SIGALRM，0 表示取消"}],"returns":"上一个闹钟剩余秒数","effect":"到点投递 SIGALRM，可用来给阻塞操作兜底","scenario":"给长时间阻塞的调用加超时","example":"signal.signal(signal.SIGALRM, on_timeout)\nsignal.alarm(3)","exampleLang":"python","pitfall":"粒度是整秒，且只对主线程有效"}]' />
## 组合用法：收到 SIGTERM 后优雅退出

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [同步原语与死锁](/backend/learn/concurrency/sync-primitives) | 事件与信号量的等待语义 |
| [子进程与信号](/backend/learn/concurrency/subprocess-signals) | 进程树与信号投递 |
| [队列与管道通信](/backend/learn/communication/queue-and-pipe) | 队列排空与哨兵退出 |

### 数据流图解

下图画出信号进入进程组、再由事件广播到 worker 的路径。

<DiagramFrame src="/diagrams/process-model.html" title="信号送进进程组与子进程（Archify 交互图）" :height="480" />

### 分步实现

1. 主线程注册 SIGTERM 处理函数。
2. 处理函数只把一个事件置位。
3. 工作循环每轮读一次事件状态。
4. 事件置位后停止取新任务。
5. 把手上的任务处理完。
6. 排空队列并等全部 worker 退出。
7. 超时的子进程用 `terminate()` 兜底。

### 对比表格

| 退出方式 | 收尾机会 | 数据风险 | 适用 |
|---|---|---|---|
| SIGTERM 加事件 | 有 | 低 | 服务与 worker |
| SIGINT 加捕获 | 有 | 低 | 交互式脚本 |
| terminate | 无 | 中 | 单个子进程 |
| SIGKILL | 无 | 高 | 卡死兜底 |

## 完整 Demo：信号广播加队列排空

### 场景描述

三个 worker 进程从队列取任务。
主进程给自己发一个 SIGTERM。
处理函数只置事件，worker 做完当前任务后逐个退出。

### 完整代码

```python
"""收到 SIGTERM 后优雅停止：事件广播加队列排空。"""
import multiprocessing as mp
import os
import queue
import signal
import time


def worker(tasks: "mp.Queue", stop: "mp.Event") -> None:
    while True:
        if stop.is_set() and tasks.empty():
            return
        try:
            item = tasks.get(timeout=0.2)
        except queue.Empty:
            continue
        time.sleep(0.05)
        print(f"处理 {item}")


def main() -> None:
    stop = mp.Event()
    tasks: mp.Queue = mp.Queue()

    def handle(signum: int, frame: object) -> None:
        stop.set()

    signal.signal(signal.SIGTERM, handle)
    children = [mp.Process(target=worker, args=(tasks, stop)) for _ in range(3)]
    for child in children:
        child.start()
    for index in range(20):
        tasks.put(index)
    os.kill(os.getpid(), signal.SIGTERM)
    for child in children:
        child.join(timeout=10)
        if child.is_alive():
            child.terminate()
    print("已优雅退出")


if __name__ == "__main__":
    main()
```

### 运行方式

```bash
python3 graceful_signal_demo.py
```

输出 20 行处理记录，最后一行是：已优雅退出。

### 常见误区

- 「处理函数里可以做任意事」是错的。它只在主线程的字节码间隙插入。
- 「信号能唤醒阻塞在 `get()` 的线程」是错的。等待者不会因此醒来，要配超时轮询。
- 「`SIGKILL` 也能捕获」是错的。它不可捕获，进程直接消失。
- 「信号量可以随便多还」是错的。普通信号量会虚增计数，用 `BoundedSemaphore` 才会立刻抛异常。

### 面试追问链

<details>
<summary>Q1：信号量为什么算通信原语？</summary>

它用计数表达剩余额度。
等待者据此判断能不能继续，这就是一种状态传递。

</details>

<details>
<summary>Q2：那事件和信号量差在哪？</summary>

事件只有真假两态，一次唤醒全部等待者。
信号量有计数，每次只放一个走。

</details>

<details>
<summary>Q3：为什么处理函数里只置事件？</summary>

处理函数在任意字节码边界插入。
在里面拿锁或写日志，容易与主流程互相等待。

</details>

<details>
<summary>Q4：SIGTERM 与 SIGINT 都要处理吗？</summary>

容器编排停服务发 SIGTERM，终端按 Ctrl-C 发 SIGINT。
两者都该走同一条退场路径。

</details>

<details>
<summary>Q5：子进程收不到信号怎么办？</summary>

单个进程收不到就用进程组投递。
用 `os.killpg` 按组发，再对超时进程补一次 `terminate()`。

</details>

### 下一讲衔接

进程内的协调已经讲完。
下一讲 [套接字与流](/backend/learn/communication/socket-and-streams) 把通道延伸到网络与 Unix 域。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 的关闭流程与本讲同源。
它先投哨兵，再对超时进程 `terminate()`。
