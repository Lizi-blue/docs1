---
title: "仓储与领域事件"
type: knowledge
domain: backend
knowledge_domain: architecture
order: 8
level: advanced
tags: [repository, domain-events, persistence, decoupling]
description: "持久化不进领域，事件把副作用解耦"
prerequisites:
  - /backend/learn/architecture/domain-modeling
related_knowledge:
  - /backend/learn/architecture/api-design
---

### 本讲要解决的问题

领域对象怎么保存而不知道数据库。
保存之后的副作用（发邮件、清缓存）怎么组织。
仓储与数据访问对象差在哪。

- 仓储的职责边界。
- 领域事件的用途。
- 事务与事件的关系。

## TL;DR

仓储只做聚合的存取，接口定义在领域层。
领域事件描述已经发生的事。副作用由订阅方处理。
事务内只落库，事件在事务后发布。

## 概念定义

**仓储**：聚合的存取接口。按聚合根工作。

**数据访问对象**：面向表的读写。允许更细的操作。

**领域事件**：领域里发生的事实。过去时命名。

**订阅方**：处理事件的组件。

## 原理图解

下图回答一个问题：仓储与事件在架构里的位置。

<DiagramFrame src="/diagrams/architecture-map.html" title="架构与领域设计地图：仓储与领域事件（Archify 交互图）" :height="560" />

```text
应用层 ──▶ 聚合 ──▶ 仓储接口 ──▶ 基础设施实现 ──▶ 数据库
                └──▶ 领域事件 ──▶ 订阅方（发信、清缓存）
```

## 关键对比

| 方案 | 领域依赖数据库 | 可测试 | 适用 |
|---|---|---|---|
| 领域直接写 SQL | 是 | 难 | 小脚本 |
| 仓储接口 | 否 | 易 | 主流 |
| 数据访问对象 | 否 | 易 | 报表与批量 |

| 事件发布时机 | 一致性 | 风险 |
|---|---|---|
| 事务内 | 强 | 副作用失败会回滚 |
| 事务后 | 最终一致 | 可能丢事件 |

### 官方依据与版本差异

- [PEP 20 禅](https://peps.python.org/pep-0020/) — PEP 20 强调解耦与显式。
- [abc 文档](https://docs.python.org/3/library/abc.html) — 3.12 起抽象基类可定义仓储接口。
- [dataclasses 文档](https://docs.python.org/3/library/dataclasses.html) — 3.10 起事件对象可用冻结数据类。

## API 手册：仓储与事件

### 仓储接口

<ApiTable :items='[{"name":"仓储接口","rank":"必会","signature":"class OrderRepo(Protocol)","params":[],"returns":"协议类型","effect":"按聚合根存取","scenario":"领域服务","example":"from typing import Protocol\n\nclass OrderRepo(Protocol):\n    def get(self, order_id: str): ...\n    def save(self, order) -> None: ...","exampleLang":"python","pitfall":"仓储不要暴露查询构造器，那会把技术细节带进领域。","raises":"无"},{"name":"内存实现","rank":"常用","signature":"class MemoryOrderRepo","params":[],"returns":"实现对象","effect":"测试与本地运行","scenario":"单元测试","example":"class MemoryOrderRepo:\n    def __init__(self): self.items = {}\n    def save(self, order): self.items[order.order_id] = order","exampleLang":"python","pitfall":"内存实现要与真实实现保持相同语义。","raises":"KeyError，取不到聚合时"}]' />

### 领域事件

<ApiTable :items='[{"name":"事件对象","rank":"必会","signature":"@dataclass(frozen=True)","params":[{"name":"payload","type":"dict","default":"必填","desc":"事件内容"}],"returns":"事件实例","effect":"描述已发生的事实","scenario":"解耦副作用","example":"from dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass OrderCreated:\n    order_id: str","exampleLang":"python","pitfall":"事件名用过去时，内容要能自解释。","raises":"无"},{"name":"发布与订阅","rank":"常用","signature":"publish(event)","params":[{"name":"event","type":"object","default":"必填","desc":"事件实例"}],"returns":"无","effect":"通知订阅方","scenario":"发信与清缓存","example":"class Bus:\n    def __init__(self): self.handlers = []\n    def publish(self, event):\n        for fn in self.handlers: fn(event)","exampleLang":"python","pitfall":"订阅方失败要记录，不能影响主流程回滚。","raises":"无"}]' />

## 组合用法：下单后发通知

### 组合了哪些知识？

组合了三件事：聚合保存、事件发布与订阅处理。

### 数据流图解

```text
下单 ──▶ 保存聚合 ──▶ 事务提交 ──▶ 发布事件 ──▶ 订阅方发信
```

### 分步实现

1. 应用层调仓储保存聚合。
2. 事务提交后再发布事件。
3. 订阅方处理副作用，失败只记录。
4. 需要重试时把事件写进队列。

### 对比表格

| 方案 | 一致性 | 实现成本 | 适用 |
|---|---|---|---|
| 事务内直接发信 | 强 | 低 | 小系统 |
| 事务后发事件 | 最终一致 | 中 | 主流 |
| 事件表加工人 | 最终一致 | 高 | 关键业务 |

## 完整 Demo：保存后发事件

### 场景描述

保存订单后发布事件。订阅方打印通知，主流程不受影响。

### 完整代码

```python
"""仓储与领域事件：先落库再发布。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class OrderCreated:
    order_id: str


class MemoryRepo:
    def __init__(self) -> None:
        self.items: dict[str, str] = {}

    def save(self, order_id: str) -> None:
        self.items[order_id] = order_id


class Bus:
    def __init__(self) -> None:
        self.handlers = []

    def subscribe(self, fn) -> None:
        self.handlers.append(fn)

    def publish(self, event) -> None:
        for fn in self.handlers:
            fn(event)


def place_order(repo: MemoryRepo, bus: Bus, order_id: str) -> None:
    repo.save(order_id)
    bus.publish(OrderCreated(order_id))


if __name__ == "__main__":
    repo, bus = MemoryRepo(), Bus()
    bus.subscribe(lambda event: print("通知:", event.order_id))
    place_order(repo, bus, "o-1")
    print("存储条数:", len(repo.items))
```

### 运行方式

```bash
python3 demo.py
```

输出通知与已保存条数。订阅方抛错时主流程仍能完成。

### 常见误区

- 仓储里写业务规则。领域规则被技术层掌握。
- 事务内发邮件。失败会连带回滚。

### 面试追问链

<details>
<summary>仓储与数据访问对象的区别？</summary>

仓储面向聚合，接口在领域层。数据访问对象面向表。
</details>

<details>
<summary>事件为什么要在事务后发？</summary>

副作用不可回滚。事务内发布会让失败牵连主流程。
</details>

<details>
<summary>事件丢了怎么办？</summary>

落事件表并加投递记录。配合重试与幂等。
</details>

### 下一讲衔接

下一讲 [REST 与 RPC 设计](/backend/learn/architecture/api-design) 讲对外接口。

### 关联组件

暂无。仓储实现放在基础设施层。
