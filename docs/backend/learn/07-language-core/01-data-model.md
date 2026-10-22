---
title: "数据模型与魔术方法"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 1
level: advanced
tags: [data-model, dunder, protocol, operator-overloading]
description: "魔术方法由谁在什么时机调用，以及协议为什么比继承更稳"
prerequisites: []
related_knowledge:
  - /backend/learn/language-core/object-lifecycle
  - /backend/learn/language-core/attribute-access
---

### 本讲要解决的问题

`len(obj)` 与 `obj + 1` 都写成普通表达式。解释器在背后把它们换成方法调用。
换成哪个方法由数据模型决定。本讲拆开这条转换链，并说明实现协议时的边界。

- 解释器把哪些语法映射到哪些魔术方法。
- 方法查找为什么绕开实例字典。
- 实现协议时哪些方法必须成对出现。

## TL;DR

魔术方法是协议的实现点。解释器在固定语法位置调用固定名字。
名字两边各带双下划线，业务代码很少直接调用。
实现协议即可获得语法能力，不必继承某个基类。
查找魔术方法时解释器只看类型，不看实例字典。

## 概念定义

**魔术方法**：名字两边各带双下划线的方法。解释器在固定语法位置调用它。

**协议**：一组约定好的方法名。对象实现这组名字就获得对应语法能力。

**数据模型**：语言对对象行为的统一约定。官方参考列出全部方法名与调用时机。

**鸭子类型**：只看对象是否实现所需方法。不看它的类型声明与继承关系。

## 原理图解

下图回答一个问题：一行 `a + b` 或 `len(a)` 在解释器里落到哪个方法。

<DiagramFrame src="/diagrams/language-object-model.html" title="数据模型：语法到魔术方法的映射（Archify 交互图）" :height="560" />

```text
len(a)     ──▶ type(a).__len__(a)          ──▶ 非负整数
a + b      ──▶ type(a).__add__(a, b)       ──▶ 新对象
a == b     ──▶ type(a).__eq__(a, b)        ──▶ 布尔值
with a:    ──▶ __enter__ 进入，__exit__ 退出
```

## 关键对比

先记住映射表。写代码时按语法反查方法名。

| 语法 | 落点方法 | 返回值约束 |
|---|---|---|
| `len(a)` | `__len__` | 非负整数 |
| `bool(a)` | `__bool__`，缺省看 `__len__` | 布尔值 |
| `a[i]` | `__getitem__` | 元素或切片结果 |
| `a + b` | `__add__`，失败退到 `__radd__` | 新对象或 `NotImplemented` |
| `a == b` | `__eq__` | 布尔值或 `NotImplemented` |
| `hash(a)` | `__hash__` | 整数 |
| `for x in a` | `__iter__` | 迭代器 |

再比较两种获得能力的路径。协议更轻，代价是没有编译期约束。

| 维度 | 继承抽象基类 | 实现协议 |
|---|---|---|
| 关系声明 | 显式写在类定义里 | 隐式满足 |
| 类型检查 | `isinstance` 可命中 | 只能逐方法探测 |
| 典型例子 | `collections.abc.Sequence` | 迭代与上下文管理 |

### 官方依据与版本差异

