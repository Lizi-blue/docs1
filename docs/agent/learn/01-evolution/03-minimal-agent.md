---
title: "最小 agent"
type: knowledge
domain: agent
knowledge_domain: evolution
order: 3
level: advanced
tags: [agent-loop, tool-calling, design]
description: "把循环写成对象：决策与执行分离，失败可回退"
prerequisites:
  - /agent/learn/evolution/planning-and-loop
related_knowledge:
  - /agent/learn/evolution/from-qa-to-tools
---

### 本讲要解决的问题

前两讲讲清了阶段与判定。这一讲把最小 agent 写成一个能用的对象。
重点是把决策与执行分开，并让失败可以回退。

### 本讲要解决的问题

- 最小 agent 有哪几个部分。
- 决策与执行为什么要分开。
- 失败怎么回退与上报。

## TL;DR

最小 agent 由四部分组成：上下文、决策器、工具表与循环控制器。
决策器只输出意图，执行器只做校验与动作。分开之后，失败可以被记录、重试或中止。

## 概念定义

**上下文**：一次任务里模型能看到的信息。包含历史、工具声明与外部资料。

**决策器**：读上下文，输出两类结果。一类是最终答案，一类是工具调用意图。

**工具表**：名字到实现的映射。每个工具有入参校验与返回格式。

**循环控制器**：驱动轮次、判终止、记动作、收尾。它不实现业务逻辑。

**回退**：动作失败后的处理。可选重试、换参、改用其他工具或停止。

## 原理图解

```text
调用方 ──▶ 循环控制器 ──▶ 决策器 ──▶ 意图
                 ▲                     │
                 │                     ▼
              记录与判终止 ◀── 工具表（校验与动作）
```

下面这张图回答一个问题：一轮循环里，调用方、控制器、决策器与工具表按什么顺序交互。

<DiagramFrame src="/diagrams/agent-minimal-loop.html" title="最小 agent 循环：决策与执行分离后的调用顺序（Archify 交互图）" :height="560" />

## 关键对比

| 做法 | 决策位置 | 失败处理 | 适用场景 |
|---|---|---|---|
| 决策与执行混在一处 | 不清晰 | 难以定位 | 一次性脚本 |
| 决策与执行分离 | 决策器 | 可记录、可重试 | 需要审计与回退 |

| 失败类型 | 处理方式 | 注意点 |
|---|---|---|
| 入参不合法 | 返回可读原因 | 让决策器有机会改参 |
| 工具超时 | 记一次失败并重试 | 重试次数要有上限 |
| 依赖不可用 | 停止并上报 | 不要把失败吞掉 |

### 官方依据与版本差异

