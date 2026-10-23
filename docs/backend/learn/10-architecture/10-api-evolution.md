---
title: "接口演进"
type: knowledge
domain: backend
knowledge_domain: architecture
order: 10
level: advanced
tags: [versioning, compatibility, deprecation, idempotency]
description: "加字段不改语义：版本策略与兼容窗口"
prerequisites:
  - /backend/learn/architecture/api-design
related_knowledge:
  - /backend/learn/architecture/pattern-selection
---

### 本讲要解决的问题

接口一旦发布就有调用方。
怎么加功能而不破坏旧调用。
旧版本什么时候可以下线。

- 兼容的判定口径。
- 版本策略的取舍。
- 废弃流程与观察期。

## TL;DR

先加字段，不改语义。破坏性变更才升主版本。
旧版本要有观察期与下线公告。
兼容窗口按调用方数量与影响面决定。

## 概念定义

**向后兼容**：新服务端能接受旧请求。

**向前兼容**：旧客户端能忽略新字段。

**破坏性变更**：删字段、改类型、改语义。

**观察期**：旧版本仍可用的一段时间。

## 原理图解

下图回答一个问题：接口演进中版本与幂等层的配合。

<DiagramFrame src="/diagrams/api-evolution.html" title="接口演进：新旧版本共存与幂等（Archify 交互图）" :height="560" />

```text
旧客户端 ──▶ 网关 ──▶ 旧版本（保持兼容）
新客户端 ──▶ 网关 ──▶ 新版本（新增字段）
写操作 ──▶ 幂等层（共用键）
```

## 关键对比

| 变更 | 兼容 | 处理 |
|---|---|---|
| 加可选字段 | 兼容 | 直接发 |
| 加必填字段 | 破坏 | 升主版本 |
| 改字段类型 | 破坏 | 升主版本并迁移 |
| 改错误码 | 破坏 | 双写过渡 |

| 版本策略 | 优点 | 代价 |
|---|---|---|
| 路径版本 | 直观 | 路由变多 |
| 头部版本 | 路径干净 | 不易排查 |
| 字段级演进 | 无版本号 | 需要严格兼容纪律 |

### 官方依据与版本差异

- [HTTP 方法语义](https://developer.mozilla.org/docs/Web/HTTP/Methods) — HTTP/1.1 与 HTTP/2 语义一致。
- [HTTP 状态码](https://developer.mozilla.org/docs/Web/HTTP/Status) — HTTP/1.1 定义状态码类别。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 约束命名一致性。

## API 手册：演进手段

### 兼容变更

<ApiTable :items='[{"name":"加可选字段","rank":"必会","signature":"field: Optional[T] = None","params":[{"name":"T","type":"type","default":"必填","desc":"字段类型"}],"returns":"兼容变更","effect":"旧客户端忽略新字段","scenario":"新增能力","example":"{\"id\": \"o-1\", \"note\": null}","exampleLang":"json","pitfall":"必填字段不能直接加。先可选再收紧。","raises":"无"},{"name":"双写过渡","rank":"常用","signature":"write(old, new)","params":[{"name":"old","type":"str","default":"必填","desc":"旧字段"},{"name":"new","type":"str","default":"必填","desc":"新字段"}],"returns":"无","effect":"新旧字段并行","scenario":"字段改名","example":"payload[\"old\"] = payload.get(\"new\")","exampleLang":"python","pitfall":"双写要有下线日期与检查项。","raises":"无"}]' />

### 废弃与下线

<ApiTable :items='[{"name":"废弃标记","rank":"常用","signature":"Deprecation: true","params":[{"name":"until","type":"str","default":"必填","desc":"下线日期"}],"returns":"响应头","effect":"提示调用方迁移","scenario":"旧版本","example":"Deprecation: true\nSunset: 2026-12-31","exampleLang":"http","pitfall":"只加标记不通知等于没做。要有调用方清单。","raises":"无"},{"name":"调用量观测","rank":"必会","signature":"metric(version, client)","params":[{"name":"version","type":"str","default":"必填","desc":"接口版本"},{"name":"client","type":"str","default":"必填","desc":"调用方标识"}],"returns":"统计结果","effect":"判断下线时机","scenario":"下线前评估","example":"旧版本调用量降到零再下线","exampleLang":"text","pitfall":"不区分调用方就不知道谁还在用。","raises":"无"}]' />

## 组合用法：字段改名

### 组合了哪些知识？

组合了三件事：双写、观测与下线。

### 数据流图解

```text
新旧字段双写 ──▶ 调用方迁移 ──▶ 观测旧字段调用 ──▶ 归零后删除
```

### 分步实现

1. 新增字段并与旧字段双写。
2. 通知调用方迁移。给明确期限。
3. 观测旧字段调用量。区分调用方。
4. 归零并过观察期后删除旧字段。

### 对比表格

| 阶段 | 服务端 | 调用方 | 风险 |
|---|---|---|---|
| 双写 | 都写 | 未迁移 | 低 |
| 迁移 | 都读 | 逐步切换 | 中 |
| 下线 | 只写新 | 已完成 | 低 |

## 完整 Demo：双写过渡

### 场景描述

把字段 name 改名为 title。服务端双写，读时兼容两种。

### 完整代码

```python
"""接口演进：字段名双写过渡。"""


def normalize(payload: dict) -> dict:
    name = payload.get("name")
    title = payload.get("title")
    if title is None and name is None:
        raise ValueError("缺少 name 或 title")
    chosen = title if title is not None else name
    return {"name": chosen, "title": chosen}


if __name__ == "__main__":
    print(normalize({"name": "旧客户端"}))
    print(normalize({"title": "新客户端"}))
    try:
        normalize({})
    except ValueError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

两种入参都得到同一结构。缺字段时报明确错误。

### 常见误区

- 直接改名。旧客户端立刻全挂。
- 无下线期限。双写长期存在，字段越积越多。

### 面试追问链

<details>
<summary>什么算破坏性变更？</summary>

删除字段、改类型、改语义与改错误码。加可选字段通常不算。
</details>

<details>
<summary>版本号放路径还是头部？</summary>

对外公开常用路径。内部服务常用头部或字段级兼容。
</details>

<details>
<summary>怎么判断可以下线？</summary>

按调用方维度观测到旧版本零调用，并过完观察期。
</details>

### 下一讲衔接

下一知识域 [工程化与交付](/backend/learn/engineering/config-management) 讲配置与发布。

### 关联组件

暂无。接口契约与组件版本保持一致。
