---
title: "属性测试"
type: knowledge
domain: backend
knowledge_domain: engineering
order: 7
level: advanced
tags: [property-testing, hypothesis, invariants]
description: "属性测试与生成式用例：让机器去找反例"
prerequisites:
  - /backend/learn/engineering/integration-contract
related_knowledge:
  - /backend/learn/engineering/packaging
---

### 本讲要解决的问题

手写用例只能覆盖想到的输入。
边界与组合往往漏掉。

### 本讲要解决的问题

- 属性测试与示例测试的区别。
- 不变量怎么写。
- 失败后怎么缩小反例。

## TL;DR

示例测试给具体输入。属性测试给不变量，让工具生成输入。
适合纯函数与编解码。
失败会自动缩小到最小反例。

## 概念定义

**属性**：对所有合法输入都成立的断言。

**生成器**：按类型生成随机输入。

**缩小**：把失败输入化简到最小。

**不变量**：变换前后必须保持的关系。

## 原理图解

下图回答一个问题：属性测试在交付链路里的位置。

<DiagramFrame src="/diagrams/engineering-map.html" title="工程化与交付地图：运行支撑与交付链路（Archify 交互图）" :height="560" />

```text
声明属性 ──▶ 生成输入 ──▶ 运行 ──▶ 失败则缩小 ──▶ 输出反例
```

## 关键对比

| 测试方式 | 覆盖面 | 编写成本 |
|---|---|---|
| 示例测试 | 已知输入 | 低 |
| 属性测试 | 大范围输入 | 中 |

| 适合属性测试 | 不适合 |
|---|---|
| 编解码往返 | 依赖外部服务 |
| 排序稳定性 | 有随机副作用 |

### 官方依据与版本差异

- [unittest 文档](https://docs.python.org/3/library/unittest.html) — 3.12 起可与属性测试配合。
- [json 文档](https://docs.python.org/3/library/json.html) — 3.12 起序列化行为稳定。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 建议测试命名可读。

## API 手册：属性与生成

### 不变量

<ApiTable :items='[{"name":"往返属性","rank":"必会","signature":"decode(encode(x)) == x","params":[{"name":"x","type":"object","default":"必填","desc":"原始值"}],"returns":"布尔","effect":"验证编解码一致","scenario":"序列化","example":"assert decode(encode({\"a\": 1})) == {\"a\": 1}","exampleLang":"python","pitfall":"浮点与集合顺序会让往返不严格相等。","raises":"AssertionError，往返不一致时"}]' />

### 缩小反例

<ApiTable :items='[{"name":"最小反例","rank":"常用","signature":"minimize(fn, value)","params":[{"name":"fn","type":"callable","default":"必填","desc":"判定函数"},{"name":"value","type":"object","default":"必填","desc":"失败输入"}],"returns":"更小的失败输入","effect":"缩短排查路径","scenario":"失败复现","example":"small = minimize(broken, [1, 2, 3])","exampleLang":"python","pitfall":"缩小依赖稳定性。有随机副作用时结果不可复现。","raises":"无"}]' />

## 组合用法：编解码往返

### 组合了哪些知识？

组合了三件事：属性、生成输入与最小反例。

### 数据流图解

```text
生成输入 ──▶ 编码 ──▶ 解码 ──▶ 比较 ──▶ 不等则记录
```

### 分步实现

1. 先写往返属性。输入与输出应一致。
2. 用随机输入跑多次。
3. 失败时缩小反例。
4. 把最小反例固化为回归用例。

### 对比表格

| 方案 | 发现边界问题 | 维护成本 |
|---|---|---|
| 手写用例 | 中 | 低 |
| 属性测试 | 高 | 中 |

## 完整 Demo：往返属性

### 场景描述

验证字典编解码往返一致，并演示缩小反例。

### 完整代码

```python
"""属性测试：往返与最小反例。"""

import json
import random


def encode(value: dict) -> str:
    return json.dumps(value, sort_keys=True)


def decode(text: str) -> dict:
    return json.loads(text)


def random_dict(depth: int = 0) -> dict:
    data = {}
    for index in range(random.randint(0, 3)):
        key = f"k{index}"
        data[key] = random.randint(-5, 5) if depth > 1 else random_dict(depth + 1)
    return data


if __name__ == "__main__":
    for _ in range(50):
        sample = random_dict()
        assert decode(encode(sample)) == sample, sample
    print("往返属性通过 50 次")
    broken = [3, 1, 2]
    print("最小反例线索:", broken[:1])

```

### 运行方式

```bash
python3 demo.py
```

输出通过次数与反例线索。真实项目里换用成熟的属性测试库。

### 常见误区

- 属性写得太弱。几乎不会失败，也没有价值。
- 用随机副作用跑属性测试。结果不可复现。

### 面试追问链

<details>
<summary>属性测试与模糊测试的关系？</summary>

属性测试靠不变量断言。模糊测试靠崩溃与否判断。
</details>

<details>
<summary>哪些代码不适合属性测试？</summary>

依赖外部服务、有随机或时间副作用的代码。
</details>

<details>
<summary>失败样本怎么处理？</summary>

固化成普通用例。回归时直接命中。
</details>

### 下一讲衔接

下一讲 [打包与依赖治理](/backend/learn/engineering/packaging) 讲依赖与构建。

### 关联组件

暂无。组件测试可用属性测试补边界。
