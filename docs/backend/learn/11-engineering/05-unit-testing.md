---
title: "单元测试"
type: knowledge
domain: backend
knowledge_domain: engineering
order: 5
level: advanced
tags: [unittest, fixtures, boundaries]
description: "测试边界与夹具设计：只测自己的一层"
prerequisites:
  - /backend/learn/engineering/observability
related_knowledge:
  - /backend/learn/engineering/integration-contract
---

### 本讲要解决的问题

测试越写越多却越来越慢。
一改实现就全红，问题出在边界没划清。

### 本讲要解决的问题

- 单元测试的边界。
- 夹具怎么组织。
- 哪些不该测。

## TL;DR

单元测试只测一个单元，依赖用替身。
夹具负责准备与清理，不负责断言。
外部系统不放进单元测试。

## 概念定义

**被测单元**：一个函数或一个类。边界明确。

**替身**：替换真实依赖的实现。

**夹具**：准备与清理测试环境。

**断言**：验证行为，不验证实现细节。

## 原理图解

下图回答一个问题：单元测试在交付链路里的位置。

<DiagramFrame src="/diagrams/engineering-map.html" title="工程化与交付地图：运行支撑与交付链路（Archify 交互图）" :height="560" />

```text
夹具准备 ──▶ 调用被测单元 ──▶ 断言 ──▶ 清理
```

## 关键对比

| 测试类型 | 覆盖范围 | 速度 |
|---|---|---|
| 单元 | 一个单元 | 快 |
| 集成 | 多组件 | 中 |
| 端到端 | 整条链路 | 慢 |

| 断言对象 | 稳定性 | 建议 |
|---|---|---|
| 行为结果 | 高 | 推荐 |
| 内部调用次数 | 低 | 少用 |

### 官方依据与版本差异

- [unittest 文档](https://docs.python.org/3/library/unittest.html) — 3.12 起夹具与断言接口稳定。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 建议测试命名清晰。
- [PEP 484](https://peps.python.org/pep-0484/) — 3.5 起可为测试加类型注解。

## API 手册：unittest

### 用例与断言

<ApiTable :items='[{"name":"unittest.TestCase","rank":"必会","signature":"class TestX(TestCase)","params":[],"returns":"用例类","effect":"组织用例","scenario":"单元测试","example":"import unittest\n\nclass TestAdd(unittest.TestCase):\n    def test_sum(self):\n        self.assertEqual(1 + 1, 2)","exampleLang":"python","pitfall":"一个用例只断言一个行为，失败才好定位。","raises":"AssertionError，断言失败时"},{"name":"assertRaises","rank":"必会","signature":"assertRaises(Exc)","params":[{"name":"Exc","type":"type","default":"必填","desc":"期望异常类型"}],"returns":"上下文管理器","effect":"断言抛出异常","scenario":"错误路径","example":"with self.assertRaises(ValueError):\n    parse(\"\")","exampleLang":"python","pitfall":"要断言错误信息时用 assertRaisesRegex。","raises":"AssertionError，未抛出时"}]' />

### 夹具

<ApiTable :items='[{"name":"setUp","rank":"必会","signature":"setUp(self)","params":[],"returns":"无","effect":"每个用例前准备","scenario":"独立环境","example":"def setUp(self):\n    self.service = Service(FakeRepo())","exampleLang":"python","pitfall":"setUp 里不要放重资源，会拖慢全部用例。","raises":"无"},{"name":"tearDown","rank":"常用","signature":"tearDown(self)","params":[],"returns":"无","effect":"每个用例后清理","scenario":"临时文件与连接","example":"def tearDown(self):\n    self.tmp.cleanup()","exampleLang":"python","pitfall":"清理失败会掩盖真正的断言失败。","raises":"无"}]' />

## 组合用法：依赖替身

### 组合了哪些知识？

组合了三件事：边界划分、替身与断言。

### 数据流图解

```text
构造替身 ──▶ 注入服务 ──▶ 调用 ──▶ 断言结果 ──▶ 清理
```

### 分步实现

1. 先定被测单元。只测一层。
2. 依赖换成替身。替身遵守同一约定。
3. 调用并断言行为结果。
4. 清理临时资源。

### 对比表格

| 做法 | 速度 | 稳定性 |
|---|---|---|
| 连真实数据库 | 慢 | 差 |
| 依赖替身 | 快 | 好 |

## 完整 Demo：带替身的单元测试

### 场景描述

为注册服务写用例。仓储用内存替身，覆盖成功与失败。

### 完整代码

```python
"""单元测试：替身、断言与清理。"""

import unittest


class FakeRepo:
    def __init__(self) -> None:
        self.items = []

    def save(self, name: str) -> None:
        self.items.append(name)


class Service:
    def __init__(self, repo) -> None:
        self.repo = repo

    def register(self, name: str) -> str:
        text = name.strip()
        if not text:
            raise ValueError("名字不能为空")
        self.repo.save(text)
        return text


class TestService(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = FakeRepo()
        self.service = Service(self.repo)

    def test_register_ok(self) -> None:
        self.assertEqual(self.service.register("ada"), "ada")
        self.assertEqual(len(self.repo.items), 1)

    def test_register_empty(self) -> None:
        with self.assertRaises(ValueError):
            self.service.register("  ")


if __name__ == "__main__":
    unittest.main()

```

### 运行方式

```bash
python3 demo.py
```

两个用例都通过。替换仓储不影响任何断言。

### 常见误区

- 单元测试连真实数据库。慢且不稳。
- 断言内部调用次数。重构就红。

### 面试追问链

<details>
<summary>单元测试与集成测试的边界？</summary>

单元只测一层。跨组件协作放集成测试。
</details>

<details>
<summary>夹具该做多少事？</summary>

只准备与清理。断言写在用例里。
</details>

<details>
<summary>测试为什么不能依赖运行顺序？</summary>

顺序变化会让结果不确定。每个用例要独立。
</details>

### 下一讲衔接

下一讲 [集成与契约测试](/backend/learn/engineering/integration-contract) 讲跨组件验证。

### 关联组件

暂无。组件测试基于单元测试组织。
