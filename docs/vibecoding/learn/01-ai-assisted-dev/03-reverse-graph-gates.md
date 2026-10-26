---
title: "逆向图可信度与 CI 门禁"
type: knowledge
domain: vibecoding
knowledge_domain: ai-assisted-dev
order: 3
level: advanced
tags: [static-analysis, call-graph, architecture-drift, ci-gate]
description: "import 图可硬门禁，调用图只能提示，协作图静态分析拿不到"
prerequisites:
  - /vibecoding/learn/ai-assisted-dev/test-types-and-uit
related_knowledge:
  - /vibecoding/learn/ai-assisted-dev/layered-naming
---

### 本讲要解决的问题

只靠程序脚本从 Python 代码反向出图，能不能信。
哪些图能进 CI 做硬门禁。
「图与图一致」和「代码与规则一致」，哪个更可靠。

### 本讲要解决的问题

- 三类逆向图的可信度差异。
- 动态特性带来的失真与工具处置方式。
- 硬门禁的边界与判据。

## TL;DR

import 依赖图由语法树直接得出，可信，适合硬门禁。
函数调用图是静态近似，会漏边与误边，只适合做辅助信号。
对象协作图依赖运行期语义，静态分析拿不到，不能当门禁。
CI 应检查「代码是否符合声明的分层规则」，不要检查「两张图画得像不像」。

## 概念定义

**逆向图**：从源码静态分析得出的结构图。

**调用边**：一次可能的函数调用。静态分析给出的是可能集合。

**歧义标记**：无法静态确定的位置。工具应显式标出而不是猜。

**架构漂移**：代码的实际依赖与声明规则不一致。

**硬门禁**：不通过就阻断合并的检查。

## 原理图解

下图回答一个问题：哪类逆向产物能进硬门禁。

<DiagramFrame src="/diagrams/vibecoding-reverse-gates.html" title="逆向产物与门禁层级：硬门禁与辅助信号的分界（Archify 交互图）" :height="560" />

```text
源码 ──▶ import 图（语法树）──▶ 分层规则比对 ──▶ 硬门禁
   │
   ├──▶ 调用图（类型推断）──▶ 差异报告 ──▶ 辅助信号
   │
   └──▶ 协作图（运行期语义）──▶ 歧义清单 ──▶ 人工裁决
```

## 关键对比

三类图的可信度。

| 图类型 | 信息来源 | 可信度 | 主要失真 |
|---|---|---|---|
| import 依赖图 | 语法树的 import 节点 | 高 | 动态导入会漏边 |
| 函数调用图 | 名称解析与类型推断 | 中低 | 动态分派漏边、同名方法误边 |
| 对象协作图 | 运行期对象与消息 | 低（静态不可得） | 静态分析根本拿不到 |

Python 动态特性的影响与工具处置。

| 特性 | 对图的影响 | 常见处置 |
|---|---|---|
| `importlib` 动态导入 | 漏边 | 标记歧义或白名单 |
| `getattr` 取方法 | 漏边 | 标记歧义 |
| 装饰器改变函数身份 | 边指向包装层 | 保守连到原函数 |
| 猴子补丁 | 运行期替换 | 跳过并标记 |
| 多态分派 | 漏边或误边 | 连到基类并标注可能集合 |
| 元类与 `__getattr__` | 完全不可解析 | 标记 ambiguous |

工具的能力与边界。

| 工具 | 能做什么 | 边界 |
|---|---|---|
| import-linter v2.15 | 检查分层、禁止依赖与互不依赖 | 只查 import，不看调用顺序 |
| grimp v3.18 | 构建可查询的 import 图 | 需要自己写断言 |
| pydeps v3.0.9 | 画出模块依赖图 | 可视化工具，不做门禁 |
| PyCG v0.0.8 | 近似函数调用图 | 研究性质，动态特性覆盖有限 |
| code2flow v2.5.1 | 生成调用流程 DOT 图 | 明确只做静态近似 |

用户提到的 architecture-drift-guard 与 PyVisualizer：公开仓库能检索到同名小项目，但不是被广泛采用的主流工具。
引用前要核实维护状态与许可证，不要把它们写进硬门禁依赖。

### 官方依据与版本差异

