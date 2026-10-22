---
title: "可调用类型与重载"
type: knowledge
domain: backend
knowledge_domain: type-system
order: 4
level: advanced
tags: [callable, overload, paramspec, signature]
description: "函数签名怎么表达：Callable、ParamSpec 与重载"
prerequisites:
  - /backend/learn/type-system/protocol
related_knowledge:
  - /backend/learn/type-system/typed-dict-dataclass
---

### 本讲要解决的问题

把函数当参数传时，类型怎么写。
装饰器要保住被包装函数的签名，怎么写。
同一函数接受多种入参，类型怎么表达。

### 本讲要解决的问题

- 可调用类型的两种写法。
- `ParamSpec` 解决什么问题。
- 重载的声明与实现约束。

## TL;DR

可调用类型写 `Callable[[参数], 返回]`。
需要原样转发的装饰器用 `ParamSpec`。
多重入参用 `@overload` 声明，最后写一个实现。

## 概念定义

**可调用类型**：描述函数、方法与类的调用形状。

**`ParamSpec`**：捕获参数列表，用于转发。装饰器场景常用。

**`Concatenate`**：在捕获的参数前追加固定参数。

**重载**：为同一函数声明多个签名。实现只有一个。

**实现签名**：运行时真正运行的函数。检查器不按它推断。

## 原理图解

下图回答一个问题：可调用类型在类型系统里的位置。

<DiagramFrame src="/diagrams/type-system-map.html" title="类型系统八讲地图：可调用与重载的位置（Archify 交互图）" :height="560" />

```text
Callable[[int], str] ──▶ 固定参数：一个整数
ParamSpec P ──▶ 捕获任意参数 ──▶ 装饰器原样转发
@overload × N ──▶ 声明多个签名 ──▶ 实现一个函数
```

## 关键对比

| 写法 | 表达力 | 适用 |
|---|---|---|
| `Callable[..., int]` | 弱，参数未知 | 快速标注 |
| `Callable[[int, str], bool]` | 强，参数固定 | 回调 |
| `ParamSpec` | 强，参数可变 | 装饰器 |

| 重载写法 | 检查器行为 | 注意 |
|---|---|---|
| 只写声明 | 报缺少实现 | 必须有实现 |
| 声明 + 实现 | 按声明推断 | 实现签名要兼容 |
| 用联合类型代替 | 更简单 | 分支少时优先 |

### 官方依据与版本差异

