---
title: "类型注解基础"
type: knowledge
domain: backend
knowledge_domain: type-system
order: 1
level: basic
tags: [typing, annotations, union-type, narrowing]
description: "注解只是信息：联合类型、收窄与检查器看什么"
prerequisites: []
related_knowledge:
  - /backend/learn/type-system/generics
---

### 本讲要解决的问题

写 `x: int` 之后，运行时什么都不会发生。
那注解到底给谁看。联合类型与收窄又是什么。
这一讲把注解的作用与边界讲清楚。

- 注解在运行时存在哪里。
- 联合类型怎么表达，检查器怎么收窄。
- 哪些地方必须显式检查。

## TL;DR

注解不改变运行时行为。它把类型信息挂在函数或模块的属性上。
检查器读这些信息做静态判断。联合类型用 `|` 表达。
收窄靠控制流分析：`isinstance`、`is None` 与 `assert` 都会改变分支里的判断。

## 概念定义

**注解**：写在参数、返回值与变量上的类型说明。求值后可放进 `__annotations__`。

**静态检查**：运行前读注解做判断。不会运行代码，也不会改变对象。

**联合类型**：一个值可能是多种类型。写法是 `int | str`，等价老写法 `Union[int, str]`。

**收窄**：在一个分支里把类型范围缩小。判断之后，检查器只按缩小后的类型检查。

**结构化类型**：按成员判断兼容，不要求继承。用 `Protocol` 表达。

## 原理图解

下图回答一个问题：一个知识点在类型系统这条链上处于什么位置。

<DiagramFrame src="/diagrams/type-system-map.html" title="类型系统八讲地图：注解、泛型、Protocol 与检查器（Archify 交互图）" :height="560" />

```text
源码注解 ──▶ 检查器读取 ──▶ 控制流分析 ──▶ 分支内类型收窄 ──▶ 失败或通过
```

## 关键对比

| 写法 | 含义 | 常见误判 |
|---|---|---|
| `int` | 只接受整数 | `bool` 是 `int` 的子类，会被接受 |
| `int \| None` | 允许为空 | 不判空就直接用会失败 |
| `list[int]` | 元素类型 | 运行时不会检查元素 |
| `Any` | 关闭检查 | 用多了等于没标注 |

| 收窄手段 | 适用 | 注意 |
|---|---|---|
| `isinstance(x, T)` | 明确类型分支 | 只对真实类型有效 |
| `x is None` | 可选值 | 与 `==` 语义不同 |
| `assert x is not None` | 内部约定 | `-O` 会去掉断言 |
| `TypeGuard` | 自定义判断函数 | 需要显式声明返回 |

### 官方依据与版本差异

