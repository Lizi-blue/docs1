---
title: "测试类型与 UIT"
type: knowledge
domain: vibecoding
knowledge_domain: ai-assisted-dev
order: 2
level: advanced
tags: [testing, uit, test-pyramid, scenario-test]
description: "UIT 不是标准术语，它指用例交互测试，只能从图派生场景路径"
prerequisites:
  - /vibecoding/learn/ai-assisted-dev/layered-naming
related_knowledge:
  - /vibecoding/learn/ai-assisted-dev/reverse-graph-gates
---

### 本讲要解决的问题

UIT 到底指什么，业界有没有这个词。
从分层图能派生出哪些测试。
哪些测试必须另外设计，不能靠图。

### 本讲要解决的问题

- UIT 的输入、产出与服务阶段。
- 完整测试地图的分工。
- 哪些测试能从图派生。

## TL;DR

UIT 不是业界标准术语。按你的描述，它指「用例交互测试」：输入是用例与交互图，产出是场景路径。
它能保证跨层路径被覆盖，不能保证参数取值、非功能与动态分支。
能从图派生的只有场景类测试。单元、契约、性能都必须另外设计。

## 概念定义

**UIT（用例交互测试）**：从用例与交互图派生的场景测试。这个缩写是自定义的，公开资料里没有统一命名。

**场景路径**：图中从入口对象到结果的一条运行序列。

**交互断言**：验证第几步调用了谁、传了什么、返回什么。

**测试地图**：按粒度与目的排列的测试类型集合。

**派生**：从图的结构自动生成测试骨架。断言仍需人工补。

## 原理图解

下图回答一个问题：各类测试处在哪个层级，哪些能从图派生。

<DiagramFrame src="/diagrams/vibecoding-test-map.html" title="测试类型地图：能从图派生的与必须另设计的（Archify 交互图）" :height="560" />

```text
单元测试 ──▶ 组件测试 ──▶ 集成测试 ──▶ 系统测试 ──▶ 验收测试
                          ▲
                  UIT 从图派生场景路径
            契约测试 ← 接口声明　性能与安全 ← 另写
```

## 关键对比

先看 UIT 的边界。

| 维度 | UIT 能做 | UIT 做不到 |
|---|---|---|
| 覆盖 | 跨层场景路径 | 单函数内部分支组合 |
| 断言 | 交互顺序与返回值 | 参数无效值与边界 |
| 需求 | 业务流程正确 | 性能、安全、并发、降级 |
| 维护 | 图变则用例变 | 数据状态与环境差异 |

完整测试地图。

| 类型 | 测什么 | 在哪层 | 依赖 | 解决 | 不解决 |
|---|---|---|---|---|---|
| 单元测试 UT | 一个函数或类的行为 | 最底层 | 替身 | 逻辑正确性 | 跨层协作 |
| 组件测试 | 组件内部协作 | 组件 | 组件内真实对象 | 模块内集成 | 跨组件契约 |
| 集成测试 IT | 多组件协作 | 服务内 | 真实或近真实依赖 | 接口与数据流 | 整链路与容量 |
| 系统测试 ST | 整条链路 | 服务间 | 完整环境 | 端到端功能 | 单模块细节 |
| 契约测试 | 接口约定 | 调用边界 | 契约样本 | 双方接口一致 | 业务正确性 |
| 端到端 E2E | 用户路径 | 全系统 | 真实环境与数据 | 真实业务链路 | 定位精度 |
| 验收测试 AT | 需求达成 | 业务视角 | 验收场景 | 交付判定 | 实现细节 |
| UAT | 用户可用性 | 用户视角 | 真实用户 | 可接受性 | 技术质量 |
| 场景测试 | 业务流程 | 跨层 | 场景路径 | 流程覆盖 | 参数边界 |

### 官方依据与版本差异

