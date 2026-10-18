---
title: "规划与循环"
type: knowledge
domain: agent
knowledge_domain: evolution
order: 2
level: basic
tags: [planning, loop, termination]
description: "把判定标准补齐：循环、终止条件、轮数与预算"
prerequisites:
  - /agent/learn/evolution/from-qa-to-tools
related_knowledge:
  - /agent/learn/evolution/minimal-agent
---

### 本讲要解决的问题

上一讲给出三条判定。这一讲补齐细节。
一个循环要怎么开始、怎么继续、什么时候停。

### 本讲要解决的问题

- 循环的每一步由什么决定。
- 终止条件有哪几类。
- 轮数与预算怎么定。

## TL;DR

循环由三件事驱动：当前状态、可用工具、终止条件。
终止条件分为目标达成、资源用尽与外部中止三类。缺任何一类都会留下失控口子。

## 概念定义

**规划**：把任务拆成可执行的步骤。拆解可以在每轮做，也可以一次做完。

**循环**：反复执行「观察、决策、动作」三个动作，直到满足终止条件。

**终止条件**：结束循环的判据。分三类。
第一类是目标达成。例如结果通过校验。
第二类是资源用尽。例如轮数、时长或成本达到上限。
第三类是外部中止。例如人工取消或依赖服务不可用。

**预算**：给循环设的上限。常见有轮数上限、时长上限与调用次数上限。

## 原理图解

```text
开始 ──▶ 观察状态 ──▶ 决策 ──▶ 需要动作？
                              │否          │是
                              ▼            ▼
                          目标达成？    执行动作 ──▶ 更新状态
                              │是          │
                              ▼            └──▶ 回到观察
                          结束并返回
                    （轮数或预算到顶也直接结束）
```

下图回答一个问题：规划与循环在整条演进线上处于哪一段，它留下的新问题是什么。

<DiagramFrame src="/diagrams/agent-evolution-timeline.html" title="Agent 演进时间线：规划与循环的位置与遗留问题（Archify 交互图）" :height="560" />

## 关键对比

| 循环方式 | 决策频率 | 适用场景 | 主要风险 |
|---|---|---|---|
| 每轮决策 | 高 | 环境变化快、步骤不确定 | 成本高、容易绕圈 |
| 一次规划到底 | 低 | 步骤稳定、工具确定 | 中途变化要重规划 |
| 混合 | 中 | 先粗规划再逐轮修 | 实现复杂 |

| 终止类型 | 判据示例 | 缺失后果 |
|---|---|---|
| 目标达成 | 结果通过校验 | 明明做完还在循环 |
| 资源用尽 | 轮数或成本到顶 | 成本失控 |
| 外部中止 | 人工取消或依赖不可用 | 卡死无法退出 |

### 官方依据与版本差异

