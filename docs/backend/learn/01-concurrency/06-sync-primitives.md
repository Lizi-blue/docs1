---
title: "同步原语与死锁"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 6
level: intermediate
tags: [lock, condition, semaphore, deadlock]
description: "锁家族的分工、协作模式与死锁排查"
source_module: "threading"
api_methods:
  - "threading.RLock"
  - "threading.Condition"
  - "threading.Semaphore"
  - "threading.Barrier"
  - "faulthandler.dump_traceback_later"
prerequisites:
  - /backend/learn/concurrency/thread-basics
related_knowledge:
  - /backend/learn/concurrency/thread-basics
  - /backend/learn/concurrency/queue-pipe
related_components:
  - /backend/components/safe-queue
---

### 本讲要解决的问题

线程基础只讲了 Lock。真实代码还需要可重入锁、条件等待、并发配额与集合点。这一讲把锁家族一次讲全，并给出死锁的机械排查办法。

## TL;DR

> Lock 管互斥，RLock 管同一线程重入。Condition 管等待通知，Semaphore 管并发配额。
> 死锁四个条件缺一不可。排查靠抓栈，不靠猜。

## 概念定义

同步原语是协调线程执行顺序的底层工具，各自约束一类竞争关系。

互斥锁保证临界区同一时刻只有一个线程。条件变量让线程在条件不满足时挂起，并在状态改变后被唤醒。信号量用计数限制同时进入的线程数。栅栏让一批线程到达同一点后再一起继续。选择依据是你要约束的是互斥、状态、配额还是集合点。

## 原理图解

下图画出等待通知的完整握手，以及信号量在许可耗尽时的阻塞与归还。

<DiagramFrame src="/diagrams/lock-wait-notify.html" title="条件变量与信号量的等待通知（Archify 交互图）" :height="540" />

## 关键对比

| 原语 | 约束什么 | 典型误用 |
|---|---|---|
| Lock | 同一时刻一个线程进临界区 | 嵌套获取同一把锁 |
| RLock | 同一线程可重复获取 | 用 RLock 掩盖设计问题 |
| Condition | 条件不满足时挂起 | 用 if 判断条件 |
| Semaphore | 同时执行的线程数量 | 把配额当成互斥锁 |
| Barrier | 一批线程对齐后再继续 | 参与方数量写错 |
| Event | 一次性广播状态 | 需要反复通知时误用 |

### 官方依据与版本差异

