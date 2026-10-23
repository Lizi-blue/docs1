---
title: "可观测性"
type: knowledge
domain: backend
knowledge_domain: engineering
order: 4
level: advanced
tags: [metrics, traces, alerts]
description: "指标、链路与告警的配合：从发现到定位"
prerequisites:
  - /backend/learn/engineering/logging
related_knowledge:
  - /backend/learn/engineering/unit-testing
---

### 本讲要解决的问题

只看日志无法发现趋势。
只看指标无法定位到具体请求。

- 三类信号的分工。
- 告警怎么分级。
- 排障顺序怎么定。

## TL;DR

指标发现异常。链路定位服务与耗时。日志看具体事件。
告警按影响面分级，先止住再定位。

## 概念定义

**指标**：可聚合的数值。计数器、直方图与仪表。

**链路**：一次请求跨服务的调用记录。

**告警**：指标越界时触发。分级处理。

**排障顺序**：先看影响面，再看单请求。

## 原理图解

下图回答一个问题：三类信号怎么配合。

<DiagramFrame src="/diagrams/observability-signals.html" title="三类信号：日志、指标与链路的配合（Archify 交互图）" :height="560" />

```text
指标异常 ──▶ 告警 ──▶ 看链路耗时 ──▶ 取请求号查日志
```

## 关键对比

| 信号 | 强项 | 弱项 |
|---|---|---|
| 指标 | 趋势与容量 | 无法定位单请求 |
| 链路 | 跨服务耗时 | 成本高 |
| 日志 | 具体事件 | 量大 |

| 告警级别 | 触发条件 | 处理方式 |
|---|---|---|
| 紧急 | 用户不可用 | 立即介入 |
| 警告 | 部分降级 | 当天处理 |
| 提示 | 趋势异常 | 排入计划 |

### 官方依据与版本差异

- [logging 文档](https://docs.python.org/3/library/logging.html) — 3.12 起日志与指标配合的接口稳定。
- [time 文档](https://docs.python.org/3/library/time.html) — 3.12 起单调时钟接口稳定。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 建议命名可读。

## API 手册：埋点

### 指标

<ApiTable :items='[{"name":"计数器","rank":"必会","signature":"counter(name).inc()","params":[{"name":"name","type":"str","default":"必填","desc":"指标名"}],"returns":"无","effect":"累计事件次数","scenario":"请求量与错误数","example":"errors.inc()","exampleLang":"python","pitfall":"指标名带请求号会炸掉维度。","raises":"无"},{"name":"直方图","rank":"常用","signature":"histogram(name).observe(ms)","params":[{"name":"ms","type":"float","default":"必填","desc":"耗时毫秒"}],"returns":"无","effect":"记录耗时分布","scenario":"接口延迟","example":"latency.observe(35.0)","exampleLang":"python","pitfall":"只看均值会被长尾掩盖。看分位。","raises":"无"}]' />

### 耗时测量

<ApiTable :items='[{"name":"time.perf_counter","rank":"必会","signature":"perf_counter()","params":[],"returns":"单调时钟秒数","effect":"测量耗时","scenario":"接口与任务","example":"start = time.perf_counter()\nrun()\nprint(time.perf_counter() - start)","exampleLang":"python","pitfall":"不要用 wall clock 算耗时，会受校时影响。","raises":"无"}]' />

## 组合用法：埋点与排障

### 组合了哪些知识？

组合了三件事：指标记录、请求号与排障顺序。

### 数据流图解

```text
请求 ──▶ 计时 ──▶ 记录指标 ──▶ 越界告警 ──▶ 按号查日志
```

### 分步实现

1. 在入口与出口埋点。记录次数与耗时。
2. 维度只放低基数标签。
3. 设置分级阈值。越界才告警。
4. 排障先看指标影响面，再看单请求。

### 对比表格

| 方案 | 覆盖面 | 成本 |
|---|---|---|
| 只打日志 | 窄 | 低 |
| 指标加日志 | 中 | 中 |
| 三类齐全 | 广 | 高 |

## 完整 Demo：测量与记录

### 场景描述

给一个函数计时并输出分位所需的数据。

### 完整代码

```python
"""可观测性：计时与指标记录。"""

import time

samples: list[float] = []


def timed(fn):
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            samples.append((time.perf_counter() - start) * 1000)
    return wrapper


@timed
def work() -> int:
    return sum(range(1000))


if __name__ == "__main__":
    for _ in range(5):
        work()
    samples.sort()
    print("次数:", len(samples))
    print("中位耗时:", round(samples[len(samples) // 2], 2))

```

### 运行方式

```bash
python3 demo.py
```

输出次数与中位耗时。真实系统里换成直方图上报。

### 常见误区

- 只用均值判断延迟。长尾问题被掩盖。
- 告警阈值拍脑袋。噪音太多导致没人看。

### 面试追问链

<details>
<summary>三类信号怎么分工？</summary>

指标看趋势，链路看耗时分布，日志看具体事件。
</details>

<details>
<summary>为什么看分位而不是均值？</summary>

少数慢请求会被均值掩盖。分位能暴露长尾。
</details>

<details>
<summary>告警怎么减少噪音？</summary>

分级、加抑制窗口，并绑定明确的处理动作。
</details>

### 下一讲衔接

下一讲 [单元测试](/backend/learn/engineering/unit-testing) 讲测试边界。

### 关联组件

暂无。组件按需暴露指标。