- [typing.Callable](https://docs.python.org/3/library/typing.html#typing.Callable) — 3.9 起支持内置 `collections.abc.Callable` 下标写法。
- [PEP 612](https://peps.python.org/pep-0612/) — 3.10 起提供 `ParamSpec` 与 `Concatenate`。
- [PEP 484](https://peps.python.org/pep-0484/) — 3.5 起提供 `@overload`。

## API 手册：签名工具

### 可调用类型

<ApiTable :items='[{"name":"typing.Callable","rank":"必会","signature":"Callable[[A, B], R]","params":[{"name":"A, B","type":"type","default":"必填","desc":"参数类型"},{"name":"R","type":"type","default":"必填","desc":"返回类型"}],"returns":"可调用类型","effect":"描述函数形状","scenario":"回调与工厂参数","example":"from typing import Callable\n\ndef apply(fn: Callable[[int], int], value: int) -> int:\n    return fn(value)","exampleLang":"python","pitfall":"写 Callable[..., R] 会丢掉参数检查。","raises":"无"},{"name":"typing.ParamSpec","rank":"常用","signature":"ParamSpec(\"P\")","params":[{"name":"name","type":"str","default":"必填","desc":"参数名"}],"returns":"参数规格对象","effect":"捕获并转发参数列表","scenario":"装饰器与偏函数","example":"from typing import Callable, ParamSpec, TypeVar\n\nP = ParamSpec(\"P\")\nR = TypeVar(\"R\")\n\ndef wrap(fn: Callable[P, R]) -> Callable[P, R]:\n    return fn","exampleLang":"python","pitfall":"3.10 起可用。低版本只能用 Callable[..., R]。","raises":"无"}]' />

### 重载

<ApiTable :items='[{"name":"typing.overload","rank":"常用","signature":"overload(func)","params":[{"name":"func","type":"callable","default":"必填","desc":"只声明不实现的签名"}],"returns":"占位声明","effect":"为同一函数声明多个签名","scenario":"入参类型决定返回类型","example":"from typing import overload\n\n@overload\ndef parse(value: str) -> int: ...\n@overload\ndef parse(value: bytes) -> int: ...\ndef parse(value): return int(value)","exampleLang":"python","pitfall":"实现函数不会被检查器当作签名使用。","raises":"无"},{"name":"typing.Concatenate","rank":"进阶","signature":"Concatenate[str, P]","params":[{"name":"str","type":"type","default":"必填","desc":"追加的固定参数"},{"name":"P","type":"ParamSpec","default":"必填","desc":"其余参数"}],"returns":"参数规格","effect":"在转发参数前追加固定项","scenario":"注入上下文的装饰器","example":"from typing import Callable, Concatenate, ParamSpec\n\nP = ParamSpec(\"P\")\ndef with_log(fn: Callable[Concatenate[str, P], None]) -> Callable[P, None]:\n    ...","exampleLang":"python","pitfall":"追加参数必须放在最前，顺序写错检查器会拒。","raises":"无"}]' />

## 组合用法：保留签名的装饰器

### 组合了哪些知识？

组合了三件事：`ParamSpec`、包装函数与返回类型。

### 数据流图解

```text
原函数 f(a, b) ──▶ 装饰器捕获 P ──▶ 包装函数保持 (a, b)
调用时 ──▶ 包装层 ──▶ 原函数
```

### 分步实现

1. 声明 `ParamSpec` 与返回值参数。
2. 装饰器入参写 `Callable[P, R]`。
3. 包装函数用 `*args: P.args, **kwargs: P.kwargs`。
4. 返回 `Callable[P, R]`。

### 对比表格

| 写法 | 签名保真 | 检查器可推断 | 适用 |
|---|---|---|---|
| `Callable[..., R]` | 否 | 弱 | 兼容老版本 |
| `ParamSpec` | 是 | 强 | 装饰器 |
| 手写联合类型 | 否 | 中 | 简单函数 |

## 完整 Demo：保留签名的计时装饰器

### 场景描述

给函数加计时，但保住原函数的参数与返回类型。

### 完整代码

```python
"""ParamSpec：保留签名的装饰器。"""

import time
from typing import Callable, ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")


def timed(fn: Callable[P, R]) -> Callable[P, R]:
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        start = time.perf_counter()
        result = fn(*args, **kwargs)
        cost = time.perf_counter() - start
        print(f"{fn.__name__} 用了 {cost:.4f} 秒")
        return result
    return wrapper


@timed
def add(a: int, b: int) -> int:
    return a + b


if __name__ == "__main__":
    print(add(1, 2))
    print(add.__name__)
```

### 运行方式

```bash
python3 demo.py
```

输出耗时与结果。去掉 `timed` 再跑，函数名与结果不变。

### 常见误区

- 重载实现签名与声明不一致。检查器会拒。
- 装饰器用 `Callable[..., Any]`。调用方失去参数检查。

### 面试追问链

<details>
<summary>重载能改变运行时行为吗？</summary>

不能。它只影响静态检查，运行的是一个实现。
</details>

<details>
<summary>ParamSpec 与 *args 的区别？</summary>

`*args` 只表达有参数。`ParamSpec` 还能把参数类型带过去。
</details>

<details>
<summary>什么时候不用重载？</summary>

分支少且返回类型一致时。用联合类型更简单。
</details>

### 下一讲衔接

下一讲 [TypedDict 与 dataclass](/backend/learn/type-system/typed-dict-dataclass) 讲结构类型与数据类。

### 关联组件

暂无。可调用类型用于回调与装饰器。