- [ast 文档](https://docs.python.org/3/library/ast.html) — 3.12 起语法树接口稳定，是 import 图的基础。
- [importlib 文档](https://docs.python.org/3/library/importlib.html) — 3.12 起动态导入接口稳定，也是漏边的来源。
- [typing 文档](https://docs.python.org/3/library/typing.html) — 3.12 起类型注解可辅助推断，但不保证完整。

## API 手册：依赖图与规则

### 依赖图与规则

<ApiTable :items='[{"name":"layers 契约","rank":"必会","signature":"layers = [\"app.api\", \"app.domain\", \"app.infra\"]","params":[{"name":"layers","type":"list","default":"必填","desc":"从高到低的包"}],"returns":"分层规则","effect":"把架构声明变成可判定检查","scenario":"CI 硬门禁","example":"lint-imports --config pyproject.toml","exampleLang":"bash","pitfall":"只声明不解释。规则要与架构图同步维护。","raises":"退出码 1，存在违规依赖时"},{"name":"grimp 查询","rank":"常用","signature":"graph.find_illegal_dependencies_for_layers(layers)","params":[{"name":"layers","type":"list","default":"必填","desc":"分层定义"}],"returns":"违规依赖列表","effect":"用代码判断依赖合法性","scenario":"自定义门禁脚本","example":"import grimp\n\ngraph = grimp.build_graph(\"app\")\nprint(graph.find_illegal_dependencies_for_layers(layers=[\"api\", \"domain\"]))","exampleLang":"python","pitfall":"查询结果是依赖集合，需要自己决定严重级别。","raises":"ValueError，分层定义不合法时"}]' />

### 歧义标记

<ApiTable :items='[{"name":"歧义扫描","rank":"必会","signature":"scan(path) -> list[str]","params":[{"name":"path","type":"Path","default":"必填","desc":"源码路径"}],"returns":"歧义位置清单","effect":"把不可静态确定的位置标出来","scenario":"逆向图生成前后","example":"for hit in scan(Path(\"app\")):\n    print(\"歧义:\", hit)","exampleLang":"python","pitfall":"歧义不标记就会被当成确定边，门禁结论不可信。","raises":"无"}]' />

## 组合用法：规则硬门禁加歧义清单

### 组合了哪些知识？

组合了三件事：import 图、分层规则与歧义标记。

### 数据流图解

```text
源码 ──▶ import 图 ──▶ 分层规则 ──▶ 硬门禁结论
   └──▶ 歧义扫描 ──▶ 歧义清单 ──▶ 人工裁决
```

### 分步实现

1. 用语法树抽 import 边。这是确定信息。
2. 跑分层与禁止契约。违规即阻断。
3. 扫动态特性。把位置标成歧义。
4. 歧义清单进评审。不阻断，但要有人看。

### 对比表格

| 门禁对象 | 可判定性 | 噪声 | 建议 |
|---|---|---|---|
| 代码与声明规则 | 高 | 低 | 硬门禁 |
| 两张图结构一致 | 低 | 高 | 只做漂移提示 |
| 运行期行为 | 极低 | 高 | 不放 CI |

## 完整 Demo：import 图规则检查加歧义标记

### 场景描述

扫一批文件，检查领域层有没有依赖基础设施，同时标出 getattr 与动态导入的位置。

### 完整代码

```python
"""逆向图门禁：import 规则检查加歧义标记。"""

import ast
from pathlib import Path

LAYERS = ["app.api", "app.application", "app.domain", "app.infra"]
DYNAMIC_CALLS = {"getattr", "setattr", "eval", "exec"}


def scan(path: Path) -> list[str]:
    hits: list[str] = []
    tree = ast.parse(path.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in DYNAMIC_CALLS:
                hits.append(f"{path.name}:{node.lineno} 调用 {node.func.id}")
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr == "import_module":
                hits.append(f"{path.name}:{node.lineno} 动态导入")
    return hits


def layer_of(name: str) -> str | None:
    for layer in LAYERS:
        if name.startswith(layer):
            return layer
    return None


def check(root: Path) -> tuple[list[str], list[str]]:
    problems: list[str] = []
    ambiguous: list[str] = []
    order = {name: index for index, name in enumerate(LAYERS)}
    for path in root.rglob("*.py"):
        module = ".".join(path.relative_to(root).with_suffix("").parts)
        current = layer_of(module)
        ambiguous.extend(scan(path))
        if current is None:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            targets = []
            if isinstance(node, ast.ImportFrom) and node.module:
                targets.append(node.module)
            elif isinstance(node, ast.Import):
                targets.extend(alias.name for alias in node.names)
            for target in targets:
                other = layer_of(target)
                if other and order[other] > order[current]:
                    problems.append(f"{module} 依赖 {other}")
    return problems, ambiguous


if __name__ == "__main__":
    base = Path("sample")
    (base / "app/domain").mkdir(parents=True, exist_ok=True)
    (base / "app/infra").mkdir(parents=True, exist_ok=True)
    (base / "app/domain/order.py").write_text(
        "import importlib\nfrom app.infra.db import save\n\ndef pick(name):\n    return getattr(object(), name)\n",
        encoding="utf-8",
    )
    problems, ambiguous = check(base)
    print("硬门禁问题:", problems)
    print("歧义标记:", ambiguous)
```

### 运行方式

```bash
python3 demo.py
```

输出一条分层违规与三条歧义标记（动态导入、getattr 各一处）。违规阻断合并，歧义进评审。

### 常见误区

- 把调用图差异设成阻断。噪声会让团队绕过门禁。
- 歧义不标记。静态分析漏掉的边被当成「不存在」。
- 用图与图的结构相似度当质量指标。表示差异会淹没真实问题。

### 面试追问链

<details>
<summary>为什么 import 图比调用图可信？</summary>

import 是语法事实。调用关系要靠名称解析与类型推断，动态特性会破坏推断。
</details>

<details>
<summary>对象协作图为什么不能静态得到？</summary>

它描述运行期对象与消息。同一个类可能实例化出不同协作关系。
</details>

<details>
<summary>硬门禁为什么不校图与图一致？</summary>

两张图的粒度、命名与顺序本来就可能不同。规则判定更稳定也更好解释。
</details>

<details>
<summary>动态语言的架构门禁就此无解了吗？</summary>

不是。把范围收缩到 import 层与显式声明，仍能拿到高置信结论。
</details>

### 下一讲衔接

三讲到此结束。回到 [方向首页](/vibecoding/) 看总体判断与下一步。

### 关联组件

暂无。门禁脚本可复用到任何 Python 服务。
