---
title: "泛型与型变"
type: knowledge
domain: backend
knowledge_domain: type-system
order: 2
level: advanced
tags: [generics, typevar, variance, protocol]
description: "类型参数、约束与型变方向：只读协变，只写逆变"
prerequisites:
  - /backend/learn/type-system/typing-basics
related_knowledge:
  - /backend/learn/type-system/protocol
---

### 本讲要解决的问题

容器类型怎么写才不丢信息。
只读与只写为什么需要不同的型变方向。
检查器凭什么接受或拒绝。

- 类型参数怎么声明与约束。
- 三种型变分别对应什么位置。
- 什么时候该用协议代替继承。

## TL;DR

泛型用类型参数表达元素类型。
型变看位置：只读位置用协变，只写位置用逆变，读写都有只能不变。
`list` 不变，`Sequence` 协变。所以函数入参优先写 `Sequence`。

## 概念定义

**类型参数**：`TypeVar` 声明的占位类型。实例化时被具体类型替换。

**上界**：`bound` 限定参数必须是某个类型的子类。

**约束**：给出若干具体类型，只允许其中之一。

**协变**：子类型关系保持同向。只读容器适合协变。

**逆变**：子类型关系反向。只写位置适合逆变。

## 原理图解

下图回答一个问题：类型参数、上界与三种型变的关系。

<DiagramFrame src="/diagrams/variance-and-generics.html" title="泛型、约束与型变：位置决定方向（Archify 交互图）" :height="560" />

```text
TypeVar("T") ──▶ 无约束：任意类型
TypeVar("T", bound=Base) ──▶ 上界：Base 或其子类
TypeVar("T", int, str) ──▶ 约束：只能是其一
只读位置 ──▶ 协变　只写位置 ──▶ 逆变　读写都有 ──▶ 不变
```

## 关键对比

| 声明 | 含义 | 典型用法 |
|---|---|---|
| `TypeVar("T")` | 任意类型 | 通用容器 |
| `TypeVar("T", bound=Base)` | Base 子类 | 面向基类编程 |
| `TypeVar("T", int, str)` | 仅限列出的类型 | 少数固定类型 |

| 容器 | 型变 | 只读接口 |
|---|---|---|
| `list[T]` | 不变 | 用 `Sequence[T]` 收更宽 |
| `Sequence[T]` | 协变 | 直接收 |
| `dict[K, V]` | 不变 | 用 `Mapping[K, V]` 收 |

### 官方依据与版本差异

