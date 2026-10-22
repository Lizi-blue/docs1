---
title: "渐进式类型迁移"
type: knowledge
domain: backend
knowledge_domain: type-system
order: 8
level: advanced
tags: [migration, typing, strategy, ci]
description: "存量代码加类型的路径：先边界，再核心，最后全量"
prerequisites:
  - /backend/learn/type-system/runtime-typing
related_knowledge:
  - /backend/learn/type-system/type-checkers
---

### 本讲要解决的问题

老项目没有注解，怎么开始。
一次全量会炸出几千条报错。
怎么定顺序才能持续有收益。

### 本讲要解决的问题

- 迁移顺序怎么排。
- 每一步的验收标准。
- 怎么防止回退。

## TL;DR

从边界开始。先给对外接口与数据模型加注解。
再打开严格可选项。最后才全量。
每一步都要有门禁，防止新代码降低标准。

## 概念定义

**边界**：系统与外部交互的位置。接口、配置、数据模型。

**基线**：迁移开始时的报错数。用来衡量进度。

**门禁**：只允许新增代码通过检查的标准。

**回退**：新代码没注解就合入。用门禁拦住。

**白名单**：暂时跳过的文件。要有清理期限。

## 原理图解

下图回答一个问题：迁移顺序与每步的产出。

<DiagramFrame src="/diagrams/type-system-map.html" title="类型系统地图：迁移在整条链上的位置（Archify 交互图）" :height="560" />

```text
第一步 边界注解 ──▶ 第二步 严格可选 ──▶ 第三步 隐式 Any ──▶ 第四步 全量
每步都要：基线记录 ──▶ 门禁拦截 ──▶ 报错数只降不升
```

## 关键对比

| 顺序 | 收益 | 风险 |
|---|---|---|
| 先边界 | 立刻拦住外部数据问题 | 内部仍无保护 |
| 先核心模块 | 收益集中在关键路径 | 边界问题仍在 |
| 先全量 | 一次到位 | 报错太多，推不动 |

| 门禁方式 | 强度 | 维护成本 |
|---|---|---|
| 只检查新增文件 | 中 | 低 |
| 全量但允许基线 | 高 | 中 |
| 只靠人工评审 | 低 | 低 |

### 官方依据与版本差异

- [typing 文档](https://docs.python.org/3/library/typing.html) — 3.12 起新语法可用，迁移可逐步采用。
- [PEP 561](https://peps.python.org/pep-0561/) — 3.7 起可分发类型信息。
- [PEP 484](https://peps.python.org/pep-0484/) — 3.5 起类型提示成为标准。

## API 手册：迁移工具

### 逐步加类型

<ApiTable :items='[{"name":"Callable 与 Protocol","rank":"必会","signature":"Callable[P, R]","params":[{"name":"P","type":"ParamSpec","default":"必填","desc":"参数规格"},{"name":"R","type":"type","default":"必填","desc":"返回类型"}],"returns":"可调用类型","effect":"先给回调与接口加注解","scenario":"边界函数","example":"from typing import Callable\n\nHandler = Callable[[dict], bool]","exampleLang":"python","pitfall":"一开始写得太细会拖慢迁移。先粗后细。","raises":"无"},{"name":"TypedDict","rank":"常用","signature":"TypedDict(\"Raw\", {...})","params":[{"name":"keys","type":"dict","default":"必填","desc":"键与值类型"}],"returns":"字典形状","effect":"给外部数据加形状","scenario":"接口入参与配置","example":"from typing import TypedDict\n\nclass Config(TypedDict):\n    host: str\n    port: int","exampleLang":"python","pitfall":"运行时不检查，仍需转换时手工验证。","raises":"无"}]' />

### 门禁与基线

<ApiTable :items='[{"name":"# type: ignore[code]","rank":"必会","signature":"expr  # type: ignore[code]","params":[{"name":"code","type":"str","default":"必填","desc":"问题码"}],"returns":"无","effect":"暂时跳过某行","scenario":"短期过渡","example":"value = legacy()  # type: ignore[no-any-return]","exampleLang":"python","pitfall":"必须带问题码，并在清单里登记清理期限。","raises":"无"},{"name":"mypy --follow-imports","rank":"常用","signature":"mypy --follow-imports=silent app","params":[{"name":"模式","type":"str","default":"normal","desc":"silent 只检查目标文件"}],"returns":"报错清单","effect":"控制检查范围","scenario":"只查改动目录","example":"mypy --follow-imports=silent app/api","exampleLang":"bash","pitfall":"范围太窄会漏掉跨模块问题。","raises":"退出码 1，存在问题时"}]' />

## 组合用法：边界先行

### 组合了哪些知识？

组合了三件事：边界注解、基线记录与门禁拦截。

### 数据流图解

```text
接口层 ──▶ 加标注 ──▶ 检查清零
数据模型 ──▶ TypedDict 或 dataclass ──▶ 转换处校验
CI ──▶ 只检查改动 ──▶ 基线不升
```

### 分步实现

1. 列出边界。接口、配置、外部数据入口。
2. 给这些位置加注解。先用粗类型。
3. 记录基线。把当前报错数写进配置。
4. 加门禁。新代码必须过检查，基线只降不升。

### 对比表格

| 阶段 | 投入 | 收益 | 验收 |
|---|---|---|---|
| 边界注解 | 中 | 高 | 边界文件零报错 |
| 严格可选 | 中 | 中 | 空值问题下降 |
| 隐式 Any | 高 | 中 | Any 数量下降 |
| 全量 | 高 | 高 | 全仓零报错 |

## 完整 Demo：边界类型化

### 场景描述

把一个只收字典的函数改成收数据类。转换只在入口做一次。

### 完整代码

```python
"""渐进式迁移：边界转换与内部类型化。"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Order:
    order_id: str
    amount: int


def parse(raw: dict[str, Any]) -> Order:
    order_id = raw.get("order_id")
    amount = raw.get("amount")
    if not isinstance(order_id, str) or not order_id:
        raise ValueError("order_id 非法")
    if not isinstance(amount, int) or amount <= 0:
        raise ValueError("amount 非法")
    return Order(order_id=order_id, amount=amount)


def total(orders: list[Order]) -> int:
    return sum(order.amount for order in orders)


if __name__ == "__main__":
    order = parse({"order_id": "o-1", "amount": 30})
    print(order)
    print(total([order]))
    try:
        parse({"order_id": "", "amount": 0})
    except ValueError as error:
        print("问题:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出订单、合计与一条问题。内部函数只接收 `Order`，不再处理裸字典。

### 常见误区

- 一次给全仓加注解。报错淹没，推进失败。
- 忽略项不带期限。清单越积越长。

### 面试追问链

<details>
<summary>为什么先做边界？</summary>

边界是问题高发区。类型化后能立刻拦住外部数据问题。
</details>

<details>
<summary>基线怎么防止回退？</summary>

记录报错数并要求只降不升。新代码不达标就拦住。
</details>

<details>
<summary>迁移完成的标准是什么？</summary>

边界与核心模块零报错，忽略清单清空，全量检查进流水线。
</details>

### 下一讲衔接

下一知识域 [架构与领域设计](/backend/learn/architecture/pattern-selection) 讲边界与依赖方向。

### 关联组件

暂无。迁移策略用于组件与页面的代码质量治理。
