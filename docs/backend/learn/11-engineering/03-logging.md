---
title: "结构化日志"
type: knowledge
domain: backend
knowledge_domain: engineering
order: 3
level: advanced
tags: [logging, structured, context]
description: "日志字段、级别与上下文传递：让排障有据可查"
prerequisites:
  - /backend/learn/engineering/secrets
related_knowledge:
  - /backend/learn/engineering/observability
---

### 本讲要解决的问题

日志打印得乱七八糟。
出问题时找不到请求链路与关键字段。

- 日志该记哪些字段。
- 级别怎么用。
- 请求上下文怎么带。

## TL;DR

日志用键值字段，不用长句拼接。
级别只用于过滤，不作为分类。
请求号贯穿整条链路。

## 概念定义

**结构化日志**：字段化的键值记录。便于检索。

**级别**：DEBUG 到 CRITICAL。用于过滤。

**请求号**：一次请求的唯一标识。用来串联。

**上下文**：请求相关的字段集合。

## 原理图解

下图回答一个问题：日志在三类信号里的位置。

<DiagramFrame src="/diagrams/observability-signals.html" title="三类信号：日志、指标与链路的配合（Archify 交互图）" :height="560" />

```text
请求进入 ──▶ 生成请求号 ──▶ 日志带字段 ──▶ 按号检索
```

## 关键对比

| 写法 | 可检索 | 可聚合 |
|---|---|---|
| 长句拼接 | 差 | 差 |
| 键值字段 | 好 | 好 |

| 级别 | 用途 | 不该做 |
|---|---|---|
| ERROR | 需要人处理 | 记录可忽略的问题 |
| WARNING | 需要关注 | 替代错误 |
| INFO | 关键事件 | 打印每个循环 |

### 官方依据与版本差异

- [logging 文档](https://docs.python.org/3/library/logging.html) — 3.12 起 `LoggerAdapter` 与过滤器接口稳定。
- [PEP 282](https://peps.python.org/pep-0282/) — 2.3 起提供标准日志模块。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 建议日志占位符用惰性格式化。

## API 手册：logging

### 基础记录

<ApiTable :items='[{"name":"logging.getLogger","rank":"必会","signature":"getLogger(name=None)","params":[{"name":"name","type":"str","default":"None","desc":"记录器名"}],"returns":"记录器","effect":"按模块取记录器","scenario":"所有模块","example":"import logging\n\nlog = logging.getLogger(__name__)\nlog.info(\"started\", extra={\"request_id\": \"r-1\"})","exampleLang":"python","pitfall":"用 f-string 拼接会丢失结构化字段。","raises":"无"}]' />

### 上下文传递

<ApiTable :items='[{"name":"LoggerAdapter","rank":"常用","signature":"LoggerAdapter(logger, extra)","params":[{"name":"logger","type":"Logger","default":"必填","desc":"底层记录器"},{"name":"extra","type":"dict","default":"必填","desc":"固定上下文"}],"returns":"适配器","effect":"自动附带上下文","scenario":"请求内日志","example":"adapter = logging.LoggerAdapter(log, {\"request_id\": \"r-1\"})","exampleLang":"python","pitfall":"上下文要按请求创建，不要全局复用。","raises":"TypeError，extra 不是字典时"}]' />

## 组合用法：请求号贯穿

### 组合了哪些知识？

组合了三件事：请求号、适配器与检索。

### 数据流图解

```text
入口生成请求号 ──▶ 适配器绑定 ──▶ 各层日志带号 ──▶ 按号检索
```

### 分步实现

1. 入口生成请求号。放在请求上下文里。
2. 用适配器绑定。各层共用。
3. 日志写关键字段。别打整个对象。
4. 反馈请求号给调用方。便于对账。

### 对比表格

| 方案 | 串联能力 | 实现成本 |
|---|---|---|
| 只打时间戳 | 弱 | 低 |
| 请求号 | 强 | 低 |
| 链路追踪 | 最强 | 高 |

## 完整 Demo：带请求号的日志

### 场景描述

为一次请求生成号并输出带字段的日志。

### 完整代码

```python
"""结构化日志：请求号与键值字段。"""

import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(request_id)s %(message)s")
log = logging.getLogger(__name__)


def handle(request_id: str, name: str) -> None:
    adapter = logging.LoggerAdapter(log, {"request_id": request_id})
    adapter.info("开始处理 %s", name)
    adapter.info("处理完成 %s", name)


if __name__ == "__main__":
    handle("r-1", "订单")
    handle("r-2", "用户")

```

### 运行方式

```bash
python3 demo.py
```

两行日志都带请求号。按号即可筛出一次请求的全部记录。

### 常见误区

- 用长句拼日志。检索与聚合都变难。
- 所有事件用 INFO。日志量爆炸，关键事件被淹没。

### 面试追问链

<details>
<summary>为什么用占位符而不是 f-string？</summary>

惰性格式化。级别未开启时不付出拼接开销。
</details>

<details>
<summary>请求号放哪里？</summary>

请求上下文或适配器。跨线程要显式传递。
</details>

<details>
<summary>日志要记哪些字段？</summary>

时间、级别、请求号、主体与结果。避免记录敏感值。
</details>

### 下一讲衔接

下一讲 [可观测性](/backend/learn/engineering/observability) 讲指标与链路。

### 关联组件

暂无。组件按模块取记录器。
