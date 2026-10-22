---
title: "集成与契约测试"
type: knowledge
domain: backend
knowledge_domain: engineering
order: 6
level: advanced
tags: [integration, contract, stub]
description: "集成测试与契约测试分工：验证协作与接口约定"
prerequisites:
  - /backend/learn/engineering/unit-testing
related_knowledge:
  - /backend/learn/engineering/property-testing
---

### 本讲要解决的问题

单元测试全绿，上线仍挂。
问题出在组件之间的协作与接口约定。

### 本讲要解决的问题

- 集成测试覆盖什么。
- 契约测试解决什么。
- 测试替身怎么选。

## TL;DR

集成测试验证真实协作，范围要小而准。
契约测试锁定接口约定，双方各自跑。
替身按需要选：桩、假实现或录制回放。

## 概念定义

**集成测试**：多个真实组件一起验证。

**契约测试**：断言接口的形状与语义。

**桩**：返回固定值。

**录制回放**：记录真实响应再复用。

## 原理图解

下图回答一个问题：两类测试在交付链路里的位置。

<DiagramFrame src="/diagrams/delivery-pipeline.html" title="一次可回滚的发布：构建、测试、部署与回滚（Archify 交互图）" :height="560" />

```text
构建 ──▶ 单元测试 ──▶ 集成测试 ──▶ 契约测试 ──▶ 部署
```

## 关键对比

| 测试 | 验证对象 | 成本 |
|---|---|---|
| 集成 | 组件协作 | 中 |
| 契约 | 接口约定 | 低 |
| 端到端 | 整条链路 | 高 |

| 替身 | 适用 | 风险 |
|---|---|---|
| 桩 | 固定响应 | 与真实行为偏离 |
| 假实现 | 有状态逻辑 | 需要维护 |
| 录制回放 | 第三方接口 | 数据会过期 |

### 官方依据与版本差异

- [unittest 文档](https://docs.python.org/3/library/unittest.html) — 3.12 起测试组织接口稳定。
- [json 文档](https://docs.python.org/3/library/json.html) — 3.12 起序列化接口稳定。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 建议契约文件命名清晰。

## API 手册：契约断言

### 形状检查

<ApiTable :items='[{"name":"键集合断言","rank":"必会","signature":"assertEqual(set(data), expected)","params":[{"name":"data","type":"dict","default":"必填","desc":"响应体"},{"name":"expected","type":"set","default":"必填","desc":"期望键"}],"returns":"无","effect":"锁定字段集合","scenario":"接口契约","example":"assertEqual(set(data), {\"id\", \"status\"})","exampleLang":"python","pitfall":"只断言存在不够，类型也要断言。","raises":"AssertionError，键不一致时"}]' />

### 集成准备

<ApiTable :items='[{"name":"临时目录","rank":"必会","signature":"tempfile.TemporaryDirectory()","params":[],"returns":"上下文管理器","effect":"隔离文件系统","scenario":"文件型组件","example":"with tempfile.TemporaryDirectory() as folder:\n    run(folder)","exampleLang":"python","pitfall":"手工建目录容易残留，用上下文管理器。","raises":"OSError，权限不足时"}]' />

## 组合用法：接口契约检查

### 组合了哪些知识？

组合了三件事：契约样本、形状断言与集成准备。

### 数据流图解

```text
契约样本 ──▶ 服务响应 ──▶ 断言字段与类型 ──▶ 失败即阻断
```

### 分步实现

1. 把接口约定写成样本。进版本库。
2. 集成测试用真实组件跑一遍。
3. 断言字段、类型与错误语义。
4. 双方各自跑同一份契约。

### 对比表格

| 方案 | 发现问题的时机 | 成本 |
|---|---|---|
| 只跑单元 | 上线后 | 低 |
| 加契约测试 | 提交前 | 中 |
| 端到端 | 提交后 | 高 |

## 完整 Demo：契约测试

### 场景描述

用样本检查响应字段与错误语义。

### 完整代码

```python
"""集成与契约：字段与错误语义断言。"""

import json
import tempfile
from pathlib import Path

CONTRACT = {"ok": {"id", "status"}, "error": {"code", "message"}}


def respond(ok: bool) -> dict:
    if ok:
        return {"id": "o-1", "status": "created"}
    return {"code": "INVALID_ARGUMENT", "message": "缺少字段"}


def check(payload: dict, kind: str) -> None:
    expected = CONTRACT[kind]
    missing = expected - set(payload)
    if missing:
        raise AssertionError(f"缺少字段：{sorted(missing)}")


if __name__ == "__main__":
    check(respond(True), "ok")
    check(respond(False), "error")
    print("契约通过")
    with tempfile.TemporaryDirectory() as folder:
        path = Path(folder) / "sample.json"
        path.write_text(json.dumps(respond(True)), encoding="utf-8")
        print("样本已写入", path.name)

```

### 运行方式

```bash
python3 demo.py
```

输出契约通过与样本文件名。缺字段会直接断言失败。

### 常见误区

- 集成测试范围过大。慢且失败难定位。
- 契约只断言字段存在。类型变化漏掉。

### 面试追问链

<details>
<summary>集成测试的范围怎么定？</summary>

按协作边界。只覆盖关键路径与易错分支。
</details>

<details>
<summary>契约测试由谁维护？</summary>

由接口提供方起草，调用方共同评审。
</details>

<details>
<summary>录制回放什么时候失效？</summary>

上游响应结构变化时。要定期重录。
</details>

### 下一讲衔接

下一讲 [属性测试](/backend/learn/engineering/property-testing) 讲生成式用例。

### 关联组件

暂无。组件契约由接口测试覆盖。
