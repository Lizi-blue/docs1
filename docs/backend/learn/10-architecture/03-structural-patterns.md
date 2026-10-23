---
title: "结构型模式"
type: knowledge
domain: backend
knowledge_domain: architecture
order: 3
level: advanced
tags: [adapter, proxy, decorator, facade]
description: "适配、代理与门面：组合对象而不是继承"
prerequisites:
  - /backend/learn/architecture/creational-patterns
related_knowledge:
  - /backend/learn/architecture/behavioral-patterns
---

### 本讲要解决的问题

第三方接口形状与业务不一致怎么办。
代理与装饰器在 Python 里怎么区分。
门面什么时候值得加。

- 三类结构型手段的边界。
- 组合优于继承的原因。
- 门面的收益与代价。

## TL;DR

形状不一致用适配器。加访问控制用代理。
加前后处理用装饰器。收口复杂子系统用门面。
四者都靠组合，不靠继承。

## 概念定义

**适配器**：把一种接口转成另一种。

**代理**：控制对目标对象的访问。可加缓存、权限与延迟加载。

**装饰器**：在不改目标的前提下加行为。

**门面**：为复杂子系统提供一个简单入口。

## 原理图解

下图回答一个问题：结构型手段在架构地图里的位置。

<DiagramFrame src="/diagrams/architecture-map.html" title="架构与领域设计地图：结构型模式的位置（Archify 交互图）" :height="560" />

```text
业务代码 ──▶ 门面 ──▶ 适配器 ──▶ 第三方接口
                └── 代理（缓存与权限）
```

## 关键对比

| 结构 | 目的 | 典型场景 |
|---|---|---|
| 适配器 | 转接口 | 第三方 SDK |
| 代理 | 控访问 | 缓存与鉴权 |
| 装饰器 | 加行为 | 日志与重试 |
| 门面 | 简化入口 | 启动与资源装配 |

| 手段 | 是否改原对象 | 是否隐藏目标 |
|---|---|---|
| 适配器 | 否 | 是 |
| 代理 | 否 | 否，可透传 |
| 装饰器 | 否 | 否，可叠加 |

### 官方依据与版本差异

- [PEP 20 禅](https://peps.python.org/pep-0020/) — PEP 20 强调扁平优于嵌套。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 要求接口命名清晰。
- [abc 文档](https://docs.python.org/3/library/abc.html) — 3.12 起抽象基类接口稳定。

## API 手册：组合手段

### 适配与代理

<ApiTable :items='[{"name":"适配器类","rank":"必会","signature":"class Adapter","params":[{"name":"target","type":"object","default":"必填","desc":"被适配对象"}],"returns":"符合业务接口的实例","effect":"转换接口形状","scenario":"第三方 SDK 接入","example":"class Adapter:\n    def __init__(self, client):\n        self.client = client\n    def fetch(self, key):\n        return self.client.get(key)","exampleLang":"python","pitfall":"适配器里不要加业务逻辑，只做转换。","raises":"AttributeError，目标缺少方法时"},{"name":"代理类","rank":"常用","signature":"class Proxy","params":[{"name":"target","type":"object","default":"必填","desc":"真实对象"}],"returns":"代理实例","effect":"在访问前后加控制","scenario":"缓存与权限","example":"class Cached:\n    def __init__(self, target):\n        self.target, self.cache = target, {}\n    def get(self, key):\n        return self.cache.setdefault(key, self.target.get(key))","exampleLang":"python","pitfall":"缓存要设失效策略，否则脏数据长期存在。","raises":"无"}]' />

### 装饰与门面

<ApiTable :items='[{"name":"functools.wraps 装饰器","rank":"必会","signature":"@wraps(fn)","params":[{"name":"fn","type":"callable","default":"必填","desc":"被装饰函数"}],"returns":"包装函数","effect":"加前后处理","scenario":"日志、计时与重试","example":"from functools import wraps\n\ndef log(fn):\n    @wraps(fn)\n    def wrapper(*a, **k):\n        print(\"调用\", fn.__name__)\n        return fn(*a, **k)\n    return wrapper","exampleLang":"python","pitfall":"多个装饰器叠加时注意顺序。","raises":"无"},{"name":"门面类","rank":"常用","signature":"class Facade","params":[{"name":"deps","type":"object","default":"必填","desc":"子系统依赖"}],"returns":"门面实例","effect":"收口复杂调用","scenario":"启动装配与批量操作","example":"class Facade:\n    def __init__(self, db, cache):\n        self.db, self.cache = db, cache\n    def save(self, item):\n        self.db.write(item)\n        self.cache.clear()","exampleLang":"python","pitfall":"门面容易长成上帝类，要及时拆分。","raises":"无"}]' />

## 组合用法：接入第三方客户端

### 组合了哪些知识？

组合了三件事：适配器转换、代理缓存与门面装配。

### 数据流图解

```text
业务 ──▶ 门面 ──▶ 代理（缓存）──▶ 适配器 ──▶ 第三方
```

### 分步实现

1. 先写适配器。把第三方接口转成业务方法。
2. 需要缓存或权限时加代理。保持接口不变。
3. 用门面装配。业务只依赖门面。
4. 用真实调用验证。缓存要有失效。

### 对比表格

| 方案 | 业务改动 | 可控性 | 适用 |
|---|---|---|---|
| 直接调用第三方 | 无 | 低 | 原型 |
| 适配器 | 一次 | 中 | 主流 |
| 适配器加代理 | 一次 | 高 | 有性能与安全要求 |

## 完整 Demo：适配器加缓存代理

### 场景描述

第三方客户端只能按 id 取数据。业务要按名字取，并加一层缓存。

### 完整代码

```python
"""结构型模式：适配器与代理。"""


class LegacyClient:
    def fetch_by_id(self, key: str) -> str:
        return f"数据:{key}"


class NameAdapter:
    def __init__(self, client: LegacyClient) -> None:
        self.client = client

    def fetch(self, name: str) -> str:
        return self.client.fetch_by_id(name.lower())


class CachedAdapter:
    def __init__(self, adapter: NameAdapter) -> None:
        self.adapter = adapter
        self.cache: dict[str, str] = {}

    def fetch(self, name: str) -> str:
        if name not in self.cache:
            self.cache[name] = self.adapter.fetch(name)
        return self.cache[name]


if __name__ == "__main__":
    adapter = CachedAdapter(NameAdapter(LegacyClient()))
    print(adapter.fetch("Ada"))
    print(adapter.fetch("Ada"))
    print("缓存条数:", len(adapter.cache))
```

### 运行方式

```bash
python3 demo.py
```

两次输出同一结果，缓存条数为 1。第二次没有再走第三方。

### 常见误区

- 适配器里写业务判断。转换层只做形状对齐。
- 代理缓存不设失效。数据更新后读到旧值。

### 面试追问链

<details>
<summary>代理与装饰器的区别？</summary>

代理控制访问，接口通常一致。装饰器叠加行为，可多个组合。
</details>

<details>
<summary>为什么门面容易变大？</summary>

新需求都往入口加，缺少拆分边界。按用例拆门面。
</details>

<details>
<summary>适配器能不能做数据转换？</summary>

可以，但要保持在形状与单位层面，不要加入业务规则。
</details>

### 下一讲衔接

下一讲 [行为型模式](/backend/learn/architecture/behavioral-patterns) 讲对象之间的协作。

### 关联组件

暂无。结构型手段用于组件适配。
