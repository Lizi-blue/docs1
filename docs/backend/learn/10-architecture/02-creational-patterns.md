---
title: "创建型模式"
type: knowledge
domain: backend
knowledge_domain: architecture
order: 2
level: advanced
tags: [factory, singleton, registry, builder]
description: "工厂、单例与注册表：创建逻辑复杂时怎么收"
prerequisites:
  - /backend/learn/architecture/pattern-selection
related_knowledge:
  - /backend/learn/architecture/structural-patterns
---

### 本讲要解决的问题

创建逻辑变复杂后，调用方不该在乎细节。
工厂与注册表各解决什么。
单例在 Python 里怎么写才不添乱。

### 本讲要解决的问题

- 三类创建型结构的适用边界。
- 注册表与配置的配合。
- 单例的测试代价。

## TL;DR

创建逻辑超过一行就考虑工厂。
需要按名字取实现时用注册表。
单例优先用模块级对象，避免全局可变状态。

## 概念定义

**工厂**：把创建细节收在一处。调用方只给参数。

**注册表**：名字到实现或工厂函数的映射。

**单例**：全局唯一实例。常用于配置与连接池。

**建造者**：分步构造复杂对象。

## 原理图解

下图回答一个问题：创建型结构在架构地图里的位置。

<DiagramFrame src="/diagrams/architecture-map.html" title="架构与领域设计地图：创建型模式的位置（Archify 交互图）" :height="560" />

```text
调用方 ──▶ 工厂或注册表 ──▶ 具体实现
                     └── 配置决定选哪一个
```

## 关键对比

| 结构 | 解决的问题 | 代价 |
|---|---|---|
| 工厂函数 | 创建细节 | 多一层间接 |
| 注册表 | 按名取实现 | 需要登记 |
| 单例 | 全局唯一 | 难替换，测试麻烦 |
| 建造者 | 多步构造 | 代码量增加 |

| 单例写法 | 可测试 | 推荐 |
|---|---|---|
| 模块级对象 | 可通过注入替换 | 推荐 |
| `__new__` 拦截 | 差 | 少用 |
| 元类实现 | 最差 | 不用 |

### 官方依据与版本差异

- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 建议模块级常量与清晰命名。
- [数据模型](https://docs.python.org/3/reference/datamodel.html) — 3.12 起 `__new__` 语义稳定。
- [dataclasses 文档](https://docs.python.org/3/library/dataclasses.html) — 3.10 起支持 `slots=True`。

## API 手册：创建结构

### 工厂与注册表

<ApiTable :items='[{"name":"工厂函数","rank":"必会","signature":"make(kind, **options)","params":[{"name":"kind","type":"str","default":"必填","desc":"实现类型"},{"name":"options","type":"dict","default":"{}","desc":"构造参数"}],"returns":"实现实例","effect":"集中创建逻辑","scenario":"实现按配置切换","example":"def make(kind):\n    if kind == \"file\":\n        return FileStore()\n    return MemoryStore()","exampleLang":"python","pitfall":"分支越多越难维护。超过三类改用注册表。","raises":"ValueError，未知类型时"},{"name":"注册表","rank":"常用","signature":"registry[name] = factory","params":[{"name":"name","type":"str","default":"必填","desc":"登记名"},{"name":"factory","type":"callable","default":"必填","desc":"工厂函数"}],"returns":"无","effect":"按名取实现","scenario":"插件与策略选择","example":"stores = {}\nstores[\"memory\"] = MemoryStore","exampleLang":"python","pitfall":"重复登记会静默覆盖。启动时检查唯一性。","raises":"KeyError，取不存在的名字时"}]' />

### 单例与建造者

<ApiTable :items='[{"name":"模块级单例","rank":"必会","signature":"instance = build()","params":[],"returns":"唯一实例","effect":"天然单例","scenario":"配置与缓存客户端","example":"# settings.py\nsettings = Settings()","exampleLang":"python","pitfall":"全局可变状态会让测试互相影响。","raises":"无"},{"name":"dataclass 建造","rank":"常用","signature":"dataclass(frozen=True)","params":[{"name":"frozen","type":"bool","default":"False","desc":"是否不可变"}],"returns":"数据类","effect":"用构造参数完成多步设置","scenario":"复杂配置对象","example":"from dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass Config:\n    host: str\n    port: int = 80","exampleLang":"python","pitfall":"字段多时改用关键字构造，避免位置错位。","raises":"TypeError，缺少必填字段时"}]' />

## 组合用法：配置驱动的创建

### 组合了哪些知识？

组合了三件事：配置读取、注册表查找与工厂调用。

### 数据流图解

```text
配置 ──▶ 读实现名 ──▶ 注册表查找 ──▶ 调用工厂 ──▶ 返回实例
```

### 分步实现

1. 启动时读配置。拿到实现名与参数。
2. 查注册表。未登记给出明确错误。
3. 调工厂。把参数传进去。
4. 统一在入口完成。业务代码只收实例。

### 对比表格

| 方案 | 扩展方式 | 启动检查 | 适用 |
|---|---|---|---|
| if 分支 | 改代码 | 无 | 两类以内 |
| 注册表 | 加登记 | 可检查 | 多实现 |
| 插件发现 | 加包 | 需约定 | 外部扩展 |

## 完整 Demo：注册表选择存储

### 场景描述

按配置选择内存存储或文件存储。未登记的名字给出明确错误。

### 完整代码

```python
"""创建型模式：注册表与工厂。"""

from typing import Protocol


class Store(Protocol):
    def save(self, key: str, value: str) -> None: ...


class MemoryStore:
    def __init__(self) -> None:
        self.data: dict[str, str] = {}

    def save(self, key: str, value: str) -> None:
        self.data[key] = value


class FileStore:
    def __init__(self, path: str = "out.txt") -> None:
        self.path = path

    def save(self, key: str, value: str) -> None:
        with open(self.path, "a", encoding="utf-8") as handle:
            handle.write(f"{key}={value}\n")


FACTORIES = {"memory": MemoryStore, "file": FileStore}


def make(name: str) -> Store:
    factory = FACTORIES.get(name)
    if factory is None:
        raise ValueError(f"未登记的存储：{name}")
    return factory()


if __name__ == "__main__":
    store = make("memory")
    store.save("a", "1")
    print(type(store).__name__)
    try:
        make("missing")
    except ValueError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出类名与一条错误。新增存储只需登记一行。

### 常见误区

- 用单例持有可变状态。测试之间互相污染。
- 工厂函数里做网络请求。创建应保持轻量。

### 面试追问链

<details>
<summary>工厂与注册表什么时候合用？</summary>

实现多且按配置选择时。注册表负责找，工厂负责建。
</details>

<details>
<summary>单例破坏了什么？</summary>

可测试性与依赖可见性。隐藏了真实依赖。
</details>

<details>
<summary>建造者何时值得？</summary>

构造步骤多且有检查顺序时。字段少直接构造。
</details>

### 下一讲衔接

下一讲 [结构型模式](/backend/learn/architecture/structural-patterns) 讲对象组合。

### 关联组件

暂无。创建结构用于组件装配。