- [typing 文档](https://docs.python.org/3/library/typing.html) — 3.12 起提供 `TypeVar` 的新写法。
- [PEP 484](https://peps.python.org/pep-0484/) — 3.5 起提供类型提示与泛型基础。
- [PEP 695](https://peps.python.org/pep-0695/) — 3.12 起支持 `def f[T](x: T)` 这种参数语法。

## API 手册：泛型工具

### 类型参数

<ApiTable :items='[{"name":"typing.TypeVar","rank":"必会","signature":"TypeVar(name, *constraints, bound=None)","params":[{"name":"name","type":"str","default":"必填","desc":"参数名"},{"name":"bound","type":"type","default":"None","desc":"上界类型"}],"returns":"类型参数","effect":"声明可替换的占位类型","scenario":"通用函数与容器","example":"from typing import TypeVar\n\nT = TypeVar(\"T\")\n\ndef first(items: list[T]) -> T:\n    return items[0]","exampleLang":"python","pitfall":"同一个函数里复用同一参数名，表示多处必须同类型。","raises":"无"},{"name":"typing.Generic","rank":"常用","signature":"Generic[T]","params":[{"name":"T","type":"TypeVar","default":"必填","desc":"类型参数"}],"returns":"基类声明","effect":"让类变成泛型类","scenario":"自定义容器","example":"from typing import Generic, TypeVar\n\nT = TypeVar(\"T\")\n\nclass Box(Generic[T]):\n    def __init__(self, item: T) -> None:\n        self.item = item","exampleLang":"python","pitfall":"3.12 起可省略 Generic，直接用 `class Box[T]:`。","raises":"无"}]' />

### 型变声明

<ApiTable :items='[{"name":"typing.Sequence","rank":"必会","signature":"Sequence[T]","params":[{"name":"T","type":"type","default":"必填","desc":"元素类型"}],"returns":"只读序列类型","effect":"协变容器","scenario":"只需遍历与索引","example":"from typing import Sequence\n\ndef total(values: Sequence[int]) -> int:\n    return sum(values)","exampleLang":"python","pitfall":"它不提供追加方法。要追加就换 list。","raises":"无"},{"name":"typing.Mapping","rank":"常用","signature":"Mapping[K, V]","params":[{"name":"K","type":"type","default":"必填","desc":"键类型"},{"name":"V","type":"type","default":"必填","desc":"值类型"}],"returns":"只读映射类型","effect":"只读容器，适合入参","scenario":"只读配置与查询参数","example":"from typing import Mapping\n\ndef pick(config: Mapping[str, str]) -> str:\n    return config[\"mode\"]","exampleLang":"python","pitfall":"需要写入时用 MutableMapping。","raises":"无"}]' />

## 组合用法：宽进严出

### 组合了哪些知识？

组合了三件事：协变入参、不变返回值与上界约束。

### 数据流图解

```text
调用方传入 list[int] ──▶ 入参声明 Sequence[int] ──▶ 接受
函数返回 list[int] ──▶ 返回声明 list[int] ──▶ 调用方可写
```

### 分步实现

1. 入参写只读类型。`Sequence` 与 `Mapping` 优先。
2. 返回值写具体类型。保留可变能力。
3. 需要基类约束时用 `bound`。
4. 同一参数在入参与返回值复用，保持关系。

### 对比表格

| 写法 | 接受范围 | 风险 |
|---|---|---|
| 入参 `list[int]` | 只接受 list | 调用方要额外转换 |
| 入参 `Sequence[int]` | 接受 tuple 与 list | 函数内不能追加 |
| 返回 `Sequence[int]` | 调用方不能追加 | 能力被削弱 |

## 完整 Demo：泛型容器

### 场景描述

写一个泛型栈。入参用只读序列，返回具体元素类型。

### 完整代码

```python
"""泛型与型变：只读入参，可变返回。"""

from typing import Generic, Sequence, TypeVar

T = TypeVar("T")


class Stack(Generic[T]):
    def __init__(self, items: Sequence[T] = ()) -> None:
        self._items: list[T] = list(items)

    def push(self, item: T) -> None:
        self._items.append(item)

    def pop(self) -> T:
        if not self._items:
            raise IndexError("栈为空")
        return self._items.pop()


def drain(stack: Stack[int], count: int) -> list[int]:
    return [stack.pop() for _ in range(count)]


if __name__ == "__main__":
    stack: Stack[int] = Stack((1, 2))
    stack.push(3)
    print(drain(stack, 2))
    try:
        Stack[int]().pop()
    except IndexError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出弹出的两个元素与一条错误。`Sequence` 让构造函数同时接受 tuple 与 list。

### 常见误区

- 入参写 `list` 导致调用方必须转换。放宽到 `Sequence` 即可。
- 在泛型类里用裸 `list`。元素类型信息全丢。

### 面试追问链

<details>
<summary>为什么 list 不是协变的？</summary>

可写容器里协变会破坏类型安全。写入子类后按父类读取就错了。
</details>

<details>
<summary>TypeVar 复用在入参与返回值意味着什么？</summary>

两处必须是同一类型。检查器会据此建立关系。
</details>

<details>
<summary>3.12 的泛型新写法好处在哪？</summary>

参数作用域更清楚，不用先声明 TypeVar，也不会跨函数泄漏。
</details>

### 下一讲衔接

下一讲 [Protocol 与结构化子类型](/backend/learn/type-system/protocol) 讲不靠继承的类型兼容。

### 关联组件

暂无。泛型用于组件接口的类型表达。