- [LangGraph 发布记录](https://github.com/langchain-ai/langgraph/releases) — 最新发布 1.2.16（2026-10-16 抓取）。1.x 提供图式状态机，适合表达循环。
- [crewAI 发布记录](https://github.com/crewAIInc/crewAI/releases) — 最新发布 1.15.28（2026-10-14 抓取）。1.x 起角色、任务与工具定义的字段划分更细。
- [AutoGen 发布记录](https://github.com/microsoft/autogen/releases) — 最新发布 python-v0.7.5（2025-09-30 抓取）。0.7 与 0.2 的编排接口不同。

Model Context Protocol 规范以日期标识版本，2025-06-18 版决定工具声明与能力协商方式。

## API 手册：最小循环实现

### 决策与执行分离

<ApiTable :items='[{"name":"decide","rank":"必会","signature":"decide(context) -> dict","params":[{"name":"context","type":"list","default":"必填","desc":"历史、工具声明与资料"}],"returns":"答案或工具调用意图","effect":"把模型判断与外部动作解耦","scenario":"每一轮循环开始","example":"decision = decide(context)","exampleLang":"python","pitfall":"决策器不要直接改外部状态。它只输出意图。"}]' />

### 失败与终止

<ApiTable :items='[{"name":"execute","rank":"必会","signature":"execute(decision, tools) -> dict","params":[{"name":"decision","type":"dict","default":"必填","desc":"决策器给出的意图"},{"name":"tools","type":"dict","default":"必填","desc":"名字到实现的映射"}],"returns":"包含 ok、value 或 error 的结果","effect":"校验入参并执行动作","scenario":"决策器给出工具调用之后","example":"outcome = execute(decision, tools)\nif not outcome[\"ok\"]:\n    context.append(outcome[\"error\"])","exampleLang":"python","pitfall":"失败要变成可读原因放回上下文。直接抛错会丢掉重试机会。"}]' />

## 组合用法：四部分拼一个最小 agent

### 组合了哪些知识？

组合了上一讲的循环护栏与本讲的四部分划分。

### 数据流图解

```text
任务 ──▶ 上下文 ──▶ 决策器 ──▶ 意图 ──▶ 工具表 ──▶ 结果
                      ▲                              │
                      └──── 控制器判终止与记动作 ◀───┘
```

### 分步实现

1. 建上下文。放入任务、工具声明与已知资料。
2. 建工具表。每个工具写清入参校验与返回格式。
3. 写决策器。只输出答案或意图。
4. 写控制器。管轮次、判终止、记动作、收尾。
5. 写回退。按失败类型选择重试、换参或停止。

### 对比表格

| 部分 | 输入 | 输出 | 不该做什么 |
|---|---|---|---|
| 上下文 | 任务与资料 | 可读信息集合 | 不做业务判断 |
| 决策器 | 上下文 | 答案或意图 | 不改外部状态 |
| 工具表 | 意图 | 结果或错误 | 不解释业务语义 |
| 控制器 | 轮次与预算 | 最终结果与原因 | 不写业务逻辑 |

## 完整 Demo：四部分的最小 agent

### 场景描述

把四部分写成类，跑一个查表任务。仍用固定剧本代替模型，方便在本机执行。

### 完整代码

```python
"""最小 agent：上下文、决策器、工具表与控制器分开。"""

TABLE = {"gpu": "8 卡"}


class Context:
    def __init__(self, task):
        self.items = [task]

    def add(self, item):
        self.items.append(item)

    def last(self):
        return self.items[-1]


class Decider:
    """代替模型：第一轮查表，第二轮作答。"""

    def decide(self, context):
        if any("8 卡" in str(item) for item in context.items):
            return {"type": "answer", "text": "结果是 8 卡"}
        return {"type": "tool", "name": "lookup", "args": {"key": "gpu"}}


class Tools:
    def __init__(self, table):
        self.table = table

    def execute(self, decision):
        key = decision["args"].get("key")
        if key not in self.table:
            return {"ok": False, "error": f"没有这个键：{key}"}
        return {"ok": True, "value": self.table[key]}


class Controller:
    def __init__(self, decider, tools, max_rounds=4):
        self.decider, self.tools, self.max_rounds = decider, tools, max_rounds

    def run(self, task):
        context = Context(task)
        for _ in range(self.max_rounds):
            decision = self.decider.decide(context)
            if decision["type"] == "answer":
                return decision["text"]
            outcome = self.tools.execute(decision)
            if not outcome["ok"]:
                context.add(outcome["error"])
                continue
            context.add(outcome["value"])
        return "轮数到顶，停止。"


if __name__ == "__main__":
    print(Controller(Decider(), Tools(TABLE)).run("这台机器有多少卡？"))
```

### 运行方式

```bash
python3 demo.py
```

预期输出一行结果。把 `max_rounds` 改成 1 可以观察护栏生效。

### 常见误区

- 让决策器直接调工具。失败时无法回退，也无法记录。
- 把业务逻辑写进控制器。控制器只该管轮次与预算。

### 面试追问链

<details>
<summary>为什么上下文要单独成对象？</summary>

上下文会变长。单独成对象后，才能加裁剪与摘要策略。
</details>

<details>
<summary>工具表要支持超时吗？</summary>

要。每个工具都要有超时。否则单次调用会拖垮整轮。
</details>

<details>
<summary>失败重试几次合适？</summary>

按失败类型定。入参错误不重试，超时类失败重试一两次。
</details>

### 下一讲衔接

下一知识域讲 [协同与并发](/agent/learn/evolution/from-qa-to-tools)。它把单 agent 扩成多个执行体，并给出并发与隔离的做法。

### 关联组件

暂无。本方向的组件在后续知识域讨论。
