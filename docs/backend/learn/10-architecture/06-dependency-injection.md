---
title: "依赖注入"
type: knowledge
domain: backend
knowledge_domain: architecture
order: 6
level: advanced
tags: [dependency-injection, wiring, container, testing]
description: "手工装配与容器注入：把依赖关系写清"
prerequisites:
  - /backend/learn/architecture/layering
related_knowledge:
  - /backend/learn/architecture/domain-modeling
---

### 本讲要解决的问题

对象自己创建依赖会隐藏耦合。
依赖多了以后怎么装配。
容器要不要用，用到什么程度。

- 三种装配方式。
- 容器的代价。
- 测试里怎么替换依赖。

## TL;DR

依赖由外部传入，不在内部创建。
小项目手工装配就够。依赖多时用轻量容器。
容器只做装配，不承载业务。

## 概念定义

**依赖注入**：把依赖作为参数传入。

**装配**：在入口处把对象与依赖连起来。

**容器**：按注册信息自动解析依赖。

**构造注入**：依赖在构造时传入。最常用。

## 原理图解

下图回答一个问题：依赖注入在分层里的位置。

<DiagramFrame src="/diagrams/layering-dependencies.html" title="分层与依赖注入：装配在入口完成（Archify 交互图）" :height="560" />

```text
入口 ──▶ 装配依赖 ──▶ 服务 ──▶ 仓储实现
                          └── 依赖由外部传入
```

## 关键对比

| 方式 | 可测试 | 代码量 | 适用 |
|---|---|---|---|
| 内部创建 | 差 | 少 | 脚本 |
| 构造注入 | 好 | 中 | 主流 |
| 容器装配 | 好 | 多 | 依赖多 |

| 容器用法 | 收益 | 风险 |
|---|---|---|
| 只装配入口 | 清晰 | 少 |
| 全局自动解析 | 少写代码 | 依赖隐藏，难追踪 |
| 运行期改注册 | 灵活 | 行为不可预测 |

### 官方依据与版本差异

- [PEP 20 禅](https://peps.python.org/pep-0020/) — PEP 20 强调显式优于隐式。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 约束命名与结构。
- [abc 文档](https://docs.python.org/3/library/abc.html) — 3.12 起可用于声明依赖接口。

## API 手册：装配手段

### 构造注入

<ApiTable :items='[{"name":"构造注入","rank":"必会","signature":"Service(repo, cache)","params":[{"name":"repo","type":"Repo","default":"必填","desc":"仓储实现"},{"name":"cache","type":"Cache","default":"必填","desc":"缓存实现"}],"returns":"服务实例","effect":"显式声明依赖","scenario":"服务与仓储","example":"class Service:\n    def __init__(self, repo, cache):\n        self.repo, self.cache = repo, cache","exampleLang":"python","pitfall":"不要在构造里创建依赖，否则无法替换。","raises":"无"},{"name":"工厂装配","rank":"常用","signature":"build_app(config)","params":[{"name":"config","type":"dict","default":"必填","desc":"配置"}],"returns":"已装配的应用","effect":"集中装配逻辑","scenario":"启动入口","example":"def build_app(config):\n    repo = MemoryRepo() if config.get(\"test\") else DbRepo()\n    return Service(repo)","exampleLang":"python","pitfall":"装配函数里不要写业务分支。","raises":"KeyError，配置缺字段时"}]' />

### 测试替换

<ApiTable :items='[{"name":"测试替身","rank":"必会","signature":"class FakeRepo","params":[],"returns":"测试用实现","effect":"替换真实依赖","scenario":"单元测试","example":"class FakeRepo:\n    def save(self, name):\n        self.saved = name","exampleLang":"python","pitfall":"替身要遵守与真实实现相同的约定。","raises":"无"},{"name":"覆盖依赖","rank":"常用","signature":"service.repo = fake","params":[{"name":"fake","type":"object","default":"必填","desc":"替换对象"}],"returns":"无","effect":"临时替换","scenario":"集成测试","example":"service = Service(FakeRepo())","exampleLang":"python","pitfall":"运行中改依赖会让状态不一致。尽量在构造时传入。","raises":"无"}]' />

## 组合用法：入口装配

### 组合了哪些知识？

组合了三件事：配置读取、实现选择与构造注入。

### 数据流图解

```text
配置 ──▶ 选择实现 ──▶ 构造服务 ──▶ 交给接口层
```

### 分步实现

1. 读配置。确定实现类型。
2. 创建实现。配置不合法时给出明确错误。
3. 构造服务。依赖全部传入。
4. 只在入口装配。业务代码不碰容器。

### 对比表格

| 装配方式 | 依赖可见性 | 替换成本 | 适用 |
|---|---|---|---|
| 内部创建 | 低 | 高 | 脚本 |
| 手工装配 | 高 | 低 | 主流 |
| 容器 | 中 | 低 | 依赖多 |

## 完整 Demo：手工装配

### 场景描述

按配置选择内存仓储或文件仓储。服务只依赖接口。

### 完整代码

```python
"""依赖注入：手工装配与测试替换。"""

from typing import Protocol


class Repo(Protocol):
    def save(self, name: str) -> None: ...


class MemoryRepo:
    def __init__(self) -> None:
        self.items: list[str] = []

    def save(self, name: str) -> None:
        self.items.append(name)


class UserService:
    def __init__(self, repo: Repo) -> None:
        self.repo = repo

    def register(self, name: str) -> str:
        text = name.strip()
        if not text:
            raise ValueError("名字不能为空")
        self.repo.save(text)
        return text


def build_app(use_memory: bool = True) -> UserService:
    repo = MemoryRepo() if use_memory else MemoryRepo()
    return UserService(repo)


if __name__ == "__main__":
    service = build_app()
    print(service.register("ada"))
    print("存储条数:", len(service.repo.items))
    try:
        service.register("")
    except ValueError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出注册结果与一条错误。测试时传入自定义仓储即可。

### 常见误区

- 服务内部直接创建仓储。测试与替换都变难。
- 用容器解析一切。依赖关系看不出来。

### 面试追问链

<details>
<summary>依赖注入解决什么问题？</summary>

把依赖关系显式化。便于替换与测试。
</details>

<details>
<summary>容器什么时候值得？</summary>

依赖层级深且数量多时。小项目手工装配更清楚。
</details>

<details>
<summary>注入的依赖要不要接口？</summary>

跨层依赖用接口。同层小工具可以直接传函数。
</details>

### 下一讲衔接

下一讲 [领域建模](/backend/learn/architecture/domain-modeling) 讲业务模型。

### 关联组件

暂无。装配在组件入口完成。