- [unittest 文档](https://docs.python.org/3/library/unittest.html) — 3.12 起参数化与夹具接口稳定。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 建议测试命名可读。
- [asyncio 文档](https://docs.python.org/3/library/asyncio.html) — 3.12 起异步测试支持稳定，用于异步交互路径。

## API 手册：用例与路径

### 用例与路径

<ApiTable :items='[{"name":"邻接表","rank":"必会","signature":"graph = {\"A\": [\"B\"]}","params":[{"name":"A","type":"str","default":"必填","desc":"节点名"},{"name":"B","type":"str","default":"必填","desc":"后继节点"}],"returns":"路径枚举的输入结构","effect":"把图变成可遍历结构","scenario":"场景路径枚举","example":"graph = {\"entry\": [\"service\"], \"service\": [\"repo\", \"cache\"]}","exampleLang":"python","pitfall":"有环图要记录已访问节点，否则递归不终止。","raises":"无"},{"name":"路径枚举","rank":"必会","signature":"paths(graph, start, end)","params":[{"name":"start","type":"str","default":"必填","desc":"入口节点"},{"name":"end","type":"str","default":"必填","desc":"终止节点"}],"returns":"路径列表","effect":"生成场景路径","scenario":"派生集成与验收用例","example":"for path in paths(graph, \"entry\", \"result\"):\n    run(path)","exampleLang":"python","pitfall":"路径数会指数增长，要设深度与去重。","raises":"无"}]' />

### 测试组织

<ApiTable :items='[{"name":"参数化用例","rank":"必会","signature":"subTest(path=...)","params":[{"name":"path","type":"list","default":"必填","desc":"一条场景路径"}],"returns":"子测试","effect":"一次运行多条路径","scenario":"场景测试","example":"for path in paths:\n    with self.subTest(path=path):\n        self.run_path(path)","exampleLang":"python","pitfall":"子测试失败不会中断，要汇总失败数。","raises":"无"},{"name":"替身与数据","rank":"常用","signature":"FakeRepo()","params":[],"returns":"替身实例","effect":"隔离外部依赖","scenario":"场景测试","example":"self.service = Service(FakeRepo())","exampleLang":"python","pitfall":"替身行为要与真实实现一致，否则场景通过但线上失败。","raises":"无"}]' />

## 组合用法：从图到用例

### 组合了哪些知识？

组合了三件事：图结构、路径枚举与参数化测试。

### 数据流图解

```text
设计图 ──▶ 邻接表 ──▶ 路径枚举 ──▶ 参数化用例 ──▶ 运行
                                    └── 人工补断言与数据
```

### 分步实现

1. 从设计图抽出节点与边。节点是对象，边是调用。
2. 转成邻接表。标注入口与终止节点。
3. 枚举路径。设深度上限并去重。
4. 每条路径生成用例。断言调用顺序与返回值。

### 对比表格

| 派生方式 | 覆盖 | 维护成本 | 建议 |
|---|---|---|---|
| 人工写场景 | 取决于人 | 高 | 少量关键路径 |
| 从图派生骨架 | 路径完整 | 低 | 推荐 |
| 图派生并自动断言 | 路径完整但断言弱 | 低 | 需人工补断言 |

## 完整 Demo：从邻接表枚举场景路径

### 场景描述

把一张三层协作图转成邻接表，枚举所有从入口到结果的路径，并逐条作为子测试运行。

### 完整代码

```python
"""从图派生场景：邻接表与路径枚举。"""

import unittest

GRAPH = {
    "entry": ["service"],
    "service": ["repo", "cache"],
    "repo": ["result"],
    "cache": ["result"],
    "result": [],
}


def paths(graph: dict, start: str, end: str, limit: int = 6) -> list[list[str]]:
    found: list[list[str]] = []

    def walk(node: str, trail: list[str]) -> None:
        if len(trail) > limit:
            return
        if node == end:
            found.append(list(trail))
            return
        for nxt in graph.get(node, []):
            if nxt in trail:
                continue
            trail.append(nxt)
            walk(nxt, trail)
            trail.pop()

    walk(start, [start])
    return found


class TestScenarioPaths(unittest.TestCase):
    def test_paths_cover_both_branches(self) -> None:
        found = paths(GRAPH, "entry", "result")
        self.assertEqual(len(found), 2)
        for path in found:
            with self.subTest(path=path):
                self.assertIn("result", path[-1])
                self.assertGreaterEqual(len(path), 3)


if __name__ == "__main__":
    for item in paths(GRAPH, "entry", "result"):
        print("路径:", " -> ".join(item))
    unittest.main(argv=["demo"], exit=False)
```

### 运行方式

```bash
python3 demo.py
```

输出两条路径与测试结果。把 cache 分支删掉，路径数变成一条，用例会失败。

### 常见误区

- 以为图能派生参数取值。无效值必须另写等价类与边界值用例。
- 路径爆炸后不设上限。枚举本身会拖垮测试。
- 用图派生性能测试。图里没有容量与并发信息。

### 面试追问链

<details>
<summary>为什么 UIT 不是标准术语？</summary>

公开测试分类里没有这个缩写。它是团队自造的名字，含义靠上下文约定。
</details>

<details>
<summary>图能派生契约测试吗？</summary>

不能。契约要看接口声明与字段语义，图只给调用关系。
</details>

<details>
<summary>非功能需求怎么补？</summary>

单独设计。性能看容量与延迟目标，安全看威胁模型，并发看竞态与限额。
</details>

### 下一讲衔接

下一讲 [逆向图与 CI 门禁](/vibecoding/learn/ai-assisted-dev/reverse-graph-gates) 讲代码侧怎么反向验证。

### 关联组件

暂无。测试地图适用于任何后端组件。