- [数据模型参考](https://docs.python.org/3/reference/datamodel.html) — 3.13 起类上新增 `__static_attributes__` 与 `__firstlineno__`，方法调用时机未变。
- [PEP 634](https://peps.python.org/pep-0634/) — 3.10 起 `match` 语句按 `__match_args__` 匹配位置属性。
- [PEP 520](https://peps.python.org/pep-0520/) — 3.6 起 `__set_name__` 在类创建后调用，供描述符取属性名。
- [functools 文档](https://docs.python.org/3/library/functools.html) — 3.2 起 `total_ordering` 可由一个比较方法补齐其余四个。

## API 手册：数据模型

### 对象表示与比较

<ApiTable :items='[{"name":"object.__repr__","rank":"必会","signature":"__repr__(self)","params":[],"returns":"str，应能重建对象","effect":"给出调试用的文本表示","scenario":"日志与交互式查看","example":"def __repr__(self):\n    return f\"Money({self.amount})\"","exampleLang":"python","pitfall":"返回空串或省略类型名，调试时认不出对象。"},{"name":"object.__eq__","rank":"必会","signature":"__eq__(self, other)","params":[{"name":"other","type":"object","default":"必填","desc":"右侧操作数"}],"returns":"bool 或 NotImplemented","effect":"定义值相等的判据","scenario":"值对象比较与去重","example":"def __eq__(self, other):\n    if not isinstance(other, Money):\n        return NotImplemented\n    return self.amount == other.amount","exampleLang":"python","pitfall":"对未知类型返回 False，会挡住右侧的反向比较。"},{"name":"object.__hash__","rank":"常用","signature":"__hash__(self)","params":[],"returns":"int","effect":"给出哈希值供字典与集合使用","scenario":"值对象做字典键","example":"def __hash__(self):\n    return hash((self.amount, self.currency))","exampleLang":"python","pitfall":"相等对象必须同哈希。可变字段不要参与计算。"}]' />

### 容器与调用协议

<ApiTable :items='[{"name":"object.__len__","rank":"必会","signature":"__len__(self)","params":[],"returns":"非负 int","effect":"让 len 与布尔判断可用","scenario":"自定义容器","example":"def __len__(self):\n    return len(self._items)","exampleLang":"python","pitfall":"返回负数或非整数会抛 TypeError。"},{"name":"object.__getitem__","rank":"必会","signature":"__getitem__(self, key)","params":[{"name":"key","type":"int 或 slice","default":"必填","desc":"下标或切片对象"}],"returns":"元素或新对象","effect":"接住下标语法","scenario":"自定义序列与惰性视图","example":"def __getitem__(self, index):\n    return self._items[index]","exampleLang":"python","pitfall":"越界要抛 IndexError。切片要返回同类型对象。"},{"name":"object.__iter__","rank":"常用","signature":"__iter__(self)","params":[],"returns":"迭代器对象","effect":"让对象可用于 for 与解包","scenario":"自定义集合","example":"def __iter__(self):\n    return iter(self._items)","exampleLang":"python","pitfall":"返回自身时状态放在实例上，两个循环会互相干扰。"},{"name":"object.__call__","rank":"常用","signature":"__call__(self, *args)","params":[{"name":"args","type":"tuple","default":"空","desc":"调用时传入的参数"}],"returns":"任意","effect":"让实例像函数一样被调用","scenario":"带状态的函数对象","example":"class Adder:\n    def __init__(self, base):\n        self.base = base\n\n    def __call__(self, value):\n        return self.base + value","exampleLang":"python","pitfall":"实例可调用不等于函数，inspect.isfunction 返回假。"}]' />

## 组合用法：可比较与可哈希的值对象

### 组合了哪些知识？

组合三件事：相等判据、哈希一致性、排序补齐。

### 数据流图解

```text
构造 ──▶ 冻结字段 ──▶ 判等比字段 ──▶ 入集合先取哈希
排序 ──▶ 只写 __lt__ ──▶ 其余由 total_ordering 补齐
```

### 分步实现

1. 定字段。挑出参与相等判断的字段。
2. 写判等。先比类型再比字段。
3. 写哈希。字段元组交给 `hash`。
4. 补排序。只写 `__lt__`，其余交给装饰器。
5. 自检。把实例放进集合，看是否去重。

### 对比表格

| 做法 | 相等语义 | 能做字典键 | 代码量 |
|---|---|---|---|
| 只写 `__eq__` | 自定义 | 否，哈希变为 `None` | 少 |
| 手写相等与哈希 | 自定义 | 是 | 中 |
| `dataclass(frozen=True)` | 逐字段 | 是 | 最少 |

## 完整 Demo：金额值对象

### 场景描述

用不可变金额对象演示相等、哈希与排序。同额对象放进集合只留一个。

### 完整代码

```python
"""值对象：相等、哈希与排序都由协议提供。"""

from dataclasses import dataclass
from functools import total_ordering


@total_ordering
@dataclass(frozen=True)
class Money:
    """金额值对象。字段不可变，可直接做字典键。"""

    amount: int
    currency: str = "CNY"

    def __lt__(self, other):
        if not isinstance(other, Money):
            return NotImplemented
        return (self.amount, self.currency) < (other.amount, other.currency)


if __name__ == "__main__":
    print(len({Money(10), Money(10), Money(20)}))
    print(sorted([Money(30), Money(10)]))
    print(Money(10) == Money(10, "USD"))
```

### 运行方式

```bash
python3 demo.py
```

输出三行。去重后为二。排序按金额升序。跨币种比较为假。

### 常见误区

- 以为写了 `__eq__` 就自动有哈希。此时 `__hash__` 变成 `None`，实例不能做键。
- 只写 `__len__` 就当布尔可用。解释器先找 `__bool__`，找不到才退回 `__len__`。
- 在 `__eq__` 里对未知类型返回 `False`。返回 `NotImplemented` 才能让右侧接手。

### 面试追问链

<details>
<summary>len 会调用实例上的 __len__ 吗？</summary>

不会。解释器查类型上的槽位，跳过实例字典。实例属性同名也不生效。
</details>

<details>
<summary>为什么定义 __eq__ 后对象不能做字典键？</summary>

类型创建时检测到 `__eq__`，把 `__hash__` 置为 `None`。需要显式补一个哈希方法。
</details>

<details>
<summary>左侧 __add__ 返回 NotImplemented 之后呢？</summary>

解释器改调右侧的 `__radd__`。两边都不接才抛 TypeError。
</details>

### 下一讲衔接

下一讲 [对象创建与生命周期](/backend/learn/language-core/object-lifecycle) 看这些方法背后的对象怎么来、怎么走。

### 关联组件

暂无。语言机制在组件页按需组合。
