---
title: "从基础问答到工具调用"
type: knowledge
domain: agent
knowledge_domain: evolution
order: 1
level: basic
tags: [llm, tool-calling, agent]
description: "三个阶段的分界：单轮问答、上下文与提示、工具调用"
prerequisites: []
related_knowledge:
  - /agent/learn/evolution/planning-and-loop
  - /agent/learn/evolution/minimal-agent
---

### 本讲要解决的问题

大模型最初只会一问一答。后来它能读上下文，也能调用工具。
这一讲把三个阶段分开讲，并给出 agent 的判定标准。

### 本讲要解决的问题

- 每个阶段解决了什么问题。
- 每个阶段带来了什么新问题。
- 什么情况下才算 agent。

## TL;DR

单轮问答只在一次回复里完成。加提示词与上下文之后，模型能看到更多信息。
加上工具调用之后，模型可以改变外部状态。要做到 agent，还要有循环与终止条件。

## 概念定义

**单轮问答**：输入一段话，得到一段回复。模型不记得上次，也不能改变外部状态。

**上下文与提示**：把历史、资料与格式要求一起给模型。模型看到的更多，但仍是单次生成。

**工具调用**：模型输出一个调用意图。由外部代码执行，再把结果放回上下文。

**agent**：在工具调用之上加循环。模型看结果，再决定下一步，直到满足终止条件。

判定一个系统是不是 agent，看三条。

1. 有循环。一次任务里可能多轮决策。
2. 有工具。能读或写外部状态。
3. 有终止条件。达到目标、超时或超预算就停。

三条缺一条，就不是 agent。缺终止条件的循环只是失控的脚本。

## 原理图解

```text
单轮问答       输入 ──▶ 模型 ──▶ 回复
上下文与提示   历史+资料 ──▶ 模型 ──▶ 回复
工具调用       输入 ──▶ 模型 ──▶ 调用意图 ──▶ 外部执行 ──▶ 结果
                                    ▲                        │
agent          输入 ──▶ 模型 ──▶ 调用意图 ──▶ 外部执行 ──▶ 结果
                          ▲                                   │
                          └──── 循环与终止条件 ◀──────────────┘
```

下面这张图回答一个问题：每一段的演进解决了什么，又留下了什么新问题。

<DiagramFrame src="/diagrams/agent-evolution-timeline.html" title="Agent 演进时间线：上排是新增能力，下排是留下的新问题（Archify 交互图）" :height="560" />

## 关键对比

| 维度 | 单轮问答 | 上下文与提示 | 工具调用 | agent |
|---|---|---|---|---|
| 能看到历史 | 否 | 是 | 是 | 是 |
| 能改变外部状态 | 否 | 否 | 是 | 是 |
| 多轮决策 | 否 | 否 | 否 | 是 |
| 主要新问题 | 无状态 | 上下文变长、成本上升 | 需要校验与授权 | 需要终止条件与预算 |
| 失败模式 | 答错 | 被无关内容带偏 | 工具误用、越权 | 死循环、成本失控 |

### 官方依据与版本差异

