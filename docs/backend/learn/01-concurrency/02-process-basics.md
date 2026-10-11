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

## API 手册：multiprocessing

<ApiTable :items='[{"name": "multiprocessing.Process", "rank": "必会", "signature": "Process(group=None, target=None, name=None, args=(), kwargs={}, daemon=None)", "params": [{"name": "target", "type": "callable", "default": "None", "desc": "子进程执行的函数"}, {"name": "args", "type": "tuple", "default": "()", "desc": "位置参数，必须可 pickle"}, {"name": "daemon", "type": "bool", "default": "None", "desc": "守护进程随父进程退出"}], "returns": "Process 实例", "methods": ["start() — 启动子进程", "join(timeout=None) — 等待结束", "is_alive() — 判断存活", "terminate() — 强制终止"], "effect": "把函数放到独立解释器里跑，绕开 GIL", "scenario": "图像处理、数值计算、压缩与加密", "example": "import multiprocessing\n\ndef work(n):\n    return n * n\n\nif __name__ == &#39;__main__&#39;:\n    p = multiprocessing.Process(target=work, args=(5,))\n    p.start()\n    p.join()", "exampleLang": "python"}, {"name": "concurrent.futures.ProcessPoolExecutor", "rank": "必会", "signature": "ProcessPoolExecutor(max_workers=None, mp_context=None)", "params": [{"name": "max_workers", "type": "int", "default": "CPU 核数", "desc": "进程数上限"}, {"name": "mp_context", "type": "BaseContext", "default": "None", "desc": "指定 fork 或 spawn"}], "returns": "执行器对象", "methods": ["submit(fn, *args) — 提交单任务", "map(fn, iterable) — 顺序映射", "shutdown(wait=True) — 关闭"], "effect": "把任务摊到多个 CPU 核上跑，主进程拿 Future 收结果", "scenario": "批量计算、批量转码", "example": "from concurrent.futures import ProcessPoolExecutor\n\ndef heavy(n):\n    return sum(i * i for i in range(n))\n\nif __name__ == &#39;__main__&#39;:\n    with ProcessPoolExecutor(max_workers=4) as pool:\n        print(list(pool.map(heavy, [10**6, 10**6])))", "exampleLang": "python"}]' />

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
