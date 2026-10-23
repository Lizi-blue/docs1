---
title: "领域建模"
type: knowledge
domain: backend
knowledge_domain: architecture
order: 7
level: advanced
tags: [ddd, entity, value-object, aggregate]
description: "实体、值对象与聚合：把业务规则放对位置"
prerequisites:
  - /backend/learn/architecture/dependency-injection
related_knowledge:
  - /backend/learn/architecture/ddd-repository
---

### 本讲要解决的问题

业务规则散在服务里，改一处漏一处。
哪些概念该建模成对象，哪些只是字段。
聚合边界怎么划。

- 实体与值对象的区别。
- 聚合的划分依据。
- 不变量放在哪。

## TL;DR

有身份且会变的是实体。没有身份、按值比较的是值对象。
聚合是一致性边界。一次事务只改一个聚合。
不变量写在聚合内部，不许外部绕过。

## 概念定义

**实体**：有唯一标识，状态会变化。

**值对象**：没有标识，按值比较，通常不可变。

**聚合**：一组对象的边界，对外只有一个根。

**不变量**：任何时刻都必须成立的规则。

## 原理图解

下图回答一个问题：领域建模在架构地图里的位置。

<DiagramFrame src="/diagrams/architecture-map.html" title="架构与领域设计地图：领域建模的位置（Archify 交互图）" :height="560" />

```text
聚合根 ──▶ 不变量检查 ──▶ 内部实体与值对象
一次事务 ──▶ 只改一个聚合
```

## 关键对比

| 类型 | 标识 | 可变 | 比较 |
|---|---|---|---|
| 实体 | 有 | 常变 | 按标识 |
| 值对象 | 无 | 不可变 | 按值 |
| 聚合 | 根有标识 | 受控 | 按根 |

| 边界划分 | 事务 | 一致性 |
|---|---|---|
| 一个聚合 | 单事务 | 强一致 |
| 跨聚合 | 多事务 | 最终一致 |

### 官方依据与版本差异

- [PEP 557](https://peps.python.org/pep-0557/) — 3.7 起提供数据类，适合值对象。
- [dataclasses 文档](https://docs.python.org/3/library/dataclasses.html) — 3.10 起支持 `frozen=True` 与 `slots=True`。
- [PEP 20 禅](https://peps.python.org/pep-0020/) — PEP 20 强调简单结构。

## API 手册：建模手段

### 值对象与实体

<ApiTable :items='[{"name":"frozen dataclass","rank":"必会","signature":"@dataclass(frozen=True)","params":[{"name":"frozen","type":"bool","default":"必填","desc":"设为不可变"}],"returns":"值对象类","effect":"按值比较且不可变","scenario":"金额、地址与范围","example":"from dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass Money:\n    amount: int\n    currency: str","exampleLang":"python","pitfall":"字段里有可变对象时仍可被改动。用元组或冻结结构。","raises":"FrozenInstanceError，改字段时"},{"name":"实体","rank":"必会","signature":"class Order","params":[{"name":"order_id","type":"str","default":"必填","desc":"唯一标识"}],"returns":"实体实例","effect":"按标识比较","scenario":"订单与用户","example":"class Order:\n    def __init__(self, order_id):\n        self.order_id, self.lines = order_id, []","exampleLang":"python","pitfall":"实体不要用全部字段做相等判断。按标识比。","raises":"无"}]' />

### 聚合与不变量

<ApiTable :items='[{"name":"聚合方法","rank":"必会","signature":"aggregate.add(item)","params":[{"name":"item","type":"object","default":"必填","desc":"聚合内对象"}],"returns":"无","effect":"在聚合内维护不变量","scenario":"订单加行","example":"class Order:\n    def add_line(self, line):\n        if line.quantity <= 0:\n            raise ValueError(\"数量必须为正\")\n        self.lines.append(line)","exampleLang":"python","pitfall":"外部直接改内部集合会绕过不变量。","raises":"ValueError，破坏不变量时"}]' />

## 组合用法：下单

### 组合了哪些知识？

组合了三件事：聚合根、值对象与不变量。

### 数据流图解

```text
下单请求 ──▶ 聚合根加行 ──▶ 检查不变量 ──▶ 计算总价 ──▶ 存储
```

### 分步实现

1. 建聚合根。只暴露必要方法。
2. 内部用值对象。金额不可变。
3. 每次修改都检查不变量。
4. 一次事务只改一个聚合。

### 对比表格

| 做法 | 规则位置 | 改动风险 | 测试 |
|---|---|---|---|
| 规则在服务里 | 分散 | 高 | 难 |
| 规则在聚合里 | 集中 | 低 | 易 |

## 完整 Demo：订单聚合

### 场景描述

订单只允许加数量为正的行。总价由聚合计算。

### 完整代码

```python
"""领域建模：聚合与不变量。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Money:
    amount: int

    def add(self, other: "Money") -> "Money":
        return Money(self.amount + other.amount)


@dataclass(frozen=True)
class Line:
    name: str
    price: Money
    quantity: int


class Order:
    def __init__(self, order_id: str) -> None:
        self.order_id = order_id
        self._lines: list[Line] = []

    def add_line(self, line: Line) -> None:
        if line.quantity <= 0:
            raise ValueError("数量必须为正")
        self._lines.append(line)

    def total(self) -> Money:
        result = Money(0)
        for line in self._lines:
            result = result.add(Money(line.price.amount * line.quantity))
        return result


if __name__ == "__main__":
    order = Order("o-1")
    order.add_line(Line("书", Money(30), 2))
    print(order.total())
    try:
        order.add_line(Line("笔", Money(5), 0))
    except ValueError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出总价与一条错误。总价只由聚合计算。

### 常见误区

- 让服务直接改聚合内部集合。不变量被绕过。
- 值对象用可变字段。比较与缓存都会出问题。

### 面试追问链

<details>
<summary>怎么判断是实体还是值对象？</summary>

看是否需要标识。同值不同实例算不算同一个。
</details>

<details>
<summary>聚合边界怎么定？</summary>

以不变量与事务为单位。一次只改一个聚合。
</details>

<details>
<summary>跨聚合一致性怎么办？</summary>

用领域事件与最终一致。不要强行放进一个事务。
</details>

### 下一讲衔接

下一讲 [仓储与领域事件](/backend/learn/architecture/ddd-repository) 讲持久化与解耦。

### 关联组件

暂无。领域模型独立于组件技术。