- [同步原语清单](https://docs.python.org/3/library/threading.html#lock-objects) — 3.8 及以后提供 Lock 与 RLock 与 Condition 与 Semaphore 与 Barrier。
- [faulthandler 官方文档](https://docs.python.org/3/library/faulthandler.html) — 3.3 起提供，可定时抓栈。
- [信号与线程](https://docs.python.org/3/library/signal.html#signals-and-threads) — 3.8 及以后行为一致，信号只在主线程处理。

## API 手册：threading 的协作原语

<ApiTable :items='[{"name": "threading.RLock", "rank": "常用", "signature": "RLock()", "params": [], "returns": "可重入锁对象", "methods": ["acquire() — 加锁，同一线程可重复", "release() — 解锁，次数必须配平", "locked() — 查询状态"], "effect": "同一线程重复进入临界区不会自锁", "scenario": "类的公有方法互相调用且都要加锁", "example": "import threading\nlock = threading.RLock()\n\ndef outer():\n    with lock:\n        inner()\n\ndef inner():\n    with lock:\n        print(\"reentrant\")", "exampleLang": "python"}, {"name": "threading.Condition", "rank": "必会", "signature": "Condition(lock=None)", "params": [{"name": "lock", "type": "Lock", "default": "None", "desc": "底层锁，缺省新建 RLock"}], "returns": "条件变量对象", "methods": ["wait(timeout=None) — 释放锁并挂起", "notify(n=1) — 唤醒指定数量", "notify_all() — 唤醒全部"], "effect": "让线程等到条件成立再继续", "scenario": "有界缓冲区的空满判断", "example": "import threading\ncond = threading.Condition()\nready = []\n\nwith cond:\n    while not ready:\n        cond.wait(timeout=1)", "exampleLang": "python"}, {"name": "threading.Semaphore", "rank": "必会", "signature": "Semaphore(value=1)", "params": [{"name": "value", "type": "int", "default": "1", "desc": "初始许可数"}], "returns": "信号量对象", "methods": ["acquire(blocking=True, timeout=None) — 取许可", "release(n=1) — 归还许可"], "effect": "限制同时进入的线程数量", "scenario": "限制并发访问外部接口的数量", "example": "import threading\nsem = threading.Semaphore(3)\n\ndef call_api():\n    with sem:\n        print(\"仅三个线程可同时进入\")", "exampleLang": "python"}, {"name": "threading.Barrier", "rank": "进阶", "signature": "Barrier(parties, action=None, timeout=None)", "params": [{"name": "parties", "type": "int", "default": "必填", "desc": "参与线程数"}, {"name": "action", "type": "callable", "default": "None", "desc": "全部到达后执行一次"}], "returns": "栅栏对象", "methods": ["wait(timeout=None) — 到达并等待", "abort() — 让等待者抛错", "reset() — 复位"], "effect": "让一批线程对齐后再一起继续", "scenario": "并发压测的统一起跑与分阶段计算", "example": "import threading\nbarrier = threading.Barrier(3)\n\ndef stage(name):\n    barrier.wait()\n    print(name, \"开始\")", "exampleLang": "python"}, {"name": "faulthandler.dump_traceback_later", "rank": "进阶", "signature": "dump_traceback_later(timeout, repeat=False, file=sys.stderr)", "params": [{"name": "timeout", "type": "float", "default": "必填", "desc": "多少秒后抓栈"}, {"name": "repeat", "type": "bool", "default": "False", "desc": "是否重复抓取"}], "returns": "无", "methods": ["dump_traceback() — 立即抓栈", "cancel_dump_traceback_later() — 取消"], "effect": "卡死时打印所有线程的调用栈", "scenario": "线上疑似死锁或长阻塞", "example": "import faulthandler\nfaulthandler.dump_traceback_later(10, repeat=True)", "exampleLang": "python"}]' />

## 组合用法：有界缓冲区加并发配额

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [同步原语与死锁](/backend/learn/concurrency/sync-primitives) | 条件等待与配额 |
| [Queue 通信](/backend/learn/concurrency/queue-pipe) | 队列与哨兵退出 |
| [多线程基础](/backend/learn/concurrency/thread-basics) | 线程生命周期 |

### 数据流图解

<DiagramFrame src="/diagrams/lock-wait-notify.html" title="等待、通知与限流（Archify 交互图）" :height="460" />

### 分步实现

1. 用 Condition 保护缓冲区状态。
2. 消费者在缓冲区为空时等待。
3. 生产者在放入元素后发出通知。
4. 用 Semaphore 限制外部调用并发数。
5. 退出时唤醒全部等待者并投递哨兵。

### 对比表格

| 方案 | 何时使用 | 代价 |
|---|---|---|
| Condition | 需要按状态唤醒 | 必须配 while 判断 |
| Semaphore | 只限制并发数量 | 不表达业务状态 |
| Queue | 需要缓冲与解耦 | 无界队列会吃内存 |
| Event | 一次性信号 | 不适合反复通知 |

## 完整 Demo：可重入计数加栅栏对齐

### 场景描述

三个线程先各自累加共享计数，再用栅栏对齐，最后一起输出各自结果。

### 完整代码

```python
import threading

lock = threading.RLock()
counter = 0
barrier = threading.Barrier(3)
results: list[int] = []


def accumulate(times: int, name: str) -> None:
    global counter
    local = 0
    for _ in range(times):
        with lock:
            counter += 1
            local += 1
    results.append(local)
    barrier.wait()
    print(f"{name} 本地 {local}，全局 {counter}")


if __name__ == "__main__":
    threads = [threading.Thread(target=accumulate, args=(1000, f"T{i}")) for i in range(3)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    print(f"总计 {counter}，本地合计 {sum(results)}")
```

### 运行方式

```bash
python3 primitives_demo.py
```

### 常见误区

- 用 if 判断等待条件。被唤醒后条件可能再次不成立。
- 用两把锁互相等待。这是死锁的经典起点。
- 把 RLock 当成万能解。它只解决同一线程重入。
- 忘记 release 导致许可泄漏。信号量会永久少一个许可。

### 面试追问链

<details>
<summary>Q1：为什么条件判断要用 while？</summary>

唤醒只是重新竞争锁。条件可能已被其他线程破坏。

</details>

<details>
<summary>Q2：死锁需要同时满足哪四个条件？</summary>

互斥、持有并等待、不可剥夺、循环等待。破坏任一条件即可解除。

</details>

<details>
<summary>Q3：线上怎么确认死锁？</summary>

用 faulthandler 抓所有线程栈。看到互相等待的对锁即为死锁。

</details>

<details>
<summary>Q4：信号量与互斥锁的差别？</summary>

互斥锁限定一个持有者。信号量限定同时进入的数量。

</details>

### 下一讲衔接

原语解决线程内协作。线程一多，手工管理就吃力。接着读[执行器与任务编排](/backend/learn/concurrency/executor-pools)。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 用队列与哨兵实现同样的协作语义，并覆盖跨进程场景。
