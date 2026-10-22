---
title: "TypedDict 与 dataclass"
type: knowledge
domain: backend
knowledge_domain: type-system
order: 5
level: advanced
tags: [typeddict, dataclass, structure, validation]
description: "结构类型与数据类：什么时候用哪个"
prerequisites:
  - /backend/learn/type-system/callable-typing
related_knowledge:
  - /backend/learn/type-system/type-checkers
---

### 本讲要解决的问题

接口返回的字典怎么标注。
数据类与字典各自的成本。
运行时要不要检查。

### 本讲要解决的问题

- `TypedDict` 的表达范围。
- `dataclass` 的能力与代价。
- 两者的选择判据。

## TL;DR

`TypedDict` 只描述字典形状，运行时仍是普通字典。
`dataclass` 生成初始化、比较与表示，行为更完整。
只在边界处用 `TypedDict`，内部传递优先 `dataclass`。

## 概念定义

**`TypedDict`**：声明字典的键与值类型。运行时不检查。

**`dataclass`**：根据字段声明生成常用方法。

**必填与可选**：`total=False` 让全部字段可缺省。

**字段冻结**：`frozen=True` 让实例不可改。

**槽位**：`slots=True` 去掉实例字典。

## 原理图解

下图回答一个问题：两种结构类型在类型系统里的位置。

<DiagramFrame src="/diagrams/variance-and-generics.html" title="泛型与结构类型：TypedDict 与 dataclass 的位置（Archify 交互图）" :height="560" />

```text
外部 JSON ──▶ TypedDict 标注形状 ──▶ 转成 dataclass 再进业务
业务内部 ──▶ dataclass 传递 ──▶ 需要序列化时转字典
```

## 关键对比

| 维度 | TypedDict | dataclass |
|---|---|---|
| 运行时形态 | 普通字典 | 自定义类 |
| 检查 | 无 | 无，需自己写 |
| 方法 | 无 | 自动生成常用方法 |
| 序列化 | 天然是字典 | 需要转换 |
| 适用位置 | 边界 | 内部 |

| 写法 | 默认值 | 可变性 |
|---|---|---|
| `dataclass` | 支持 | 可变 |
| `dataclass(frozen=True)` | 支持 | 不可变 |
| `TypedDict` | 不支持 | 本来就是字典 |

### 官方依据与版本差异

- [TypedDict](https://docs.python.org/3/library/typing.html#typing.TypedDict) — 3.12 起支持 `Required` 与 `NotRequired`。
- [dataclasses 文档](https://docs.python.org/3/library/dataclasses.html) — 3.10 起支持 `slots=True`。
- [PEP 589](https://peps.python.org/pep-0589/) — 3.8 起提供 `TypedDict`。

## API 手册：结构类型

### 字典形状

<ApiTable :items='[{"name":"typing.TypedDict","rank":"必会","signature":"TypedDict(\"Name\", {\"k\": T})","params":[{"name":"k","type":"str","default":"必填","desc":"键名"},{"name":"T","type":"type","default":"必填","desc":"值类型"}],"returns":"字典形状类型","effect":"标注字典键值","scenario":"外部接口与 JSON","example":"from typing import TypedDict\n\nclass Payload(TypedDict):\n    name: str\n    age: int","exampleLang":"python","pitfall":"运行时不做检查，键缺失不会报错。","raises":"无"},{"name":"typing.NotRequired","rank":"常用","signature":"NotRequired[T]","params":[{"name":"T","type":"type","default":"必填","desc":"可选字段类型"}],"returns":"字段标记","effect":"声明可选键","scenario":"部分字段可缺省","example":"from typing import NotRequired, TypedDict\n\nclass Item(TypedDict):\n    name: str\n    note: NotRequired[str]","exampleLang":"python","pitfall":"3.11 起可用。低版本用 `total=False`。","raises":"无"}]' />

### 数据类

<ApiTable :items='[{"name":"dataclasses.dataclass","rank":"必会","signature":"dataclass(cls=None, frozen=False, slots=False)","params":[{"name":"frozen","type":"bool","default":"False","desc":"是否不可变"},{"name":"slots","type":"bool","default":"False","desc":"是否去掉实例字典"}],"returns":"被装饰的类","effect":"按字段生成方法","scenario":"业务数据对象","example":"from dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass Point:\n    x: int\n    y: int","exampleLang":"python","pitfall":"可变默认值要用 `field(default_factory=...)`。","raises":"ValueError，默认值可变且未用工厂时"},{"name":"dataclasses.field","rank":"常用","signature":"field(default_factory=list)","params":[{"name":"default_factory","type":"callable","default":"必填","desc":"默认值工厂"}],"returns":"字段声明","effect":"提供可变默认值与元数据","scenario":"列表或字典字段","example":"from dataclasses import dataclass, field\n\n@dataclass\nclass Bag:\n    items: list[str] = field(default_factory=list)","exampleLang":"python","pitfall":"直接写 `[]` 会让所有实例共享同一个列表。","raises":"TypeError，参数不合法时"}]' />

## 组合用法：边界转换

### 组合了哪些知识？

组合了三件事：字典标注、数据类转换与手工检查。

### 数据流图解

```text
外部字典 ──▶ TypedDict 标注 ──▶ 逐字段检查 ──▶ 构造 dataclass ──▶ 业务使用
```

### 分步实现

1. 外部数据用 `TypedDict` 标注。只是形状声明。
2. 写转换函数。逐个字段检查与取值。
3. 构造数据类。把检查放在构造前。
4. 内部只传数据类。不再传裸字典。

### 对比表格

| 做法 | 类型安全 | 运行时安全 | 代码量 |
|---|---|---|---|
| 直接用字典 | 弱 | 无 | 少 |
| TypedDict 标注 | 中 | 无 | 少 |
| TypedDict + 转换 | 强 | 有 | 中 |

## 完整 Demo：字典转数据类

### 场景描述

外部传来一个字典。检查字段后构造数据类，缺字段给出明确错误。

### 完整代码

```python
"""TypedDict 与 dataclass：边界转换与字段检查。"""

from dataclasses import dataclass
from typing import TypedDict


class RawUser(TypedDict):
    name: str
    age: int


@dataclass(frozen=True)
class User:
    name: str
    age: int


def to_user(raw: RawUser) -> User:
    name = raw.get("name")
    age = raw.get("age")
    if not isinstance(name, str) or not name:
        raise ValueError("name 缺失或不是字符串")
    if not isinstance(age, int) or age < 0:
        raise ValueError("age 缺失或不是非负整数")
    return User(name=name, age=age)


if __name__ == "__main__":
    print(to_user({"name": "ada", "age": 36}))
    try:
        to_user({"name": "", "age": 1})
    except ValueError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出数据类表示与一条错误。`frozen=True` 让实例不可改。

### 常见误区

- 以为 `TypedDict` 会检查。它只在检查器里生效。
- 用可变对象作默认值。所有实例共享同一份。

### 面试追问链

<details>
<summary>TypedDict 与 dict 的区别？</summary>

只在静态检查层面。运行时完全一样。
</details>

<details>
<summary>dataclass 生成哪些方法？</summary>

`__init__`、`__repr__`、`__eq__`。加参数还会生成排序方法。
</details>

<details>
<summary>frozen 与 slots 能一起用吗？</summary>

能。常见组合是 `@dataclass(frozen=True, slots=True)`。
</details>

### 下一讲衔接

下一讲 [mypy 与 pyright](/backend/learn/type-system/type-checkers) 讲检查器怎么配。

### 关联组件

暂无。数据类用于组件配置对象。
