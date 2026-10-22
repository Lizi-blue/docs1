---
title: "分层与依赖方向"
type: knowledge
domain: backend
knowledge_domain: architecture
order: 5
level: advanced
tags: [layering, dependency-inversion, boundaries]
description: "边界怎么划，依赖为什么只能朝一个方向"
prerequisites:
  - /backend/learn/architecture/behavioral-patterns
related_knowledge:
  - /backend/learn/architecture/dependency-injection
---

### 本讲要解决的问题

代码一多就没边界。改一处牵动全仓。
依赖方向错了以后，测试与替换都变难。

### 本讲要解决的问题

- 分层的职责划分。
- 依赖方向为什么单向。
- 依赖倒置怎么落地。

## TL;DR

接口层只做协议转换与编排。应用层编排用例。
领域层放业务规则。基础设施层放外部依赖。
依赖只能指向内层。跨层调用靠接口。

## 概念定义

**接口层**：处理请求与响应。不写业务规则。

**应用层**：组织用例。协调领域与外部。

**领域层**：业务规则与模型。不依赖具体技术。

**基础设施层**：数据库、缓存与外部服务。

**依赖倒置**：内层定义接口，外层实现它。

## 原理图解

下图回答一个问题：四层的依赖方向与越界写法。

<DiagramFrame src="/diagrams/layering-dependencies.html" title="分层与依赖方向：只允许指向内层（Archify 交互图）" :height="560" />

```text
接口层 ──▶ 应用层 ──▶ 领域层
   │            │
   └──▶ 基础设施 ◀──┘（实现内层定义的接口）
```

## 关键对比

| 层 | 可以做 | 不该做 |
|---|---|---|
| 接口层 | 参数检查、协议转换 | 业务判断 |
| 应用层 | 用例编排、事务边界 | 直接拼 SQL |
| 领域层 | 规则与模型 | 依赖框架与数据库 |
| 基础设施 | 外部调用与持久化 | 承载业务规则 |

| 依赖方向 | 结果 | 测试难度 |
|---|---|---|
| 只指向内层 | 可替换 | 低 |
| 双向依赖 | 牵一发动全身 | 高 |
| 领域依赖基础设施 | 无法单独测试 | 很高 |

### 官方依据与版本差异

- [PEP 20 禅](https://peps.python.org/pep-0020/) — PEP 20 强调显式与简单。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 约束模块与命名。
- [abc 文档](https://docs.python.org/3/library/abc.html) — 3.12 起抽象基类可用于定义内层接口。

## API 手册：边界手段

### 定义接口

<ApiTable :items='[{"name":"Protocol","rank":"必会","signature":"class Repo(Protocol)","params":[],"returns":"协议类型","effect":"内层定义契约","scenario":"领域层声明所需能力","example":"from typing import Protocol\n\nclass Repo(Protocol):\n    def save(self, item) -> None: ...","exampleLang":"python","pitfall":"协议不要暴露具体技术细节。","raises":"无"},{"name":"注入实现","rank":"必会","signature":"Service(repo)","params":[{"name":"repo","type":"Repo","default":"必填","desc":"实现对象"}],"returns":"服务实例","effect":"运行期决定实现","scenario":"测试替换与多实现","example":"class Service:\n    def __init__(self, repo):\n        self.repo = repo","exampleLang":"python","pitfall":"不要在服务内部自己 new 实现，否则依赖被隐藏。","raises":"无"}]' />

### 检查边界

<ApiTable :items='[{"name":"导入检查","rank":"常用","signature":"grep 领域层导入","params":[],"returns":"越界清单","effect":"发现反向依赖","scenario":"代码评审与门禁","example":"grep -rn \"import infra\" app/domain","exampleLang":"bash","pitfall":"只在人工评审时看会漏。做成脚本检查。","raises":"无"}]' />

## 组合用法：用例编排

### 组合了哪些知识？

组合了三件事：接口转换、用例编排与仓储调用。

### 数据流图解

```text
请求 ──▶ 接口层（检查）──▶ 应用层（编排）──▶ 领域层（规则）──▶ 仓储接口 ──▶ 数据库
```

### 分步实现

1. 接口层只做协议与检查。
2. 应用层开事务边界。
3. 领域层只处理规则。
4. 仓储接口定义在领域层，实现放基础设施。

### 对比表格

| 边界写法 | 单测成本 | 替换存储 | 适用 |
|---|---|---|---|
| 无分层 | 高 | 难 | 脚本 |
| 分层但反向依赖 | 高 | 难 | 过渡 |
| 分层加倒置 | 低 | 易 | 长期项目 |

## 完整 Demo：依赖倒置

### 场景描述

领域服务只依赖仓储接口。测试时用内存实现替换数据库。

### 完整代码

```python
"""分层与依赖倒置：领域只依赖接口。"""

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
        if not name.strip():
            raise ValueError("名字不能为空")
        self.repo.save(name.strip())
        return name.strip()


if __name__ == "__main__":
    repo = MemoryRepo()
    service = UserService(repo)
    print(service.register(" ada "))
    print("存储条数:", len(repo.items))
    try:
        service.register("  ")
    except ValueError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出注册结果与一条错误。换掉 `MemoryRepo` 不需要改服务代码。

### 常见误区

- 接口层写业务分支。改规则要动两处。
- 领域层直接导入数据库驱动。领域无法单独测试。

### 面试追问链

<details>
<summary>为什么要单向依赖？</summary>

内层不依赖技术细节，才能被复用与替换。
</details>

<details>
<summary>依赖倒置与依赖注入什么关系？</summary>

倒置是原则。注入是落地手段之一。
</details>

<details>
<summary>小项目也要分层吗？</summary>

至少分接口与业务。层数随规模增加。
</details>

### 下一讲衔接

下一讲 [依赖注入](/backend/learn/architecture/dependency-injection) 讲装配。

### 关联组件

暂无。分层决定组件目录结构。
