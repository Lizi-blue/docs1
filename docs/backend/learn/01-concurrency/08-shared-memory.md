---
title: "共享内存与进程间数据"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 8
level: advanced
tags: [shared-memory, manager, pickle, zero-copy]
description: "跨进程传大数据的三种做法与拷贝成本"
source_module: "multiprocessing.shared_memory"
api_methods:
  - "multiprocessing.Value"
  - "multiprocessing.Array"
  - "multiprocessing.Manager"
  - "multiprocessing.shared_memory.SharedMemory"
  - "multiprocessing.Lock"
prerequisites:
  - /backend/learn/concurrency/process-basics
  - /backend/learn/concurrency/executor-pools
related_knowledge:
  - /backend/learn/concurrency/queue-pipe
  - /backend/learn/concurrency/sync-primitives
related_components:
  - /backend/components/safe-queue
---

### 本讲要解决的问题

进程池很好用，可是一旦传递大数组，时间全花在序列化与拷贝上。这一讲比较三种共享数据的做法，并给出选择依据。

## TL;DR

> 进程默认不共享内存。传对象要序列化，大对象会拖慢整体。
> 少量标量用 Value 或 Array。大块数据用 shared_memory。需要共享复杂对象才用 Manager。

## 概念定义

共享内存指多个进程映射同一块物理内存，读写不再经过序列化。

进程有独立地址空间。默认传参要 pickle 后写入管道。共享内存把同一段内存映射到多个进程。读写像访问本地数组。代价是必须自己处理同步与生命周期。Manager 走另一条路：它启动管理进程，其他进程通过代理对象远程调用。

## 原理图解

下图对比线程共享地址空间与进程独立地址空间，并标出跨进程要过的序列化关口。

<DiagramFrame src="/diagrams/process-model.html" title="线程与进程的内存模型（Archify 交互图）" :height="520" />

## 关键对比

| 方式 | 适用数据 | 拷贝成本 | 同步责任 |
|---|---|---|---|
| 普通参数传递 | 小对象 | 每次调用都拷贝 | 无 |
| Value 与 Array | 标量与定长数组 | 一次映射后无拷贝 | 调用方加锁 |
| shared_memory | 大块字节或数组 | 无拷贝 | 调用方加锁并管理生命周期 |
| Manager | 任意可 pickle 对象 | 每次访问都走代理 | 管理器内部处理 |
| 队列 | 消息与任务 | 每条约一次序列化 | 队列自带锁 |

### 官方依据与版本差异