- [LangGraph 发布记录](https://github.com/langchain-ai/langgraph/releases) — 最新发布 1.2.16（2026-10-16 抓取）。1.x 与 0.x 的图编排接口不同。
- [AutoGen 发布记录](https://github.com/microsoft/autogen/releases) — 最新发布 python-v0.7.5（2025-09-30 抓取）。0.7 与 0.2 的会话编排 API 有差异。
- [crewAI 发布记录](https://github.com/crewAIInc/crewAI/releases) — 最新发布 1.15.28（2026-10-14 抓取）。1.x 起角色与任务定义更细。

厂商与协议文档按日期标识版本，作为对照阅读。
OpenAI 的函数调用文档自 2023-06 起提供，参数格式随后续版本演进。
Anthropic 的工具使用文档自 2024-04 起提供，工具定义字段随版本增加。
Model Context Protocol 规范以日期命名，2025-06-18 版决定能力协商方式。

## API 手册：工具调用契约

### 工具定义

<ApiTable :items='[{"name":"tool_definition","rank":"必会","signature":"{\"name\": str, \"description\": str, \"parameters\": object}","params":[{"name":"name","type":"str","default":"必填","desc":"工具名，同一会话内唯一"},{"name":"description","type":"str","default":"必填","desc":"何时该调用它"},{"name":"parameters","type":"object","default":"必填","desc":"入参结构，字段与类型都要写清"}],"returns":"交给模型的工具声明","effect":"让模型知道有哪些能力可调用","scenario":"任何工具调用之前","example":"tool = {\"name\": \"lookup\", \"description\": \"按键查表\", \"parameters\": {\"key\": \"str\"}}","exampleLang":"python","pitfall":"描述含糊会让模型在不需要时也调用。参数结构缺失会让模型编造字段。"}]' />

### 调用与结果

<ApiTable :items='[{"name":"tool_call","rank":"必会","signature":"{\"type\": \"tool\", \"name\": str, \"args\": object}","params":[{"name":"name","type":"str","default":"必填","desc":"要调用的工具名"},{"name":"args","type":"object","default":"必填","desc":"按声明结构给出的入参"}],"returns":"调用意图；执行后把结果放回上下文","effect":"让模型的决定落到外部动作上","scenario":"模型选择调用工具时","example":"decision = model(context)\nif decision[\"type\"] == \"tool\":\n    result = tools[decision[\"name\"]](decision[\"args\"])","exampleLang":"python","pitfall":"入参必须先校验再执行。失败要把可读原因放回上下文，而不是抛出异常结束循环。"}]' />

## 组合用法：把单轮问答改成最小循环

### 组合了哪些知识？

组合了三件事：上下文拼装、工具定义、循环与终止条件。

### 数据流图解

```text
用户输入 ──▶ 拼装上下文 ──▶ 模型决策 ──▶ 有工具调用？
                                          │是           │否
                                          ▼             ▼
                                    执行工具 ──▶ 结果入上下文   返回答案并结束
                                          │
                                          └── 回到模型决策
```

### 分步实现

1. 写工具定义。给出名字、入参格式与返回格式。
2. 拼上下文。把历史、资料与工具定义一起给模型。
3. 取决策。模型输出答案或工具调用。
4. 执行工具。校验入参，再执行，失败要返回可读原因。
5. 判断终止。达到目标、超过轮数上限或超过预算就停。

### 对比表格

| 步骤 | 单轮问答 | 最小循环 |
|---|---|---|
| 输入拼装 | 只拼当次问题 | 拼历史、资料与工具定义 |
| 决策次数 | 一次 | 多轮 |
| 外部调用 | 无 | 有，且要校验 |
| 结束方式 | 模型输出即结束 | 由终止条件决定 |

## 完整 Demo：带终止条件的决策循环

### 场景描述

把一个可以查表的问答改成循环。模型每轮给出答案，或者请求查表。
本示例不调用真实模型，用一个固定剧本代替，方便在本机执行。

### 完整代码

```python
"""最小决策循环：模型决策与工具执行分开，循环有上限。"""

MAX_ROUNDS = 4
TABLE = {"gpu": "8 卡", "cpu": "64 核"}


def fake_model(context: list[dict]) -> dict:
    """代替真实模型：看到问题就查表，看到结果就作答。"""
    last = context[-1]
    if last["role"] == "user":
        return {"type": "tool", "name": "lookup", "args": {"key": "gpu"}}
    return {"type": "answer", "text": f"结果是 {last['content']}"}


def lookup(args: dict) -> str:
    """工具：入参校验后返回结果。"""
    key = args.get("key")
    if key not in TABLE:
        return f"没有这个键：{key}"
    return TABLE[key]


def run(question: str) -> str:
    context = [{"role": "user", "content": question}]
    for _ in range(MAX_ROUNDS):
        decision = fake_model(context)
        if decision["type"] == "answer":
            return decision["text"]
        result = lookup(decision["args"])
        context.append({"role": "tool", "content": result})
    return "超过轮数上限，停止。"


if __name__ == "__main__":
    print(run("这台机器有多少卡？"))
```

### 运行方式

```bash
python3 demo.py
```

预期输出一行结果。把 `MAX_ROUNDS` 改小，可以观察终止条件生效。

### 常见误区

- 把「带工具的聊天」当成 agent。只调用一次工具就返回，仍不是循环。
- 不设终止条件。模型一直请求工具时，进程不会停。

### 面试追问链

<details>
<summary>为什么工具定义要写返回格式？</summary>

模型按返回格式读结果。格式不固定，模型会误读。
</details>

<details>
<summary>工具执行失败应该怎么办？</summary>

把可读原因放回上下文。让模型决定重试、换参数或直接作答。
</details>

<details>
<summary>哪些工具调用必须人工确认？</summary>

会改变外部状态且难以回滚的调用。例如转账、删除与发布。
</details>

### 下一讲衔接

下一讲 [规划与循环](/agent/learn/evolution/planning-and-loop) 把判定标准补齐。重点讲清轮数与预算怎么定。

### 关联组件

暂无。本方向的组件在后续知识域讨论。
