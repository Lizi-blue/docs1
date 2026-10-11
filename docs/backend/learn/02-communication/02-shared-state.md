---
title: "共享状态与共享内存"
type: knowledge
domain: backend
knowledge_domain: communication
order: 2
level: advanced
tags: [shared-memory, manager, proxy, lifecycle]
description: "Value、Array、Manager 代理与 SharedMemory 的取舍"
source_module: "multiprocessing.shared_memory"
api_methods:
  - "multiprocessing.shared_memory.SharedMemory"
  - "SharedMemory.close"
  - "SharedMemory.unlink"
  - "multiprocessing.Value"
  - "multiprocessing.Manager"
prerequisites:
  - /backend/learn/communication/queue-and-pipe
  - /backend/learn/concurrency/process-basics
related_knowledge:
  - /backend/learn/concurrency/shared-memory
  - /backend/learn/concurrency/sync-primitives
  - /backend/learn/communication/semaphore-and-signal
related_components:
  - /backend/components/safe-queue
---

# 共享状态与共享内存

### 本讲要解决的问题

两个进程要共同维护一份状态时，选复制还是选共享？
进程退出后，动态申请的共享段由谁回收？
这一讲比较 Value、Array、Manager 代理与共享内存。
目标是按体积、访问频率与生命周期做选择。

## TL;DR

> 队列每次传递都要序列化，大数组复制一次就很贵。
> `Value` 与 `Array` 建在共享内存上，自带一把锁。
> `Manager` 返回代理对象，用法像普通对象，但每次访问都要过一遍管理进程。
> `SharedMemory` 给零拷贝缓冲区，代价是生命周期要自己管。

## 概念定义

共享状态指多个进程能看到同一份数据。
复制传递把对象序列化后送到对端，两端各留一份。
共享内存把同一段物理内存映射进多个进程的地址空间。
代理把操作转发给管理进程，数据仍留在管理进程里。
三者的差别落在两处：复制次数与同步成本。
选择顺序是体积优先，再看访问频率与收尾方式。

## 原理图解

下图画出进程边界、共享内存与锁的位置。

<DiagramFrame src="/diagrams/process-model.html" title="线程与进程的内存模型（Archify 交互图）" :height="520" />

## 关键对比

| 维度 | Value 与 Array | Manager 代理 | SharedMemory | 队列 |
|---|---|---|---|---|
| 数据位置 | 共享内存映射 | 管理进程堆 | 共享内存段 | 两端各一份 |
| 访问方式 | 直接读写 | 远程调用 | 直接读写 | 存取消息 |
| 复制次数 | 一次或零次 | 每次访问一次 | 零次 | 每条一次 |
| 同步 | 自带锁 | 管理进程串行 | 自己加锁 | 队列自带 |
| 生命周期 | 随对象引用 | 随 Manager | 按段名与使用者 | 随队列 |
| 适用 | 计数器与小数组 | 字典与复杂结构 | 大数组与图像 | 任务分发 |

### 官方依据与版本差异

