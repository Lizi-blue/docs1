---
title: "模块与导入机制"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 10
level: advanced
tags: [import, module, package, sys.path, importlib]
description: "导入怎么找、怎么缓存、为什么会循环导入"
prerequisites:
  - /backend/learn/language-core/exceptions
related_knowledge:
  - /backend/learn/language-core/data-model
---

### 本讲要解决的问题

`import` 到底查了哪些位置。
模块只加载一次是谁保证的。
循环导入为什么有时能跑、有时报错。

- 导入的查找顺序。
- 缓存与重复导入。
- 循环导入的成因与修法。

## TL;DR

导入先查缓存，再按 `sys.path` 顺序找。
找到后执行模块体，把结果放进 `sys.modules`。之后直接用缓存。
循环导入报错，是因为模块体执行到一半被再次导入。

## 概念定义

**模块**：一个 `.py` 文件或扩展模块。

**包**：带 `__init__.py` 的目录。命名空间包可以没有该文件。

**查找路径**：`sys.path` 里的目录，按顺序尝试。

**导入缓存**：`sys.modules`。同名模块只执行一次。

**循环导入**：两个模块在顶层互相导入。执行到一半取不到名字。

## 原理图解

下图回答一个问题：本讲在语言核心机制里的位置与依赖。

<DiagramFrame src="/diagrams/language-core-map.html" title="语言核心机制地图：协议与工程五讲（Archify 交互图）" :height="560" />

```text
import a ──▶ 查 sys.modules ──▶ 命中则直接用
                        └── 未命中 ──▶ 按 sys.path 找文件 ──▶ 执行模块体 ──▶ 写入缓存
循环导入：a 导入 b ──▶ b 导入 a（未完成）──▶ 取不到名字
```

## 关键对比

| 写法 | 执行时机 | 风险 |
|---|---|---|
| 顶层导入 | 模块加载时 | 循环导入直接失败 |
| 函数内导入 | 调用时 | 延迟报错，可能掩盖问题 |
| 类型检查专用导入 | 仅检查时 | 执行时不加载 |

| 场景 | 建议 | 理由 |
|---|---|---|
| 双向依赖 | 抽公共模块 | 从根上解除环 |
| 仅类型引用 | `TYPE_CHECKING` 下导入 | 执行期不需要 |
| 插件加载 | `importlib.import_module` | 名字在执行时决定 |

### 官方依据与版本差异

- [import 系统](https://docs.python.org/3/reference/import.html) — 3.12 起查找规则未变。
- [PEP 328](https://peps.python.org/pep-0328/) — 2.5 起支持显式相对导入。
- [importlib 文档](https://docs.python.org/3/library/importlib.html) — 3.12 起 `import_module` 接口稳定。

## API 手册：导入控制

### 查找与加载

<ApiTable :items='[{"name":"importlib.import_module","rank":"必会","signature":"import_module(name, package=None)","params":[{"name":"name","type":"str","default":"必填","desc":"模块名"},{"name":"package","type":"str","default":"None","desc":"相对导入的基准包"}],"returns":"模块对象","effect":"按名字动态导入","scenario":"插件与配置驱动的加载","example":"import importlib\n\nmodule = importlib.import_module(\"json\")","exampleLang":"python","pitfall":"名字拼错会抛 ModuleNotFoundError，别用裸 except 吞掉。","raises":"ModuleNotFoundError，找不到模块时"},{"name":"importlib.reload","rank":"常用","signature":"reload(module)","params":[{"name":"module","type":"module","default":"必填","desc":"已导入模块"}],"returns":"同一个模块对象","effect":"重新执行模块体","scenario":"开发期热更新","example":"import importlib\nimport json\n\nimportlib.reload(json)","exampleLang":"python","pitfall":"已持有旧模块引用的对象不会自动更新。","raises":"ImportError，重新加载失败时"}]' />

### 模块属性

<ApiTable :items='[{"name":"__name__","rank":"必会","signature":"__name__","params":[],"returns":"模块名或 __main__","effect":"判断入口与库","scenario":"脚本入口判断","example":"if __name__ == \"__main__\":\n    main()","exampleLang":"python","pitfall":"被导入时值是模块名，不是 __main__。","raises":"无"},{"name":"__all__","rank":"常用","signature":"__all__ = [\"a\", \"b\"]","params":[],"returns":"导出名单","effect":"限制星号导入的范围","scenario":"包对外接口","example":"__all__ = [\"Client\"]","exampleLang":"python","pitfall":"它不影响显式导入，只影响 from x import *。","raises":"无"}]' />

## 组合用法：避免循环导入

### 组合了哪些知识？

组合了三件事：模块分层、延迟导入与公共模块抽取。

### 数据流图解

```text
a ──▶ 需要 b 的功能
b ──▶ 需要 a 的功能
修法一：抽出 c 给两者用
修法二：把导入挪进函数
```

### 分步实现

1. 先看依赖方向。画出谁依赖谁。
2. 有环就抽公共模块。把共用部分下沉。
3. 只为类型引用时放进 `TYPE_CHECKING`。
4. 实在无法解耦，把导入挪进函数。

### 对比表格

| 修法 | 改动量 | 是否根治 | 适用 |
|---|---|---|---|
| 抽公共模块 | 中 | 是 | 双向依赖 |
| 延迟导入 | 小 | 否 | 临时方案 |
| 改为参数注入 | 大 | 是 | 架构调整 |

## 完整 Demo：延迟导入解环

### 场景描述

两个模块互相引用对方的一个函数。用函数内导入打破顶层环。

### 完整代码

```python
"""循环导入：顶层互引与延迟导入。"""

import importlib
import sys
import types


def build_modules():
    left = types.ModuleType("left")
    right = types.ModuleType("right")

    def left_value():
        return "left"

    def right_value():
        from_left = importlib.import_module("left")
        return f"right+{from_left.left_value()}"

    left.left_value = left_value
    right.right_value = right_value
    sys.modules["left"] = left
    sys.modules["right"] = right
    return left, right


if __name__ == "__main__":
    left, right = build_modules()
    print(right.right_value())
    print("缓存命中:", sys.modules["left"] is left)
```

### 运行方式

```bash
python3 demo.py
```

输出拼接结果与缓存判断。把函数内导入挪到顶层，会得到导入失败。

### 常见误区

- 用 `sys.path` 追加临时目录解决找不到包。会让部署行为不可预测。
- 顶层互相导入后再把导入挪进函数。仍然脆弱。

### 面试追问链

<details>
<summary>为什么模块只执行一次？</summary>

`sys.modules` 缓存了结果。再次导入直接返回缓存对象。
</details>

<details>
<summary>命名空间包与普通包的区别？</summary>

命名空间包没有 `__init__.py`，可跨目录合并同名包。
</details>

<details>
<summary>__init__.py 该放什么？</summary>

导出接口与少量初始化。不要放重逻辑，避免导入即执行。
</details>

### 下一讲衔接

下一知识域 [类型系统与类型检查](/backend/learn/type-system/typing-basics) 讲注解。它建立在这一域的对象模型之上。

### 关联组件

暂无。导入机制决定组件文件的组织方式。
