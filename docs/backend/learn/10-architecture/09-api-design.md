---
title: "REST 与 RPC 设计"
type: knowledge
domain: backend
knowledge_domain: architecture
order: 9
level: advanced
tags: [rest, rpc, idempotency, error-semantics]
description: "资源建模、方法与错误语义：接口怎么定才稳定"
prerequisites:
  - /backend/learn/architecture/ddd-repository
related_knowledge:
  - /backend/learn/architecture/api-evolution
---

### 本讲要解决的问题

同一业务，用 REST 还是 RPC。
方法与幂等怎么对应。
错误怎么表达才不会让调用方猜。

### 本讲要解决的问题

- 两种风格的取舍。
- 方法与幂等的对应关系。
- 错误语义的设计。

## TL;DR

资源清晰、对外公开用 REST。内部动作密集用 RPC。
GET 与 PUT 幂等，POST 通常不幂等。写接口要能去重。
错误用状态码加机器可读码，再加可读说明。

## 概念定义

**REST**：以资源为中心。用方法与路径表达操作。

**RPC**：以动作为中心。一个动作一个方法。

**幂等**：重复调用结果一致。

**错误语义**：状态码、错误码与说明的组合。

## 原理图解

下图回答一个问题：接口设计与演进的层次。

<DiagramFrame src="/diagrams/api-evolution.html" title="接口演进：版本、幂等与兼容窗口（Archify 交互图）" :height="560" />

```text
调用方 ──▶ 网关（版本路由）──▶ 业务接口 ──▶ 幂等层 ──▶ 存储
```

## 关键对比

| 风格 | 建模单位 | 优点 | 代价 |
|---|---|---|---|
| REST | 资源 | 统一、可缓存 | 动作型操作别扭 |
| RPC | 动作 | 直接 | 风格不统一 |

| 方法 | 幂等 | 典型语义 |
|---|---|---|
| GET | 是 | 读取 |
| PUT | 是 | 整体替换 |
| PATCH | 不保证 | 部分修改 |
| POST | 通常否 | 创建或动作 |
| DELETE | 是 | 删除 |

### 官方依据与版本差异

- [HTTP 方法语义](https://developer.mozilla.org/docs/Web/HTTP/Methods) — HTTP/1.1 与 HTTP/2 语义一致。
- [HTTP 状态码](https://developer.mozilla.org/docs/Web/HTTP/Status) — HTTP/1.1 定义主要状态码类别。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 约束接口命名风格。

## API 手册：接口要素

### 方法与幂等

<ApiTable :items='[{"name":"幂等键","rank":"必会","signature":"Idempotency-Key: <id>","params":[{"name":"id","type":"str","default":"必填","desc":"调用方生成的唯一键"}],"returns":"首次结果","effect":"重复请求返回同一结果","scenario":"创建与支付","example":"POST /orders\nIdempotency-Key: 7f3c","exampleLang":"http","pitfall":"键要按业务方向唯一。过期时间要写清。","raises":"409，键冲突且请求不同时"},{"name":"条件更新","rank":"常用","signature":"If-Match: <etag>","params":[{"name":"etag","type":"str","default":"必填","desc":"版本标识"}],"returns":"更新结果或冲突","effect":"避免并发覆盖","scenario":"编辑类接口","example":"PUT /orders/1\nIf-Match: \"v3\"","exampleLang":"http","pitfall":"没取到 etag 就更新会覆盖他人修改。","raises":"412，版本不匹配时"}]' />

### 错误语义

<ApiTable :items='[{"name":"错误体","rank":"必会","signature":"{code, message, trace_id}","params":[{"name":"code","type":"str","default":"必填","desc":"机器可读错误码"},{"name":"message","type":"str","default":"必填","desc":"可读说明"}],"returns":"错误响应","effect":"让调用方可判断与重试","scenario":"所有失败响应","example":"{\"code\": \"INVALID_ARGUMENT\", \"message\": \"amount 必须为正\"}","exampleLang":"json","pitfall":"只给自然语言会让调用方无法分支。","raises":"无"},{"name":"状态码选择","rank":"必会","signature":"400 / 409 / 422 / 429","params":[{"name":"code","type":"int","default":"必填","desc":"HTTP 状态码"}],"returns":"分类结果","effect":"区分错误责任","scenario":"参数、冲突、限流","example":"400 参数不合法\n409 状态冲突\n429 限流","exampleLang":"text","pitfall":"一律用 200 包错误，监控与网关都无法识别。","raises":"无"}]' />

## 组合用法：创建接口

### 组合了哪些知识？

组合了三件事：资源建模、幂等键与错误体。

### 数据流图解

```text
调用方 ──▶ 幂等键检查 ──▶ 参数检查 ──▶ 创建 ──▶ 返回结果与位置
```

### 分步实现

1. 先定资源与动作。动作型强就转 RPC。
2. 写接口加幂等键。键与请求绑定。
3. 参数错误与状态冲突分开返回。
4. 返回体给资源标识与版本。

### 对比表格

| 设计 | 可缓存 | 幂等 | 适用 |
|---|---|---|---|
| GET 列表 | 是 | 是 | 查询 |
| POST 创建加键 | 否 | 是 | 写操作 |
| PUT 替换 | 否 | 是 | 整体更新 |

## 完整 Demo：幂等创建

### 场景描述

用幂等键去重创建请求。重复键返回已有结果。

### 完整代码

```python
"""接口设计：幂等键去重。"""

from dataclasses import dataclass, field


@dataclass
class OrderService:
    orders: dict[str, str] = field(default_factory=dict)
    keys: dict[str, str] = field(default_factory=dict)

    def create(self, key: str, order_id: str) -> tuple[str, bool]:
        if key in self.keys:
            return self.keys[key], False
        self.orders[order_id] = order_id
        self.keys[key] = order_id
        return order_id, True


if __name__ == "__main__":
    service = OrderService()
    print(service.create("k1", "o-1"))
    print(service.create("k1", "o-2"))
    print("订单数:", len(service.orders))
```

### 运行方式

```bash
python3 demo.py
```

第一次返回创建成功，第二次返回已有结果。订单数保持 1。

### 常见误区

- 用 GET 做写操作。重试与缓存都会出错。
- 错误一律 200。网关与监控无法区分。

### 面试追问链

<details>
<summary>REST 与 RPC 怎么选？</summary>

对外资源操作用 REST。内部动作密集用 RPC，但要统一错误与鉴权。
</details>

<details>
<summary>PATCH 为什么不算幂等？</summary>

部分更新的语义可能依赖当前值，例如增量相加。
</details>

<details>
<summary>错误码怎么设计？</summary>

按责任方分类。参数、权限、冲突、限流与内部错误分开。
</details>

### 下一讲衔接

下一讲 [接口演进](/backend/learn/architecture/api-evolution) 讲版本与兼容。

### 关联组件

暂无。接口契约与组件接口一致。
