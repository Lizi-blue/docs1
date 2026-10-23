---
title: "mypy 与 pyright"
type: knowledge
domain: backend
knowledge_domain: type-system
order: 6
level: advanced
tags: [mypy, pyright, config, ci]
description: "两个检查器的差别、严格级别与接入方式"
prerequisites:
  - /backend/learn/type-system/typed-dict-dataclass
related_knowledge:
  - /backend/learn/type-system/runtime-typing
---

### 本讲要解决的问题

两个检查器差别在哪。
严格级别怎么逐级打开。
怎么接进流水线而不一次炸出几千条。

- 两个检查器的取舍。
- 严格级别的推进方式。
- 存量代码的接入口径。

## TL;DR

mypy 规则更严，报错更细，速度较慢。pyright 更快，编辑器体验好。
严格级别要分级打开，先报错少的模块。
接入流水线时先只检查新增文件，避免一次暴露全部存量问题。

## 概念定义

**静态检查器**：读注解做类型推断，不运行代码。

**严格级别**：一组开关。逐级打开会暴露更多问题。

**增量检查**：只检查改动过的文件。适合存量项目。

**存根文件**：为没有注解的库补类型信息。

**类型忽略**：用注解或配置跳过某处的检查。

## 原理图解

下图回答一个问题：注解到检查器再到门禁的链路。

<DiagramFrame src="/diagrams/type-system-checker-pipeline.html" title="注解如何走到检查器与 CI 门禁（Archify 交互图）" :height="560" />

```text
源码注解 ──▶ 检查器读取 ──▶ 类型推断 ──▶ 报错清单 ──▶ 流水线阻断
                          └── 配置严格级别
```

## 关键对比

| 维度 | mypy | pyright |
|---|---|---|
| 严格程度 | 更严 | 可调，默认较松 |
| 速度 | 较慢 | 更快 |
| 编辑器体验 | 一般 | 好 |
| 配置方式 | ini 或 toml | json |
| 生态 | 老牌 | 增长快 |

| 严格开关 | 作用 | 建议顺序 |
|---|---|---|
| 检查未注解函数体 | 覆盖更多代码 | 第三步 |
| 禁止隐式 Any | 拦住类型泄漏 | 第二步 |
| 严格可选 | 强制判空 | 第一步 |
| 检查装饰器 | 装饰器签名 | 第四步 |

### 官方依据与版本差异

- [mypy 文档](https://docs.python.org/3/library/typing.html) — 3.12 起类型语法放宽，mypy 同步支持。
- [PEP 561](https://peps.python.org/pep-0561/) — 3.7 起支持分发类型信息。
- [typing 规范](https://docs.python.org/3/library/typing.html) — 3.13 起 `ReadOnly` 等新特性加入。

## API 手册：检查器接入

### 配置与运行

<ApiTable :items='[{"name":"mypy 命令","rank":"必会","signature":"mypy <路径> --strict","params":[{"name":"路径","type":"str","default":"必填","desc":"要检查的目录或文件"},{"name":"--strict","type":"flag","default":"关闭","desc":"打开全部严格开关"}],"returns":"退出码与报错清单","effect":"静态检查","scenario":"本地与流水线","example":"mypy app --strict","exampleLang":"bash","pitfall":"一次性打开 --strict 会淹没在存量报错里。先分级打开。","raises":"退出码 1，存在类型检查时"},{"name":"pyright 命令","rank":"常用","signature":"pyright <路径>","params":[{"name":"路径","type":"str","default":"必填","desc":"要检查的目录"}],"returns":"报错清单","effect":"静态检查","scenario":"编辑器与流水线","example":"pyright app","exampleLang":"bash","pitfall":"默认模式较松，需要显式打开严格项。","raises":"退出码 1，存在类型检查时"}]' />

### 忽略与存根

<ApiTable :items='[{"name":"typing.TYPE_CHECKING","rank":"常用","signature":"if TYPE_CHECKING:","params":[],"returns":"布尔常量","effect":"只在检查时进入的分支","scenario":"避免循环导入与运行期开销","example":"from typing import TYPE_CHECKING\n\nif TYPE_CHECKING:\n    from app.models import User","exampleLang":"python","pitfall":"分支里的名字运行时不存在，别在运行期使用。","raises":"无"},{"name":"# type: ignore","rank":"常用","signature":"x = call()  # type: ignore[code]","params":[{"name":"code","type":"str","default":"可省","desc":"要忽略的检查码"}],"returns":"无","effect":"跳过某行的检查","scenario":"第三方库注解缺失","example":"value = legacy()  # type: ignore[no-any-return]","exampleLang":"python","pitfall":"尽量带检查码。裸 ignore 会掩盖新问题。","raises":"无"}]' />

## 组合用法：分级接入

### 组合了哪些知识？

组合了三件事：严格开关、增量检查与忽略清单。

### 数据流图解

```text
第一步 ──▶ 只检查新增文件 ──▶ 清零
第二步 ──▶ 打开严格可选 ──▶ 修完
第三步 ──▶ 打开隐式 Any 检查 ──▶ 修完
第四步 ──▶ 全量严格 ──▶ 纳入门禁
```

### 分步实现

1. 先配基础命中范围。只检查新增与改动文件。
2. 按分级表逐项打开。每开一项就修到清零。
3. 忽略必须带检查码。定期回看能否移除。
4. 全量严格后，把命令接进流水线。

### 对比表格

| 接入方式 | 存量代码影响 | 推进速度 | 适用 |
|---|---|---|---|
| 全量严格 | 大 | 慢 | 新项目 |
| 增量检查 | 小 | 快 | 存量项目 |
| 只检查关键模块 | 中 | 中 | 渐进改造 |

## 完整 Demo：最小检查配置

### 场景描述

用一个只检查新增目录的配置起步。先用严格可选开关。

### 完整代码

```python
"""配合 mypy 的最小示例：注解齐全即可通过严格可选项。"""

from typing import Optional


def find(names: list[str], key: str) -> Optional[int]:
    for index, name in enumerate(names):
        if name == key:
            return index
    return None


def first_name(names: list[str]) -> str:
    index = find(names, "ada")
    if index is None:
        raise ValueError("没有找到")
    return names[index]


if __name__ == "__main__":
    print(first_name(["ada", "bob"]))
```

### 运行方式

```bash
python3 demo.py
```

输出 0。再运行 `mypy demo.py --strict`，注解齐全时无报错。

### 常见误区

- 直接打开全部严格开关。一次暴露太多问题，推进不下去。
- 用裸 `# type: ignore`。掩盖了后续新增的检查。

### 面试追问链

<details>
<summary>为什么 pyright 默认更松？</summary>

它优先编辑器交互体验。严格项要显式打开。
</details>

<details>
<summary>存根文件解决什么问题？</summary>

为没有注解的库补类型信息，避免 `Any` 到处扩散。
</details>

<details>
<summary>增量检查怎么落地？</summary>

按改动文件取交集。流水线里只检查本次变更。
</details>

### 下一讲衔接

下一讲 [运行时类型信息](/backend/learn/type-system/runtime-typing) 讲注解在运行时怎么取。

### 关联组件

暂无。检查器是工程门禁的一部分。
