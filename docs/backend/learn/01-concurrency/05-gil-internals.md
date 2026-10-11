---
title: "GIL 内部机制"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 5
level: advanced
tags: [gil, interpreter, cpython]
description: "GIL 的持有规则、强制让出点与工程结论"
source_module: "sys"
api_methods:
  - "sys.getswitchinterval"
  - "sys.setswitchinterval"
  - "sys._is_gil_enabled"
prerequisites:
  - /backend/learn/concurrency/thread-basics
  - /backend/learn/concurrency/process-basics
related_knowledge:
  - /backend/learn/concurrency/thread-basics
  - /backend/learn/concurrency/process-basics
related_components:
  - /backend/components/safe-queue
---

### 本讲要解决的问题

上一讲说了 GIL 影响选型，但没有解释它什么时候让出。这一讲把让出点讲清。看懂让出点后，你就能判断一段并发代码到底会不会重叠执行。

## TL;DR

> 线程执行字节码前必须先持有 GIL。计数到期时会请求让出。阻塞式 I/O 前会主动释放。
> 结论：I/O 密集任务能重叠等待，CPU 密集任务无法并行。

## 概念定义

GIL 是 CPython 解释器里的一把全局互斥锁，保护解释器内部状态。

线程要执行字节码就得先拿到它。解释器维护一个切换计数。线程执行若干字节码后递减计数。计数归零时，线程向解释器发出让出请求。另一个等待线程随后获得执行机会。阻塞式 I/O 调用前，执行线程会主动释放 GIL。数据返回后再重新竞争。

## 原理图解

下图把三条让出路径画在同一时间线上：计数到期、I/O 阻塞、临界区结束移交。

<DiagramFrame src="/diagrams/gil-internals.html" title="GIL 的持有、强制释放与再竞争（Archify 交互图）" :height="560" />

## 关键对比

| 场景 | 是否让出 GIL | 并行效果 |
|---|---|---|
| 纯 Python 循环 | 计数到期时让出 | 无，仍串行 |
| 阻塞式网络 I/O | 调用前主动释放 | 有，等待期重叠 |
| 文件读写 | 调用前主动释放 | 有，等待期重叠 |
| 长时 C 扩展计算 | 不返回解释器就不让出 | 无，其他线程饿死 |
| 调用时会释放的 C 扩展 | 扩展内部主动释放 | 有，接近并行 |

### 官方依据与版本差异

