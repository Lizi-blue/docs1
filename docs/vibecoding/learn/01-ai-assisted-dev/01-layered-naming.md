---
title: "分层命名体系与 L1–L4 映射"
type: knowledge
domain: vibecoding
knowledge_domain: ai-assisted-dev
order: 1
level: advanced
tags: [layering, ddd, clean-architecture, c4, naming]
description: "自定义 L1–L4 对不上任何单一标准，但可以对齐到多套体系的职责轴"
prerequisites: []
related_knowledge:
  - /vibecoding/learn/ai-assisted-dev/test-types-and-uit
---

### 本讲要解决的问题

团队用 L1–L4 四个标签沟通分层。
这四个标签在业界有没有对应标准。
如果没有，怎么标注才能不产生歧义。

### 本讲要解决的问题

- 四套主流分层体系分别管什么。
- L1–L4 与它们逐层怎么对。
- 保留自定义标签时要补哪些标注。

## TL;DR

L1–L4 不对应任何单一业界标准。它是「抽象粒度」与「职责」两种轴的混合。
DDD 四层管职责，整洁架构管依赖方向，六边形管边界，C4 管抽象层次。
可以保留 L1–L4，但必须补两条标注：每条标签对应的职责层，以及它是不是实现粒度。

## 概念定义

**职责分层**：按「这段代码属于业务规则、编排、还是技术细节」切分。DDD 四层属于这一类。

**依赖方向**：规定谁可以依赖谁。整洁架构与六边形都在约束方向。

**抽象层次**：从系统到代码逐层放大。C4 的上下文、容器、组件、代码属于这一类。

**实现粒度**：函数与方法。它们不是「一层」，而是任何层里的最小单元。

## 原理图解

下图回答一个问题：你的四层标签与四套业界体系怎么对。

<DiagramFrame src="/diagrams/vibecoding-layer-mapping.html" title="自定义 L1–L4 与 DDD、整洁架构、六边形、C4 的映射（Archify 交互图）" :height="560" />

```text
职责轴（DDD）      编排 ──▶ 领域规则 ──▶ 技术细节
你的标签            L1 业务组合 ──▶ L3 领域对象 ──▶ L2 平台工具
实现粒度轴                         L4 函数与方法（贯穿各层）
抽象层次轴（C4）    系统 ──▶ 容器 ──▶ 组件 ──▶ 代码
```

## 关键对比

四套体系的层级与命名。

| 体系 | 层级命名 | 管什么 | 与 L1–L4 的关系 |
|---|---|---|---|
| DDD 四层 | 表现层、应用层、领域层、基础设施层 | 职责 | L1 对应用层，L3 对领域层，L2 多在基础设施 |
| 整洁架构 | 实体、用例、接口适配器、框架与驱动 | 依赖方向 | L1 对用例，L3 对实体，L2 跨适配器与驱动 |
| 六边形 | 内部（领域与应用）、外部（适配器） | 边界与端口 | L3 在内部，L2 多在外部的适配器 |
| C4 模型 | 上下文、容器、组件、代码 | 抽象层次 | L4 对代码层，L1–L3 都可能落在组件层 |

逐条映射与差异。

| 你的标签 | 能对上 | 对不上 | 建议标注 |
|---|---|---|---|
| L1 业务组合服务 | 应用层用例、整洁架构的用例 | 与表现层混在一起时无法区分 | L1（应用编排） |
| L2 平台工具服务 | 基础设施与适配器 | 还包含共享应用服务，跨了两套体系 | L2（平台能力，分基础设施与共享服务两类） |
| L3 领域类对象 | 领域层实体与值对象 | 领域服务常被误放进 L2 | L3（领域对象与领域服务） |
| L4 函数与方法 | C4 代码层 | 它不是「一层」，而是实现粒度 | L4（实现粒度，不属于分层） |

### 官方依据与版本差异

