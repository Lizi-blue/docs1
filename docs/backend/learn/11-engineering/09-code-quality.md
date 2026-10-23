---
title: "代码质量门禁"
type: knowledge
domain: backend
knowledge_domain: engineering
order: 9
level: advanced
tags: [lint, formatting, review]
description: "lint、格式与评审门禁：把标准变成机器可查的规则"
prerequisites:
  - /backend/learn/engineering/packaging
related_knowledge:
  - /backend/learn/engineering/deploy-container
---

### 本讲要解决的问题

代码风格靠口头约定。
评审时间花在格式上，真正问题没人看。

- 门禁该覆盖什么。
- 怎么让门禁不碍事。
- 存量问题怎么过渡。

## TL;DR

格式交给工具自动处理。lint 只拦真问题。
门禁在提交与流水线两层，先快后全。
存量先加基线，只要求不新增。

## 概念定义

**格式化**：统一风格。自动改写。

**静态检查**：发现未使用变量、可疑分支等。

**基线**：记录存量问题数量。

**门禁**：不达标就阻断合入。

## 原理图解

下图回答一个问题：质量门禁在交付链路里的位置。

<DiagramFrame src="/diagrams/delivery-pipeline.html" title="一次可回滚的发布：门禁在构建阶段（Archify 交互图）" :height="560" />

```text
提交 ──▶ 格式化 ──▶ 静态检查 ──▶ 测试 ──▶ 评审 ──▶ 合并
```

## 关键对比

| 检查项 | 自动修复 | 阻断合入 |
|---|---|---|
| 格式 | 是 | 否 |
| 未使用变量 | 部分 | 是 |
| 类型检查 | 否 | 是 |

| 门禁位置 | 反馈速度 | 覆盖 |
|---|---|---|
| 提交钩子 | 快 | 单文件 |
| 流水线 | 慢 | 全仓 |

### 官方依据与版本差异

- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 是风格基线。
- [PEP 257](https://peps.python.org/pep-0257/) — PEP 257 规定文档字符串约定。
- [ast 文档](https://docs.python.org/3/library/ast.html) — 3.12 起语法树接口稳定，可用于自定义检查。

## API 手册：检查手段

### 格式与静态检查

<ApiTable :items='[{"name":"格式化工具","rank":"必会","signature":"format --check src","params":[{"name":"src","type":"str","default":"必填","desc":"目标目录"}],"returns":"差异或退出码","effect":"统一风格","scenario":"提交前","example":"format --check src","exampleLang":"bash","pitfall":"让开发者手工对齐格式，纯浪费评审时间。","raises":"退出码 1，存在格式差异时"},{"name":"静态检查","rank":"必会","signature":"lint src","params":[{"name":"src","type":"str","default":"必填","desc":"目标目录"}],"returns":"问题清单","effect":"发现可疑代码","scenario":"流水线","example":"lint src","exampleLang":"bash","pitfall":"规则全开会淹没真问题。按价值分级。","raises":"退出码 1，存在问题项时"}]' />

### 自定义检查

<ApiTable :items='[{"name":"ast.parse","rank":"常用","signature":"ast.parse(source)","params":[{"name":"source","type":"str","default":"必填","desc":"源码文本"}],"returns":"语法树","effect":"按结构检查","scenario":"自定义规则","example":"import ast\n\ntree = ast.parse(\"x = 1\")","exampleLang":"python","pitfall":"按文本匹配容易误伤。优先用语法树。","raises":"SyntaxError，源码不合法时"}]' />

## 组合用法：两层门禁

### 组合了哪些知识？

组合了三件事：格式化、静态检查与基线。

### 数据流图解

```text
提交钩子（快）──▶ 流水线（全）──▶ 基线比对 ──▶ 合入
```

### 分步实现

1. 提交前自动格式化。不阻断。
2. 提交钩子跑轻量检查。只查单文件。
3. 流水线跑全量检查与测试。
4. 存量问题记基线，只要求不新增。

### 对比表格

| 方案 | 反馈速度 | 维护成本 |
|---|---|---|
| 只靠评审 | 慢 | 高 |
| 单层门禁 | 中 | 中 |
| 两层门禁 | 快 | 低 |

## 完整 Demo：语法树检查

### 场景描述

用语法树找出函数里未使用的参数名。

### 完整代码

```python
"""代码质量：用语法树做自定义检查。"""

import ast

SOURCE = "def add(a, b):\n    return a\n"


def unused_params(source: str) -> list[str]:
    tree = ast.parse(source)
    unused = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef):
            continue
        used = {item.id for item in ast.walk(node) if isinstance(item, ast.Name)}
        for arg in node.args.args:
            if arg.arg not in used:
                unused.append(f"{node.name}.{arg.arg}")
    return unused


if __name__ == "__main__":
    print("未使用参数:", unused_params(SOURCE))
    try:
        ast.parse("def broken(:\n")
    except SyntaxError as error:
        print("语法错误:", error.msg)

```

### 运行方式

```bash
python3 demo.py
```

输出未使用参数与一条语法错误。规则用语法树写，不依赖文本匹配。

### 常见误区

- 把所有 lint 规则设成阻断。团队会绕过门禁。
- 只格式化不检查。逻辑问题仍然漏。

### 面试追问链

<details>
<summary>格式与 lint 为什么要分开？</summary>

格式可自动修。lint 需要人判断。
</details>

<details>
<summary>存量问题怎么过渡？</summary>

记基线并只要求不新增。逐步下降。
</details>

<details>
<summary>门禁该放在哪一层？</summary>

提交钩子做快检查，流水线做全量。
</details>

### 下一讲衔接

下一讲 [容器化发布](/backend/learn/engineering/deploy-container) 讲部署与回滚。

### 关联组件

暂无。组件页与源码遵守同一门禁。
