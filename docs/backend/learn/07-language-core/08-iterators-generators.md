---
title: "迭代器与生成器"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 8
level: advanced
tags: [iterator, generator, yield, itertools]
description: "迭代协议与生成器：惰性求值、暂停恢复与资源回收"
prerequisites:
  - /backend/learn/language-core/context-managers
related_knowledge:
  - /backend/learn/language-core/exceptions
---

### 本讲要解决的问题

`for` 循环背后调了什么。
生成器为什么能记住上次位置。
惰性求值在什么情况下会坏事。

### 本讲要解决的问题

- 迭代协议的约定。
- 生成器的暂停与恢复。
- 惰性与一次性消费的代价。

## TL;DR

迭代器实现 `__iter__` 与 `__next__`。取完抛 `StopIteration`。
生成器是写迭代器的快捷方式。`yield` 处暂停，恢复后继续。
生成器只能消费一次。要重复遍历就得重新生成一个。

## 概念定义

**可迭代对象**：实现 `__iter__` 的对象。能被 `for` 遍历。

**迭代器**：同时实现 `__iter__` 与 `__next__`。记住当前位置。

**生成器**：含 `yield` 的函数。调用返回生成器对象。

**惰性求值**：用到一个才算一个。省内存，但延迟暴露错误。

**一次性**：生成器耗尽后不再产生值。

## 原理图解

下图回答一个问题：本讲在语言核心机制里的位置与依赖。

<DiagramFrame src="/diagrams/language-core-map.html" title="语言核心机制地图：协议与工程五讲（Archify 交互图）" :height="560" />

```text
for x in obj ──▶ iter(obj) ──▶ next() 循环 ──▶ StopIteration 结束
生成器 ──▶ 首次 next 跑到 yield ──▶ 暂停并返回值 ──▶ 再次 next 从断点继续
```

## 关键对比

| 对象 | 实现 | 能重复遍历 | 内存 |
|---|---|---|---|
| 列表 | `__iter__` | 能 | 全量 |
| 生成器 | `yield` | 不能 | 逐个 |
| 自定义迭代器 | `__next__` | 视实现 | 视实现 |

| 写法 | 代码量 | 可读性 | 适用 |
|---|---|---|---|
| 手写迭代器类 | 多 | 中 | 需要状态控制 |
| 生成器函数 | 少 | 好 | 大多数场景 |
| 生成器表达式 | 最少 | 一般 | 简单变换 |

### 官方依据与版本差异

- [迭代器类型](https://docs.python.org/3/library/stdtypes.html#iterator-types) — 3.12 起协议未变。
- [生成器 PEP 255](https://peps.python.org/pep-0255/) — 2.2 起提供生成器。
- [itertools 文档](https://docs.python.org/3/library/itertools.html) — 3.12 起 `batched` 可用。

## API 手册：迭代协议

### 协议方法

<ApiTable :items='[{"name":"__iter__","rank":"必会","signature":"__iter__(self)","params":[],"returns":"迭代器对象","effect":"返回自身或新的迭代器","scenario":"支持 for 遍历","example":"class Count:\n    def __init__(self, n): self.n = n\n    def __iter__(self): return iter(range(self.n))","exampleLang":"python","pitfall":"返回可迭代对象而不是迭代器时，嵌套遍历会出错。","raises":"TypeError，返回值不可迭代时"},{"name":"__next__","rank":"必会","signature":"__next__(self)","params":[],"returns":"下一个值","effect":"推进一格","scenario":"自定义迭代逻辑","example":"class One:\n    def __iter__(self): return self\n    def __next__(self): raise StopIteration","exampleLang":"python","pitfall":"结束时必须抛 StopIteration，否则 for 不会停。","raises":"StopIteration，表示耗尽"}]' />

### 生成器工具

<ApiTable :items='[{"name":"yield from","rank":"必会","signature":"yield from iterable","params":[{"name":"iterable","type":"iterable","default":"必填","desc":"要委托的可迭代对象"}],"returns":"委托对象的值","effect":"把迭代委托给子生成器","scenario":"递归展开与管道","example":"def chain(*groups):\n    for group in groups:\n        yield from group","exampleLang":"python","pitfall":"委托后的 send 与 close 会转发给子生成器。","raises":"子生成器抛出的错误原样传播"},{"name":"itertools.islice","rank":"常用","signature":"islice(iterable, stop)","params":[{"name":"iterable","type":"iterable","default":"必填","desc":"源序列"},{"name":"stop","type":"int","default":"必填","desc":"取到第几个"}],"returns":"迭代器","effect":"按位置截取","scenario":"只读前 N 条","example":"from itertools import islice\n\nfirst = list(islice(range(100), 5))","exampleLang":"python","pitfall":"islice 不消耗源之前的位置记录，重复使用要重新创建。","raises":"ValueError，参数为负数时"}]' />

## 组合用法：分块读取大文件

### 组合了哪些知识？

组合了三件事：生成器、惰性求值与分块。

### 数据流图解

```text
文件 ──▶ 逐行生成器 ──▶ 按块聚合 ──▶ 处理块 ──▶ 释放
```

### 分步实现

1. 写逐行生成器。一次只读一行。
2. 写分块生成器。累计到 N 条就产出。
3. 处理时只遍历一次。避免重复消费。
4. 出错时关闭文件。用 `with` 包住。

### 对比表格

| 方案 | 内存 | 首条延迟 | 适用 |
|---|---|---|---|
| 一次读全量 | 高 | 低 | 小文件 |
| 逐行生成器 | 低 | 低 | 大文件 |
| 分块 | 低 | 中 | 批量处理 |

## 完整 Demo：生成器分块

### 场景描述

把一串数字按每块三条分组处理。观察惰性与一次性消费。

### 完整代码

```python
"""生成器：惰性分块与一次性消费。"""


def chunks(items, size):
    block = []
    for item in items:
        block.append(item)
        if len(block) == size:
            yield block
            block = []
    if block:
        yield block


if __name__ == "__main__":
    data = range(7)
    for index, block in enumerate(chunks(data, 3), start=1):
        print(f"第 {index} 块:", block)
    stream = chunks(data, 3)
    print("第一次遍历条数:", len(list(stream)))
    print("第二次遍历条数:", len(list(stream)))
```

### 运行方式

```bash
python3 demo.py
```

输出三块与两次遍历条数。第二次为 0，说明生成器已耗尽。

### 常见误区

- 把生成器当列表反复遍历。第二次拿到空结果。
- 用列表推导处理大文件。内存直接打满。

### 面试追问链

<details>
<summary>可迭代对象与迭代器差在哪？</summary>

可迭代对象实现 `__iter__`。迭代器还要实现 `__next__`。
</details>

<details>
<summary>生成器怎么释放资源？</summary>

用 `try/finally` 或 `with`。生成器关闭时会执行 `finally`。
</details>

<details>
<summary>yield from 解决了什么？</summary>

把子生成器的委托与错误传播一次写清，免去手写循环。
</details>

### 下一讲衔接

下一讲 [错误层次与错误组](/backend/learn/language-core/exceptions) 讲错误怎么组织。重点是链式传递与分组。

### 关联组件

暂无。生成器在组件里用于流式读取。