- [LangGraph 发布记录](https://github.com/langchain-ai/langgraph/releases) — 最新发布 1.2.16（2026-10-16 抓取）。1.x 的图式编排与 0.x 接口不同。
- [AutoGen 发布记录](https://github.com/microsoft/autogen/releases) — 最新发布 python-v0.7.5（2025-09-30 抓取）。0.7 与 0.2 的会话编排 API 有差异。
- [crewAI 发布记录](https://github.com/crewAIInc/crewAI/releases) — 最新发布 1.15.28（2026-10-14 抓取）。1.x 起任务与角色定义更细。

Model Context Protocol 规范以日期标识版本，2025-06-18 版决定能力协商方式。

## API 手册：循环控制

### 终止条件

<ApiTable :items='[{"name":"termination","rank":"必会","signature":"termination(state, budget) -> bool","params":[{"name":"state","type":"object","default":"必填","desc":"当前状态与校验结果"},{"name":"budget","type":"object","default":"必填","desc":"轮数、时长与调用次数上限"}],"returns":"True 表示结束循环","effect":"统一判定目标达成与资源用尽","scenario":"每一轮结束前","example":"if termination(state, budget):\n    return state[\"answer\"]","exampleLang":"python","pitfall":"只判目标达成会漏掉资源用尽。两个判据都要写。"}]' />

### 预算与轮数

<ApiTable :items='[{"name":"budget","rank":"必会","signature":"{\"max_rounds\": int, \"max_seconds\": float, \"max_calls\": int}","params":[{"name":"max_rounds","type":"int","default":"建议 4 到 10","desc":"循环轮数上限"},{"name":"max_seconds","type":"float","default":"按场景","desc":"总时长上限"},{"name":"max_calls","type":"int","default":"按场景","desc":"工具调用次数上限"}],"returns":"预算对象，供每轮比较","effect":"把失控风险挡在外部","scenario":"循环开始之前","example":"budget = {\"max_rounds\": 6, \"max_seconds\": 60.0, \"max_calls\": 12}","exampleLang":"python","pitfall":"预算取值要跟着任务复杂度走。取值过小会让正常任务被截断。"}]' />

## 组合用法：给循环加护栏

### 组合了哪些知识？

组合了三件事：终止条件、预算对象与动作幂等。

### 数据流图解

```text
预算对象 ──▶ 每轮比较 ──▶ 超限就结束
终止条件 ──▶ 每轮判定 ──▶ 满足就返回
动作记录 ──▶ 去重 ──▶ 避免重复改外部状态
```

### 分步实现

1. 建预算对象。写清轮数、时长与调用次数上限。
2. 每轮先判终止。目标是先判，资源后判。
3. 记录动作。把已执行的动作记下来，避免重复。
4. 超限就收尾。返回已获得的部分结果与结束原因。

### 对比表格

| 护栏 | 挡住的问题 | 代价 |
|---|---|---|
| 轮数上限 | 绕圈 | 复杂任务可能被截断 |
| 时长上限 | 单次调用过慢 | 需要处理超时收尾 |
| 调用次数上限 | 成本失控 | 需要区分必要与冗余调用 |
| 动作去重 | 重复改外部状态 | 需要动作标识 |

## 完整 Demo：带护栏的循环

### 场景描述

给最小循环加上轮数上限与动作去重。剧本仍用固定函数代替模型。

### 完整代码

```python
"""带护栏的循环：终止条件与预算分开判，动作去重。"""

BUDGET = {"max_rounds": 4, "max_calls": 4}
TABLE = {"gpu": "8 卡", "cpu": "64 核"}


def decide(context, done_actions):
    """代替模型：未查表就查表，已查到就作答。"""
    if "lookup:gpu" in done_actions:
        return {"type": "answer", "text": "结果是 8 卡"}
    return {"type": "tool", "name": "lookup", "args": {"key": "gpu"}}


def action_id(decision):
    return f"{decision['name']}:{decision['args'].get('key')}"


def lookup(args):
    key = args.get("key")
    if key not in TABLE:
        return f"没有这个键：{key}"
    return TABLE[key]


def run(question):
    context, done, calls = [question], set(), 0
    for _ in range(BUDGET["max_rounds"]):
        decision = decide(context, done)
        if decision["type"] == "answer":
            return decision["text"]
        if calls >= BUDGET["max_calls"]:
            return "调用次数到顶，停止。"
        key = action_id(decision)
        if key in done:
            return "检测到重复动作，停止。"
        done.add(key)
        calls += 1
        context.append(lookup(decision["args"]))
    return "轮数到顶，停止。"


if __name__ == "__main__":
    print(run("这台机器有多少卡？"))
```

### 运行方式

```bash
python3 demo.py
```

预期输出一行结果。把预算改小可以观察护栏生效。

### 常见误区

- 只设轮数上限。单轮很慢时仍会超时。
- 不记录动作。重试时可能重复改外部状态。

### 面试追问链

<details>
<summary>为什么先判目标再判资源？</summary>

目标已达成时就没有必要再花预算。顺序反了会浪费一轮。
</details>

<details>
<summary>部分结果要不要返回？</summary>

要返回。带上结束原因与已完成步骤，接线方才能决定是否继续。
</details>

<details>
<summary>幂等为什么放在动作层？</summary>

同一动作可能由不同轮触发。把标识放在动作层才能跨轮去重。
</details>

### 下一讲衔接

下一讲 [最小 agent](/agent/learn/evolution/minimal-agent) 把循环写成一个能跑的对象。重点讲清决策与执行的分离。

### 关联组件

暂无。本方向的组件在后续知识域讨论。