- [sys.getswitchinterval](https://docs.python.org/3/library/sys.html#sys.getswitchinterval) — 默认 5 毫秒，自 3.2 起提供。
- [PEP 703 自由线程](https://peps.python.org/pep-0703/) — 3.13 起实验性，3.14 继续演进。
- [C 层的 GIL 说明](https://docs.python.org/3/c-api/init.html#thread-state-and-the-global-interpreter-lock) — 3.12 与 3.13 文档描述同一实现。

## API 手册：sys 与解释器状态

<ApiTable :items='[{"name": "sys.getswitchinterval", "rank": "必会", "signature": "getswitchinterval()", "params": [], "returns": "浮点秒数", "methods": ["getswitchinterval() — 读取当前切换间隔"], "effect": "读到解释器请求让出的时间片长度", "scenario": "排查线程被饿死或切换过密", "example": "import sys\nprint(sys.getswitchinterval())", "exampleLang": "python"}, {"name": "sys.setswitchinterval", "rank": "进阶", "signature": "setswitchinterval(interval)", "params": [{"name": "interval", "type": "float", "default": "0.005", "desc": "时间片秒数"}], "returns": "无", "methods": ["setswitchinterval(float) — 设置时间片"], "effect": "改变线程请求让出的频率", "scenario": "延迟敏感的线程任务，需要更细的切换粒度", "example": "import sys\nsys.setswitchinterval(0.001)", "exampleLang": "python"}, {"name": "sys._is_gil_enabled", "rank": "进阶", "signature": "_is_gil_enabled()", "params": [], "returns": "布尔值", "methods": ["_is_gil_enabled() — 查询 GIL 是否启用"], "effect": "判断当前解释器是否启用了 GIL", "scenario": "在自由线程构建上做兼容判断", "example": "import sys\nprint(sys._is_gil_enabled())", "exampleLang": "python"}, {"name": "threading.get_native_id", "rank": "常用", "signature": "get_native_id()", "params": [], "returns": "整数线程号", "methods": ["get_native_id() — 取内核线程号", "threading.get_ident() — 取解释器内标识"], "effect": "把日志里的线程与操作系统线程对上", "scenario": "定位争用与上下文切换来源", "example": "import threading\nprint(threading.get_native_id())", "exampleLang": "python"}, {"name": "sys.setswitchinterval 与监控", "rank": "了解", "signature": "sys.monitoring", "params": [{"name": "tool_id", "type": "int", "default": "必填", "desc": "监控工具编号"}], "returns": "监控对象", "methods": ["use_tool_id() — 注册工具", "set_events() — 订阅事件"], "effect": "在字节码层观测执行与切换", "scenario": "分析 GIL 争用与热点函数", "example": "import sys\nmon = sys.monitoring\nprint(mon.use_tool_id(2, \"probe\"))", "exampleLang": "python"}]' />

## 组合用法：判断一段代码能否重叠执行

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [GIL 内部机制](/backend/learn/concurrency/gil-internals) | 让出点判断 |
| [多线程基础](/backend/learn/concurrency/thread-basics) | 线程创建与统计 |
| [多进程基础](/backend/learn/concurrency/process-basics) | 需要真并行时的替代方案 |

### 数据流图解

<DiagramFrame src="/diagrams/gil-internals.html" title="让出点决定重叠机会（Archify 交互图）" :height="460" />

### 分步实现

1. 把任务按时间构成拆成 CPU 段与等待段。
2. 判断等待段是否由阻塞式调用产生。
3. 统计等待段占比与 CPU 段耗时。
4. 等待占比高就用线程或协程。
5. CPU 占比高就换进程池，再测一遍。

### 对比表格

| 判断依据 | 线程是否有效 | 原因 |
|---|---|---|
| 等待时间占主导 | 有效 | 等待期释放 GIL |
| 计算时间占主导 | 无效 | 执行期必须持有 |
| 等待与计算各半 | 部分有效 | 只有等待段重叠 |
| 调用会释放锁的 C 扩展 | 有效 | 扩展内部放锁 |

## 完整 Demo：测量让出点带来的重叠

### 场景描述

同一份统计代码跑两遍。一遍用纯计算任务，一遍用带等待的模拟 I/O，比较线程与串行的耗时。

### 完整代码

```python
import threading
import time


def cpu_task(n: int) -> int:
    total = 0
    for i in range(n):
        total += i * i
    return total


def wait_task(seconds: float) -> float:
    time.sleep(seconds)
    return seconds


def run_serial(func, items):
    start = time.perf_counter()
    for item in items:
        func(item)
    return time.perf_counter() - start


def run_threads(func, items, workers=4):
    start = time.perf_counter()
    threads = [threading.Thread(target=func, args=(item,)) for item in items]
    for index, thread in enumerate(threads):
        thread.start()
        if index % workers == workers - 1:
            for running in threads[index - workers + 1:index + 1]:
                running.join()
    for thread in threads:
        thread.join()
    return time.perf_counter() - start


if __name__ == "__main__":
    cpu_items = [3_000_000] * 4
    wait_items = [0.5] * 4

    print(f"计算串行 {run_serial(cpu_task, cpu_items):.2f}s")
    print(f"计算多线程 {run_threads(cpu_task, cpu_items):.2f}s")
    print(f"等待串行 {run_serial(wait_task, wait_items):.2f}s")
    print(f"等待多线程 {run_threads(wait_task, wait_items):.2f}s")
```

### 运行方式

```bash
python3 gil_bench.py
```

### 常见误区

- 以为加线程一定能加速。计算型任务加线程只会更慢。
- 以为 sleep 能验证并行。sleep 会释放 GIL，结论不能推广到计算任务。
- 把切换间隔当成性能开关。调小它通常增加切换成本。

### 面试追问链

<details>
<summary>Q1：GIL 什么时候让出？</summary>

三条路径：计数到期、阻塞式调用前、临界区结束移交。

</details>

<details>
<summary>Q2：为什么纯计算多线程更慢？</summary>

线程要抢同一把锁。切换与竞争带来的开销没有换来并行收益。

</details>

<details>
<summary>Q3：那 I/O 密集任务为什么还快？</summary>

等待期间执行线程释放了 GIL。其他线程在这段时间继续执行。

</details>

<details>
<summary>Q4：长时 C 扩展为什么危险？</summary>

它不返回解释器就不检查让出。其他 Python 线程会被饿死。

</details>

### 下一讲衔接

下一讲看线程协作本身：锁、条件变量与信号量。接着读[同步原语与死锁](/backend/learn/concurrency/sync-primitives)。

### 关联组件

[进程安全队列](/backend/components/safe-queue) 跨进程执行，绕开 GIL 的串行约束。