- [Python 模块与包](https://docs.python.org/3/tutorial/modules.html) — 3.12 起包与命名空间包规则未变，分层落地靠目录。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 约定小写模块名，分层目录名随之统一。
- [import-linter 仓库](https://github.com/seddonym/import-linter) — v2.15 提供 layers、forbidden 与 independence 三类契约。

## API 手册：分层声明与依赖规则

### 分层声明

<ApiTable :items='[{"name":"layers 契约","rank":"必会","signature":"[[tool.importlinter.contracts]] type = \"layers\"","params":[{"name":"layers","type":"list","default":"必填","desc":"从高到低的包名列表"},{"name":"containers","type":"list","default":"可选","desc":"分层包所在的父包"}],"returns":"契约定义","effect":"声明谁可以依赖谁","scenario":"把 L1–L4 落成机器可查的规则","example":"[[tool.importlinter.contracts]]\nname = \"分层\"\ntype = \"layers\"\nlayers = [\"app.api\", \"app.application\", \"app.domain\", \"app.infra\"]","exampleLang":"toml","pitfall":"层级顺序写反会让所有依赖都判违规。","raises":"无"},{"name":"forbidden 契约","rank":"必会","signature":"type = \"forbidden\"","params":[{"name":"source_modules","type":"list","default":"必填","desc":"来源包"},{"name":"forbidden_modules","type":"list","default":"必填","desc":"禁止依赖的包"}],"returns":"契约定义","effect":"禁止特定依赖","scenario":"领域层不得导入基础设施","example":"[[tool.importlinter.contracts]]\ntype = \"forbidden\"\nsource_modules = [\"app.domain\"]\nforbidden_modules = [\"app.infra\"]","exampleLang":"toml","pitfall":"只写规则不写理由，半年后没人敢改。","raises":"无"}]' />

### 依赖规则

<ApiTable :items='[{"name":"independence 契约","rank":"常用","signature":"type = \"independence\"","params":[{"name":"modules","type":"list","default":"必填","desc":"互不依赖的模块"}],"returns":"契约定义","effect":"约束同级模块互不依赖","scenario":"L2 平台能力之间解耦","example":"[[tool.importlinter.contracts]]\ntype = \"independence\"\nmodules = [\"app.platform.billing\", \"app.platform.notify\"]","exampleLang":"toml","pitfall":"平台能力常有共享工具，完全独立往往做不到。","raises":"无"}]' />

## 组合用法：把 L1–L4 落成目录与契约

### 组合了哪些知识？

组合了三件事：职责分层、依赖方向与机器可查的契约。

### 数据流图解

```text
L1–L4 标注 ──▶ 目录结构 ──▶ import-linter 契约 ──▶ CI 检查
                            └── 违反即报告
```

### 分步实现

1. 先写职责映射。每条标签标出对应的 DDD 层。
2. 再定目录。目录名用业务名，不用 L1 这种代号。
3. 写 layers 契约。顺序从高到低。
4. 为关键禁令补 forbidden 契约，并写理由。

### 对比表格

| 标注方式 | 沟通成本 | 工具友好 | 建议 |
|---|---|---|---|
| 只用 L1–L4 | 低 | 差，工具不认识 | 不推荐 |
| 只用 DDD 术语 | 中 | 好 | 推荐 |
| 双标签 L1（应用编排） | 低 | 好 | 推荐 |

## 完整 Demo：用语法树检查分层依赖

### 场景描述

不装第三方工具，用标准库语法树扫一遍 import，检查领域层有没有反向依赖基础设施。

### 完整代码

```python
"""分层依赖检查：用 ast 找反向依赖。"""

import ast
from pathlib import Path

LAYERS = ["app.api", "app.application", "app.domain", "app.infra"]


def module_name(path: Path, root: Path) -> str:
    parts = list(path.relative_to(root).with_suffix("").parts)
    return ".".join(parts)


def imports_of(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    found = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            found.add(node.module)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                found.add(alias.name)
    return found


def check(root: Path) -> list[str]:
    problems = []
    index = {name: i for i, name in enumerate(LAYERS)}
    for path in root.rglob("*.py"):
        current = module_name(path, root)
        layer = next((name for name in LAYERS if current.startswith(name)), None)
        if layer is None:
            continue
        for target in imports_of(path):
            other = next((name for name in LAYERS if target.startswith(name)), None)
            if other is None:
                continue
            if index[other] > index[layer]:
                problems.append(f"{current} 依赖了更下层的 {other}")
    return problems


if __name__ == "__main__":
    base = Path("sample")
    (base / "app/domain").mkdir(parents=True, exist_ok=True)
    (base / "app/infra").mkdir(parents=True, exist_ok=True)
    (base / "app/domain/order.py").write_text("from app.infra.db import save\n", encoding="utf-8")
    print(check(base))
```

### 运行方式

```bash
python3 demo.py
```

输出一条反向依赖。把 domain 里的 import 改成只导入自身，结果为空列表。

### 常见误区

- 把 L4 当成分层。它只是实现粒度，写进 layers 契约会失效。
- 契约顺序写反。所有依赖都会被判成违规。
- L2 既放适配器又放共享服务。两类东西依赖方向不同，混在一层会矛盾。

### 面试追问链

<details>
<summary>为什么业界没有统一的分层命名标准？</summary>

四套体系解决不同问题：职责、方向、边界与抽象层次。目标不同，命名自然不同。
</details>

<details>
<summary>L2 为什么最难对齐？</summary>

它把基础设施、适配器与共享应用服务混在一起。这三类的依赖方向不同。
</details>

<details>
<summary>保留 L1–L4 的最大风险是什么？</summary>

工具不认识这套标签。契约、导出与审查都得手工映射，容易漂移。
</details>

### 下一讲衔接

下一讲 [测试类型与 UIT](/vibecoding/learn/ai-assisted-dev/test-types-and-uit) 讲从图派生测试的能与不能。

### 关联组件

暂无。分层规则可直接用于任何后端组件。