- [typing 文档](https://docs.python.org/3/library/typing.html) — 3.10 起支持 `X | Y` 写法，3.12 起 `type` 语句可用。
- [PEP 604](https://peps.python.org/pep-0604/) — 3.10 起联合类型可用 `|`。
- [PEP 695](https://peps.python.org/pep-0695/) — 3.12 起提供泛型参数语法与 `type` 别名。

## API 手册：typing

### 基础类型表达

<ApiTable :items='[{"name":"typing.Optional","rank":"必会","signature":"Optional[T]","params":[{"name":"T","type":"type","default":"必填","desc":"内层类型"}],"returns":"T 或 None 的联合","effect":"表达可空值","scenario":"参数或返回值可能为 None","example":"def find(k: str) -> Optional[int]:\n    return None","exampleLang":"python","pitfall":"3.10 起更推荐写 T | None。二者语义相同。","raises":"无"},{"name":"typing.Union","rank":"常用","signature":"Union[A, B]","params":[{"name":"A, B","type":"type","default":"必填","desc":"候选类型"}],"returns":"联合类型","effect":"表达多选一","scenario":"兼容老版本写法","example":"def parse(v: Union[int, str]) -> int:\n    return int(v)","exampleLang":"python","pitfall":"参数顺序不影响判断，但收窄要靠分支写清。","raises":"无"}]' />

### 收窄与断言

<ApiTable :items='[{"name":"typing.TypeGuard","rank":"常用","signature":"TypeGuard[T]","params":[{"name":"T","type":"type","default":"必填","desc":"收窄后的类型"}],"returns":"标记函数返回的类型判据","effect":"让自定义判断函数也能收窄","scenario":"多个分支共用同一判断","example":"from typing import TypeGuard\n\ndef is_str_list(v: list[object]) -> TypeGuard[list[str]]:\n    return all(isinstance(i, str) for i in v)","exampleLang":"python","pitfall":"函数体必须真的保证条件成立，否则检查器会被骗过。","raises":"无"},{"name":"typing.cast","rank":"常用","signature":"cast(T, value)","params":[{"name":"T","type":"type","default":"必填","desc":"目标类型"}],"returns":"原值，运行时不做转换","effect":"让检查器接受一个类型","scenario":"第三方库缺少注解时","example":"from typing import cast\n\nvalue = cast(int, raw)","exampleLang":"python","pitfall":"cast 不做校验。用错只会把错误推迟到运行期。","raises":"无"}]' />

## 组合用法：给解析函数加注解

### 组合了哪些知识？

组合了三件事：联合类型、收窄分支与显式检查。

### 数据流图解

```text
输入 object ──▶ isinstance 判断 ──▶ 分支内收窄 ──▶ 按窄类型处理
                         └── 都不是 ──▶ 抛出明确错误
```

### 分步实现

1. 入参写成 `object` 或联合类型。表示接受多种输入。
2. 先用 `isinstance` 分支。每个分支只处理一种类型。
3. 分支内直接按窄类型调用。检查器会通过。
4. 兜底分支抛错。错误信息写清收到了什么。

### 对比表格

| 做法 | 静态检查 | 运行期安全 | 可读性 |
|---|---|---|---|
| 全写 `Any` | 失效 | 靠调用方 | 差 |
| 联合类型 + 分支 | 有效 | 显式检查 | 好 |
| 只写 `int` 强转 | 有效但失真 | 可能失败 | 中 |

## 完整 Demo：带收窄的解析函数

### 场景描述

解析一个可能是整数、字符串或空值的输入。
用分支收窄类型，非法输入给明确错误。

### 完整代码

```python
"""联合类型与收窄：每个分支只处理一种类型。"""

from typing import Union

Raw = Union[int, str, None]


def parse_int(value: Raw) -> int:
    if value is None:
        raise ValueError("输入为空")
    if isinstance(value, bool):
        raise TypeError("布尔值不算整数")
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            raise ValueError("字符串为空")
        return int(text)
    raise TypeError(f"不支持的类型：{type(value).__name__}")


if __name__ == "__main__":
    print(parse_int(7))
    print(parse_int(" 42 "))
    try:
        parse_int(None)
    except ValueError as error:
        print("预期错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出两行结果与一行预期错误。`bool` 分支要放在 `int` 之前。

### 常见误区

- 认为注解会做运行时检查。它只在静态检查时起作用。
- 把 `bool` 当普通整数。它是 `int` 的子类，顺序写错会被放过。

### 面试追问链

<details>
<summary>注解在运行时存在哪里？</summary>

函数对象上有 `__annotations__`。模块与类也有各自的位置。
</details>

<details>
<summary>为什么 `assert` 不能用来做运行期检查？</summary>

`python -O` 会移除断言。检查逻辑不能依赖它。
</details>

<details>
<summary>`cast` 与 `isinstance` 的区别？</summary>

`cast` 只影响静态检查。`isinstance` 才真的判断运行时类型。
</details>

### 下一讲衔接

下一讲 [泛型与型变](/backend/learn/type-system/generics) 讲带参数的容器类型。重点讲清型变方向。

### 关联组件

暂无。类型系统服务于组件与页面代码的质量。
