---
title: "行为型模式"
type: knowledge
domain: backend
knowledge_domain: architecture
order: 4
level: advanced
tags: [strategy, chain, observer, command]
description: "策略、责任链与观察者：对象之间怎么协作"
prerequisites:
  - /backend/learn/architecture/structural-patterns
related_knowledge:
  - /backend/learn/architecture/layering
---

### 本讲要解决的问题

同一入口有多套处理逻辑，怎么组织。
多个处理步骤要串起来，怎么写。
状态变化要通知多方，怎么解耦。

### 本讲要解决的问题

- 三类协作结构的适用场景。
- 顺序与失败的传递方式。
- 通知带来的耦合问题。

## TL;DR

算法可替换用策略。步骤可增减用责任链。
一方变化多方响应用观察者。
三者都要求调用方依赖抽象，不依赖具体步骤。

## 概念定义

**策略**：把可替换的算法封装成独立对象。

**责任链**：处理器依次尝试，直到有人处理。

**观察者**：状态变化时通知订阅者。

**命令**：把一次操作封装成对象。便于排队与回滚。

## 原理图解

下图回答一个问题：行为型结构在架构地图里的位置。

<DiagramFrame src="/diagrams/architecture-map.html" title="架构与领域设计地图：行为型模式的位置（Archify 交互图）" :height="560" />

```text
请求 ──▶ 策略选择 ──▶ 执行处理
请求 ──▶ 责任链 1 ──▶ 2 ──▶ 3 ──▶ 停止或落空
状态变化 ──▶ 通知订阅者列表
```

## 关键对比

| 结构 | 变化点 | 失败传递 |
|---|---|---|
| 策略 | 算法 | 由调用方处理 |
| 责任链 | 处理步骤 | 逐级返回或抛出 |
| 观察者 | 订阅方 | 单个订阅失败不影响其他 |
| 命令 | 操作的排队 | 由执行器记录 |

| 方案 | 扩展成本 | 调试难度 |
|---|---|---|
| 大 if 分支 | 每加一类改一处 | 低 |
| 策略表 | 加一条登记 | 中 |
| 责任链 | 插入处理器 | 中高 |

### 官方依据与版本差异

- [PEP 20 禅](https://peps.python.org/pep-0020/) — PEP 20 强调显式优于隐式。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 约束命名可读性。
- [functools 文档](https://docs.python.org/3/library/functools.html) — 3.12 起 `singledispatch` 稳定。

## API 手册：协作结构

### 策略与责任链

<ApiTable :items='[{"name":"策略表","rank":"必会","signature":"handlers = {\"a\": fn_a}","params":[{"name":"key","type":"str","default":"必填","desc":"策略名"},{"name":"fn","type":"callable","default":"必填","desc":"策略实现"}],"returns":"无","effect":"按名选择算法","scenario":"同一入口多套逻辑","example":"handlers = {\"fast\": fast_path, \"safe\": safe_path}","exampleLang":"python","pitfall":"表里缺键时给出明确错误，不要静默回退。","raises":"KeyError，取不存在的策略时"},{"name":"责任链","rank":"常用","signature":"class Handler","params":[{"name":"next_handler","type":"Handler","default":"None","desc":"下一个处理器"}],"returns":"处理器实例","effect":"按顺序尝试","scenario":"检查、日志与补偿","example":"class Auth:\n    def __init__(self, nxt=None):\n        self.nxt = nxt\n    def handle(self, req):\n        if not req.get(\"token\"):\n            raise ValueError(\"缺少令牌\")\n        return self.nxt.handle(req) if self.nxt else req","exampleLang":"python","pitfall":"链尾必须处理，否则请求静默丢失。","raises":"ValueError，条件不满足时"}]' />

### 观察者与命令

<ApiTable :items='[{"name":"观察者","rank":"常用","signature":"subscribe(fn)","params":[{"name":"fn","type":"callable","default":"必填","desc":"订阅回调"}],"returns":"无","effect":"状态变化通知多方","scenario":"事件与缓存失效","example":"class Bus:\n    def __init__(self):\n        self.items = []\n    def subscribe(self, fn):\n        self.items.append(fn)\n    def publish(self, event):\n        for fn in self.items:\n            fn(event)","exampleLang":"python","pitfall":"回调里抛错会影响后续订阅者。必要时逐个捕获。","raises":"无"},{"name":"命令对象","rank":"进阶","signature":"class Command","params":[{"name":"payload","type":"dict","default":"必填","desc":"操作参数"}],"returns":"命令实例","effect":"把操作封装成对象","scenario":"排队、重试与回滚","example":"class CreateUser:\n    def __init__(self, name):\n        self.name = name\n    def apply(self):\n        return {\"name\": self.name}","exampleLang":"python","pitfall":"有副作用的命令要能重试，先做幂等。","raises":"无"}]' />

## 组合用法：请求处理链

### 组合了哪些知识？

组合了三件事：鉴权、检查与业务处理。

### 数据流图解

```text
请求 ──▶ 鉴权 ──▶ 参数检查 ──▶ 业务处理 ──▶ 响应
            失败即返回
```

### 分步实现

1. 每个处理器只做一件事。
2. 失败时立刻返回或抛出。
3. 链尾给出明确错误。
4. 日志切入链的入口。

### 对比表格

| 方案 | 复用 | 顺序调整 | 调试 |
|---|---|---|---|
| 单个函数全写 | 低 | 难 | 易 |
| 责任链 | 高 | 易 | 中 |

## 完整 Demo：责任链处理请求

### 场景描述

请求依次经过鉴权与参数检查。全部通过才进入业务处理。

### 完整代码

```python
"""行为型模式：责任链。"""


class Handler:
    def __init__(self, nxt=None):
        self.nxt = nxt

    def handle(self, request):
        raise NotImplementedError


class Auth(Handler):
    def handle(self, request):
        if not request.get("token"):
            raise ValueError("缺少令牌")
        return self.nxt.handle(request)


class Validate(Handler):
    def handle(self, request):
        if "name" not in request:
            raise ValueError("缺少 name")
        return self.nxt.handle(request)


class Business(Handler):
    def handle(self, request):
        return {"ok": True, "name": request["name"]}


if __name__ == "__main__":
    chain = Auth(Validate(Business()))
    print(chain.handle({"token": "t", "name": "ada"}))
    try:
        chain.handle({"name": "ada"})
    except ValueError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出成功结果与一条错误。插入新步骤只需改链的装配。

### 常见误区

- 责任链没有链尾处理。请求被静默丢弃。
- 观察者回调里做重活。通知变成同步阻塞。

### 面试追问链

<details>
<summary>策略与责任链怎么选？</summary>

互斥的多选一用策略。依次尝试用责任链。
</details>

<details>
<summary>观察者如何避免耦合？</summary>

发布方只依赖接口。订阅方自己注册。
</details>

<details>
<summary>命令模式解决了什么？</summary>

把操作变成数据。可排队、重试与回滚。
</details>

### 下一讲衔接

下一讲 [分层与依赖方向](/backend/learn/architecture/layering) 讲模块边界。

### 关联组件

暂无。行为型结构用于请求处理。