- [shared_memory 官方文档](https://docs.python.org/3/library/multiprocessing.shared_memory.html) — 3.8 起提供。
- [共享 ctypes 对象](https://docs.python.org/3/library/multiprocessing.html#shared-ctypes-objects) — Value 与 Array 自 2.6 起提供。
- [Manager 代理对象](https://docs.python.org/3/library/multiprocessing.html#managers) — 3.8 及以后提供，代理调用走进程间通信。

## API 手册：multiprocessing 的共享数据



### 常用接口

<ApiTable :items='[{"name":"multiprocessing.Value","rank":"常用","signature":"Value(typecode_or_type, *args, lock=True)","params":[{"name":"typecode_or_type","type":"str","default":"必填","desc":"类型码，如 i 表示整数"},{"name":"lock","type":"bool","default":"True","desc":"是否自带锁"}],"returns":"共享标量对象","methods":["get_lock() — 取内部锁","value — 读写属性"],"effect":"让多个进程读写同一个标量","scenario":"计数器、进度位、状态标记","example":"import multiprocessing as mp\n\nif __name__ == \"__main__\":\n    counter = mp.Value(\"i\", 0)\n    with counter.get_lock():\n        counter.value += 1\n    print(counter.value)","exampleLang":"python","pitfall":"自带锁只保护单次读写。复合更新要先取内部锁再算。","raises":"无异常，跨进程访问要自己加锁"},{"name":"shared_memory.ShareableList","rank":"常用","signature":"ShareableList(sequence_or_size, *, name=None)","params":[{"name":"sequence_or_size","type":"list 或 int","default":"必填","desc":"初始序列或元素个数"},{"name":"name","type":"str","default":"None","desc":"复用时指定共享段名字"}],"returns":"可共享的定长列表","methods":["ShareableList[i] — 读写元素","ShareableList.shm — 底层共享段"],"effect":"让多个进程读写同一份定长列表","scenario":"共享小配置、固定长度的结果槽","example":"from multiprocessing import shared_memory\n\nsl = shared_memory.ShareableList([&#39;a&#39;, 1])\nprint(sl[0])\nsl.shm.close()\nsl.shm.unlink()","exampleLang":"python","pitfall":"元素类型与长度在创建时固定，数值也不能原地自增。","raises":"ValueError，元素类型与创建时不一致"},{"name":"multiprocessing.managers.SharedMemoryManager","rank":"常用","signature":"SharedMemoryManager()","params":[],"returns":"共享内存管理器","methods":["SharedMemoryManager.SharedMemory(size) — 新建共享段","SharedMemoryManager.ShareableList(seq) — 新建共享列表","SharedMemoryManager.shutdown() — 回收全部段"],"effect":"退出时自动回收本管理器创建的共享段","scenario":"脚本与测试里托管共享内存生命周期","example":"from multiprocessing.managers import SharedMemoryManager\n\nwith SharedMemoryManager() as smm:\n    shm = smm.SharedMemory(size=16)\n    print(shm.size)","exampleLang":"python","pitfall":"它只回收自己创建的段。手工创建的段仍要自己 unlink。","raises":"无异常，with 退出时自动回收"},{"name":"multiprocessing.Array","rank":"常用","signature":"Array(typecode_or_type, size_or_initializer, lock=True)","params":[{"name":"typecode_or_type","type":"str","default":"必填","desc":"元素类型码"},{"name":"size_or_initializer","type":"int | sequence","default":"必填","desc":"长度或初始值"}],"returns":"共享定长数组","methods":["get_lock() — 取内部锁","[:] — 切片读写"],"effect":"多进程共享一段连续数组","scenario":"共享计数数组、共享结果表","example":"import multiprocessing as mp\n\nif __name__ == \"__main__\":\n    shared = mp.Array(\"d\", [0.0, 0.0, 0.0])\n    print(list(shared))","exampleLang":"python","pitfall":"切片读写不会自动加锁。多进程同时写同一段要自己加锁。","raises":"无异常，切片读写要自己加锁"},{"name":"multiprocessing.Manager","rank":"常用","signature":"Manager()","params":[],"returns":"管理器对象","methods":["dict() — 共享字典代理","list() — 共享列表代理","Queue() — 队列代理","shutdown() — 关闭管理进程"],"effect":"用代理对象暴露共享容器","scenario":"需要共享字典或嵌套结构","example":"import multiprocessing as mp\n\nif __name__ == \"__main__\":\n    with mp.Manager() as manager:\n        table = manager.dict()\n        table[\"计数\"] = 1\n        print(dict(table))","exampleLang":"python","pitfall":"代理每次访问都走管理进程。管理进程一死，全部代理失效。","raises":"BrokenPipeError，管理进程退出之后"}]' />

### 进阶与了解

<ApiTable :items='[{"name":"shared_memory.SharedMemory","rank":"进阶","signature":"SharedMemory(name=None, create=False, size=0)","params":[{"name":"create","type":"bool","default":"False","desc":"是否创建新段"},{"name":"size","type":"int","default":"0","desc":"段大小，创建时必填"}],"returns":"共享内存段","methods":["buf — memoryview 视图","close() — 关闭本进程映射","unlink() — 释放段，最后一个使用者调用","SharedMemory.name — 共享段名字","SharedMemory.size — 字节长度"],"effect":"多进程零拷贝访问同一段内存","scenario":"共享大数组、图像缓冲","example":"from multiprocessing import shared_memory\n\nshm = shared_memory.SharedMemory(create=True, size=1024)\nshm.buf[0] = 1\nshm.close()\nshm.unlink()","exampleLang":"python"}]' />

### 必会接口

<ApiTable :items='[{"name":"multiprocessing.Lock","rank":"必会","signature":"Lock()","params":[],"returns":"跨进程锁","methods":["acquire(block=True, timeout=None) — 加锁","release() — 解锁"],"effect":"给共享内存与共享容器提供互斥","scenario":"共享数组写入、Manager 复合操作","example":"import multiprocessing as mp\n\nif __name__ == \"__main__\":\n    lock = mp.Lock()\n    with lock:\n        print(\"临界区\")","exampleLang":"python","pitfall":"锁要随参数传给子进程。绕过锁直接改共享内存会读到脏数据。","raises":"无异常，acquire 超时返回 False"}]' />
## 组合用法：大数组分块并行加共享结果

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [共享内存与进程间数据](/backend/learn/concurrency/shared-memory) | 零拷贝共享数组 |
| [执行器与任务编排](/backend/learn/concurrency/executor-pools) | 进程池与结果回收 |
| [同步原语与死锁](/backend/learn/concurrency/sync-primitives) | 写入互斥 |

### 数据流图解

<DiagramFrame src="/diagrams/process-model.html" title="把大数组映射进多个进程（Archify 交互图）" :height="460" />

### 分步实现

1. 评估数据体积与调用次数。
2. 体积小就直接传参。
3. 体积大就建共享段并把名字传给子进程。
4. 子进程用切片读写，写入时加锁。
5. 主进程等全部结束再 unlink 释放段。

### 对比表格

| 判断条件 | 建议做法 | 理由 |
|---|---|---|
| 数据小于几十 KB | 直接传参 | 序列化成本可忽略 |
| 数据大且只读 | shared_memory | 零拷贝收益最高 |
| 数据大且频繁改写 | shared_memory 加锁 | 拷贝成本高于加锁成本 |
| 结构复杂且访问不频繁 | Manager | 写法简单，代理开销可接受 |

## 完整 Demo：共享数组求和

### 场景描述

把两千万个浮点数写入共享段，四个进程各算一段，主进程汇总结果。

### 完整代码

```python
import array
from multiprocessing import Process, shared_memory

SIZE = 20_000_000
WORKERS = 4


def partial(name: str, start: int, end: int, results: dict) -> None:
    shm = shared_memory.SharedMemory(name=name)
    view = memoryview(shm.buf).cast("d")
    results[start] = sum(view[start:end])
    shm.close()


if __name__ == "__main__":
    shm = shared_memory.SharedMemory(create=True, size=SIZE * 8)
    view = memoryview(shm.buf).cast("d")
    view[:] = array.array("d", [1.0]) * SIZE

    step = SIZE // WORKERS
    results: dict = {}
    processes = [
        Process(target=partial, args=(shm.name, i * step, (i + 1) * step, results))
        for i in range(WORKERS)
    ]
    for process in processes:
        process.start()
    for process in processes:
        process.join()

    print(f"合计 {sum(results.values()):.0f}")
    shm.close()
    shm.unlink()
```

### 运行方式

```bash
python3 shared_memory_demo.py
```

### 常见误区

- 忘记 unlink。共享段会留在系统里，直到机器重启。
- 以为共享内存自带同步。它只提供内存，不加锁。
- 用 Manager 传大数组。每次访问都要序列化，比直接传参更慢。
- 在 Windows 上用 fork 的写法。默认 spawn 下子进程拿不到父进程的映射。

### 面试追问链

<details>
<summary>Q1：为什么大对象传参会变慢？</summary>

每次调用都要 pickle 并复制。复制成本随体积线性增长。

</details>

<details>
<summary>Q2：共享内存的代价是什么？</summary>

要自己加锁，还要管理创建与释放。忘了 unlink 就泄漏。

</details>

<details>
<summary>Q3：Manager 适合什么场景？</summary>

共享字典或嵌套结构，且访问不频繁。代理调用本身有开销。

</details>

<details>
<summary>Q4：怎么判断该用哪种？</summary>

看数据体积与访问次数。先量一次序列化耗时，再决定是否上共享内存。

</details>

### 下一讲衔接

共享内存解决进程间大数据。接着读[asyncio 进阶模式](/backend/learn/concurrency/async-advanced)，看单线程高并发的写法。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 用队列传递任务元数据，与共享内存互补。