- [共享内存官方文档](https://docs.python.org/3/library/multiprocessing.shared_memory.html) — 3.8 起提供，3.13 起支持 `track` 参数。
- [multiprocessing 同步原语](https://docs.python.org/3/library/multiprocessing.html#synchronization-primitives) — `Value` 与 `Array` 从 2.6 起可用。
- [SharedMemory 与资源追踪](https://docs.python.org/3/library/multiprocessing.shared_memory.html#multiprocessing.shared_memory.SharedMemory) — 3.13 起 `resource_tracker` 行为有调整。
- [PEP 371 multiprocessing](https://peps.python.org/pep-0371/) — 2.6 起提供进程与共享对象。

## API 手册：共享内存与代理

<ApiTable :items='[{&quot;name&quot;:&quot;multiprocessing.shared_memory.SharedMemory&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;SharedMemory(name=None, create=False, size=0)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;name&quot;,&quot;type&quot;:&quot;str | None&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;段名。创建时留空表示自动取名&quot;},{&quot;name&quot;:&quot;create&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;False&quot;,&quot;desc&quot;:&quot;是否新建一段共享内存&quot;},{&quot;name&quot;:&quot;size&quot;,&quot;type&quot;:&quot;int&quot;,&quot;default&quot;:&quot;0&quot;,&quot;desc&quot;:&quot;段字节数，创建时必填&quot;}],&quot;returns&quot;:&quot;映射好的共享内存对象&quot;,&quot;methods&quot;:[&quot;close() — 断开本进程映射&quot;,&quot;unlink() — 删除底层内存段&quot;,&quot;buf — memoryview 视图&quot;,&quot;name — 段名，供其他进程挂载&quot;,&quot;size — 段字节数&quot;],&quot;effect&quot;:&quot;把同一段物理内存映射进多个进程，读写零拷贝&quot;,&quot;scenario&quot;:&quot;大数组、图像缓冲与批量数值计算&quot;,&quot;example&quot;:&quot;from multiprocessing import shared_memory\n\nshm = shared_memory.SharedMemory(create=True, size=1024)\nview = memoryview(shm.buf)\nview[0] = 65\nprint(shm.name)\nshm.close()\nshm.unlink()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;create 为 True 时 size 必须大于 0，否则抛 ValueError&quot;},{&quot;name&quot;:&quot;SharedMemory.close&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;close()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;断开当前进程的映射，段本身仍然存在&quot;,&quot;scenario&quot;:&quot;子进程用完缓冲区后立即断开&quot;,&quot;example&quot;:&quot;shm = shared_memory.SharedMemory(name=name)\nview = memoryview(shm.buf)\ndata = bytes(view[:16])\nview.release()\nshm.close()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;忘记 close 会一直占着一个文件描述符&quot;},{&quot;name&quot;:&quot;SharedMemory.unlink&quot;,&quot;rank&quot;:&quot;必会&quot;,&quot;signature&quot;:&quot;unlink()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;None&quot;,&quot;effect&quot;:&quot;删除内核里的段名，已映射的进程仍可读写&quot;,&quot;scenario&quot;:&quot;创建方在全部使用者退出后回收内存&quot;,&quot;example&quot;:&quot;shm.close()\nshm.unlink()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;只有创建方该调用，多进程各调一次会抛 FileNotFoundError&quot;},{&quot;name&quot;:&quot;SharedMemory.buf&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;buf&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;memoryview&quot;,&quot;effect&quot;:&quot;指向共享段的零拷贝视图&quot;,&quot;scenario&quot;:&quot;配合 struct 或 numpy 按类型解读字节&quot;,&quot;example&quot;:&quot;import struct\n\nview = memoryview(shm.buf)\nview[:4] = struct.pack(\&quot;!I\&quot;, 42)\nprint(struct.unpack(\&quot;!I\&quot;, view[:4]))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;视图长度就是段大小，越界切片会抛 IndexError&quot;},{&quot;name&quot;:&quot;SharedMemory.name&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;name&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;str&quot;,&quot;effect&quot;:&quot;读出不带路径前缀的段名&quot;,&quot;scenario&quot;:&quot;把段名当参数传给子进程&quot;,&quot;example&quot;:&quot;name = shm.name\nchild = Process(target=worker, args=(name,))\nchild.start()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;段名只在当前机器有效，跨机器要换成套接字&quot;},{&quot;name&quot;:&quot;SharedMemory.size&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;size&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;int&quot;,&quot;effect&quot;:&quot;读出段的字节数&quot;,&quot;scenario&quot;:&quot;接收方按长度校验缓冲区是否够大&quot;,&quot;example&quot;:&quot;view = memoryview(shm.buf)\nprint(shm.size, len(view))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;重挂载时 size 由段本身决定，传错参数不会改大小&quot;},{&quot;name&quot;:&quot;multiprocessing.managers.SharedMemoryManager&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;SharedMemoryManager(address=None, authkey=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;address&quot;,&quot;type&quot;:&quot;tuple | str | None&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;管理进程的地址&quot;},{&quot;name&quot;:&quot;authkey&quot;,&quot;type&quot;:&quot;bytes | None&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;连接凭据&quot;}],&quot;returns&quot;:&quot;带 SharedMemory 与 ShareableList 工厂的管理器&quot;,&quot;methods&quot;:[&quot;SharedMemory(size) — 建一段并登记回收&quot;,&quot;ShareableList(sequence) — 建一个可共享列表&quot;,&quot;shutdown() — 回收全部登记段&quot;,&quot;__enter__ / __exit__ — 上下文管理&quot;],&quot;effect&quot;:&quot;让管理器在退出时自动 unlink 全部段&quot;,&quot;scenario&quot;:&quot;不想手写回收逻辑的多进程任务&quot;,&quot;example&quot;:&quot;from multiprocessing.managers import SharedMemoryManager\n\nwith SharedMemoryManager() as smm:\n    shm = smm.SharedMemory(size=1024)\n    print(shm.size)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;管理器进程被强杀时不会回收，段仍留在内核里&quot;},{&quot;name&quot;:&quot;multiprocessing.shared_memory.ShareableList&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;ShareableList(sequence=None, *, name=None)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;sequence&quot;,&quot;type&quot;:&quot;Sequence | None&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;初始元素，创建时提供&quot;},{&quot;name&quot;:&quot;name&quot;,&quot;type&quot;:&quot;str | None&quot;,&quot;default&quot;:&quot;None&quot;,&quot;desc&quot;:&quot;已有段的段名&quot;}],&quot;returns&quot;:&quot;定长的共享列表&quot;,&quot;methods&quot;:[&quot;shm — 底层 SharedMemory&quot;,&quot;count / index — 只读查询&quot;,&quot;format — 元素类型&quot;,&quot;close() / unlink() — 转发到底层段&quot;],&quot;effect&quot;:&quot;免去手工算偏移与类型，直接按下标读写&quot;,&quot;scenario&quot;:&quot;跨进程共享少量定长字符串或数值&quot;,&quot;example&quot;:&quot;from multiprocessing.shared_memory import ShareableList\n\nsl = ShareableList([\&quot;a\&quot;, \&quot;b\&quot;])\nsl[1] = \&quot;c\&quot;\nprint(sl[1])\nsl.shm.close()\nsl.shm.unlink()&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;元素个数定死，扩容要重建整段&quot;},{&quot;name&quot;:&quot;multiprocessing.Value&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;Value(typecode_or_type, *args, lock=True)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;typecode_or_type&quot;,&quot;type&quot;:&quot;str | type&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;类型码，例如 i 或 d&quot;},{&quot;name&quot;:&quot;lock&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;True&quot;,&quot;desc&quot;:&quot;是否附带一把可重入锁&quot;}],&quot;returns&quot;:&quot;带 value 属性的共享标量&quot;,&quot;effect&quot;:&quot;共享内存里的单个值，读写走同类锁保护&quot;,&quot;scenario&quot;:&quot;跨进程计数器、开关与进度值&quot;,&quot;example&quot;:&quot;from multiprocessing import Process, Value\n\ncounter = Value(\&quot;i\&quot;, 0)\nchild = Process(target=bump, args=(counter,))\nchild.start()\nchild.join()\nprint(counter.value)&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;读改写不是原子操作，先取值再赋值仍要自己加锁&quot;},{&quot;name&quot;:&quot;multiprocessing.Array&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;Array(typecode_or_type, size_or_initializer, *, lock=True)&quot;,&quot;params&quot;:[{&quot;name&quot;:&quot;typecode_or_type&quot;,&quot;type&quot;:&quot;str | type&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;元素类型码&quot;},{&quot;name&quot;:&quot;size_or_initializer&quot;,&quot;type&quot;:&quot;int | Sequence&quot;,&quot;default&quot;:&quot;-&quot;,&quot;desc&quot;:&quot;元素个数或初始序列&quot;},{&quot;name&quot;:&quot;lock&quot;,&quot;type&quot;:&quot;bool&quot;,&quot;default&quot;:&quot;True&quot;,&quot;desc&quot;:&quot;是否附带锁&quot;}],&quot;returns&quot;:&quot;共享数组对象&quot;,&quot;effect&quot;:&quot;连续内存上的同类型数组，可当序列读写&quot;,&quot;scenario&quot;:&quot;中等体积的数值数组与批量统计&quot;,&quot;example&quot;:&quot;from multiprocessing import Array\n\narr = Array(\&quot;d\&quot;, [0.0, 1.0, 2.0])\narr[1] = 5.0\nprint(list(arr))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;元素类型由类型码决定，写错会静默截断&quot;},{&quot;name&quot;:&quot;multiprocessing.Manager&quot;,&quot;rank&quot;:&quot;常用&quot;,&quot;signature&quot;:&quot;Manager()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;管理进程的代理工厂&quot;,&quot;methods&quot;:[&quot;dict() / list() — 创建代理容器&quot;,&quot;Queue() — 创建代理队列&quot;,&quot;Value() / Array() — 代理共享标量&quot;,&quot;shutdown() — 停止管理进程&quot;],&quot;effect&quot;:&quot;所有操作转发给管理进程，在那边串行执行&quot;,&quot;scenario&quot;:&quot;需要共享字典或复杂结构的场景&quot;,&quot;example&quot;:&quot;from multiprocessing import Manager, Process\n\nwith Manager() as manager:\n    shared = manager.dict()\n    shared[\&quot;k\&quot;] = 1\n    print(dict(shared))&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;每次属性访问都是一次进程间调用，高频读写会慢很多&quot;},{&quot;name&quot;:&quot;multiprocessing.Lock&quot;,&quot;rank&quot;:&quot;进阶&quot;,&quot;signature&quot;:&quot;Lock()&quot;,&quot;params&quot;:[],&quot;returns&quot;:&quot;跨进程互斥锁&quot;,&quot;methods&quot;:[&quot;acquire(block=True, timeout=None) — 加锁&quot;,&quot;release() — 解锁&quot;,&quot;__enter__ / __exit__ — with 语法&quot;],&quot;effect&quot;:&quot;为共享内存里的读改写提供互斥&quot;,&quot;scenario&quot;:&quot;多个写入方同时改一段共享数组&quot;,&quot;example&quot;:&quot;from multiprocessing import Array, Lock\n\nlock = Lock()\narr = Array(\&quot;i\&quot;, 4)\nwith lock:\n    arr[0] += 1&quot;,&quot;exampleLang&quot;:&quot;python&quot;,&quot;pitfall&quot;:&quot;锁不随段回收，段泄漏时锁也一起留痕&quot;}]' />

## 组合用法：用共享内存传大数组

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [共享内存与进程间数据](/backend/learn/concurrency/shared-memory) | 零拷贝映射的底层机制 |
| [同步原语与死锁](/backend/learn/concurrency/sync-primitives) | 写入方之间的互斥 |
| [队列与管道通信](/backend/learn/communication/queue-and-pipe) | 控制消息与就绪通知 |

### 数据流图解

下图画出写入方与读取方在锁上的等待与通知。

<DiagramFrame src="/diagrams/lock-wait-notify.html" title="写入方与读取方的等待通知（Archify 交互图）" :height="460" />

### 分步实现

1. 父进程建一段共享内存并写入初值。
2. 把段名与元素个数传给子进程。
3. 子进程按段名挂载同一段内存。
4. 子进程就地改写并把完成标志置位。
5. 父进程读到结果后释放视图。
6. 最后调用 `close()` 断开，再由创建方 `unlink()`。

### 对比表格

| 方案 | 复制代价 | 同步代价 | 生命周期风险 |
|---|---|---|---|
| 队列传数组 | 每条一次 | 队列自带 | 低 |
| Value 与 Array | 一次 | 自带锁 | 低 |
| Manager 代理 | 每次访问 | 管理进程串行 | 中 |
| SharedMemory | 零次 | 自己加锁 | 高，段可能泄漏 |

## 完整 Demo：就地改写共享缓冲区

### 场景描述

父进程建一段 8000 字节的共享内存，放进 1000 个整数。
子进程挂载同一段，把每个元素加一。
父进程校验总和，然后释放这段内存。

### 完整代码

```python
"""共享内存就地改写：父子进程映射同一段缓冲区。"""
from multiprocessing import Process, shared_memory

ITEMS = 1000
SIZE = ITEMS * 8


def worker(name: str) -> None:
    shm = shared_memory.SharedMemory(name=name)
    view = memoryview(shm.buf).cast("q")
    for index in range(len(view)):
        view[index] += 1
    view.release()
    shm.close()


def main() -> None:
    shm = shared_memory.SharedMemory(create=True, size=SIZE)
    view = memoryview(shm.buf).cast("q")
    for index in range(ITEMS):
        view[index] = index
    child = Process(target=worker, args=(shm.name,))
    child.start()
    child.join()
    total = sum(view)
    expected = sum(range(ITEMS)) + ITEMS
    print("校验通过" if total == expected else "校验失败")
    view.release()
    shm.close()
    shm.unlink()


if __name__ == "__main__":
    main()
```

### 运行方式

```bash
python3 shared_memory_demo.py
```

输出一行：校验通过。

### 常见误区

- 「共享内存不需要同步」是错的。多个写入方仍要加锁。
- 「`unlink()` 等于 `close()`」是错的。前者删除段，后者只断开本进程映射。
- 「Manager 代理比共享内存快」是错的。每次属性访问都要走一次序列化。
- 「共享内存会自动回收」是错的。段名留在内核里，泄漏后要手工清理。

### 面试追问链

<details>
<summary>Q1：共享内存为什么快？</summary>

写入方只写一次，读取方直接读到同一段物理内存。
中间没有序列化，也没有复制。

</details>

<details>
<summary>Q2：那为什么还要加锁？</summary>

多个写入方会同时改同一块内存。
缺锁就可能读到写了一半的数据。

</details>

<details>
<summary>Q3：共享段的生命周期由谁管？</summary>

创建方持有段名并负责 `unlink()`。
调用之后名字消失，已挂载的进程还能继续读写。

</details>

<details>
<summary>Q4：Manager 代理和共享内存怎么选？</summary>

小对象与复杂结构用代理，省去手工编解码。
大数组与高频读写用共享内存，避开每次访问的进程间调用。

</details>

<details>
<summary>Q5：Value 与 Array 有什么坑？</summary>

附带的锁只保护单次读写。
先取值再赋值这种读改写，仍要自己加一把锁。

</details>

### 下一讲衔接

共享内存解决数据放在哪里的问题。
下一讲 [信号量与信号](/backend/learn/communication/semaphore-and-signal) 讲怎么协调写入次序与退场时机。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 用队列回传结果，适合中小结果。
结果体积大、复制代价高时，再换成本讲的共享内存方案。
