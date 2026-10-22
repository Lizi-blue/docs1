---
title: "模式选型"
type: knowledge
domain: backend
knowledge_domain: architecture
order: 1
level: advanced
tags: [design-patterns, pythonic, tradeoff]
description: "先看变化方向，再决定要不要引入模式"
prerequisites: []
related_knowledge:
  - /backend/learn/architecture/creational-patterns
---

### 本讲要解决的问题

设计模式在 Python 里要不要照搬。
什么时候引入模式，什么时候直接写。
引入之后的代价是什么。

### 本讲要解决的问题

- 模式的适用前提。
- Python 惯用写法替代了哪些模式。
- 过度的信号有哪些。

## TL;DR

先看变化方向。哪里会变，就在哪里留口子。
Python 的一等函数与模块已经替代了部分模式。
引入模式的前提是可读性提升，不是形式完整。

## 概念定义

**模式**：反复出现的问题与验证过的解法结构。

**变化方向**：需求中最容易改变的那一维。

**惯用写法**：语言特性直接达成的简化结构。

**过度设计**：为未发生的变化提前加抽象。

## 原理图解

下图回答一个问题：本讲在架构与领域设计里的位置。

<DiagramFrame src="/diagrams/architecture-map.html" title="架构与领域设计地图：模式语言与边界契约（Archify 交互图）" :height="560" />

```text
需求变化点 ──▶ 是否需要留口子
                ├── 否 ──▶ 直接实现
                └── 是 ──▶ 用最小结构隔离
```

## 关键对比

| 模式 | Python 惯用替代 | 何时仍需要 |
|---|---|---|
| 策略 | 传函数 | 策略带状态或需注册 |
| 工厂 | 直接调用类 | 创建逻辑复杂或需按名取 |
| 单例 | 模块级对象 | 需要延迟初始化与测试替换 |
| 适配器 | 鸭子类型 | 第三方接口形状差异大 |

| 信号 | 说明 | 建议 |
|---|---|---|
| 只有一个实现 | 抽象无收益 | 去掉接口 |
| 三层转发 | 没有实际逻辑 | 合并 |
| 名字比行为多 | 形式大于内容 | 回归简单写法 |

### 官方依据与版本差异

- [PEP 20 禅](https://peps.python.org/pep-0020/) — PEP 20 强调简单优于复杂。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 约束命名与结构风格。
- [functools 文档](https://docs.python.org/3/library/functools.html) — 3.12 起 `partial` 与 `singledispatch` 稳定。

## API 手册：最小结构工具

### 用函数替代策略

<ApiTable :items='[{"name":"functools.partial","rank":"必会","signature":"partial(fn, *args)","params":[{"name":"fn","type":"callable","default":"必填","desc":"目标函数"},{"name":"args","type":"tuple","default":"()","desc":"预置参数"}],"returns":"可调用对象","effect":"固定部分参数","scenario":"策略只有参数差异","example":"from functools import partial\n\nparse = partial(int, base=2)","exampleLang":"python","pitfall":"预置位置参数不能被调用方覆盖。","raises":"TypeError，参数不匹配时"},{"name":"functools.singledispatch","rank":"常用","signature":"singledispatch(func)","params":[{"name":"func","type":"callable","default":"必填","desc":"默认实现"}],"returns":"可注册的函数","effect":"按第一个参数类型分派","scenario":"行为随类型变化","example":"from functools import singledispatch\n\n@singledispatch\ndef render(value):\n    return str(value)","exampleLang":"python","pitfall":"只按第一个参数类型分派，其余参数不参与。","raises":"无"}]' />

### 用模块替代单例

<ApiTable :items='[{"name":"模块级对象","rank":"必会","signature":"settings = Settings()","params":[],"returns":"模块内唯一实例","effect":"天然单例","scenario":"配置与注册表","example":"# config.py\nsettings = load_settings()","exampleLang":"python","pitfall":"全局状态难替换，测试时用依赖注入覆盖。","raises":"无"}]' />

## 组合用法：先简单后抽象

### 组合了哪些知识？

组合了三件事：变化点识别、最小结构、可读性检查。

### 数据流图解

```text
列出变化点 ──▶ 评估发生概率 ──▶ 选最小结构 ──▶ 用真实需求验证
```

### 分步实现

1. 列出可能变化点。写清触发条件。
2. 评估是否需要现在处理。未发生就记下。
3. 选最小结构。函数优先，其次类。
4. 用真实需求验证。不可读就回退。

### 对比表格

| 方案 | 代码量 | 可读性 | 扩展成本 |
|---|---|---|---|
| 直接实现 | 最少 | 好 | 改动集中 |
| 函数参数 | 少 | 好 | 低 |
| 接口与实现 | 多 | 中 | 中 |

## 完整 Demo：从 if 分支到分派

### 场景描述

同一函数按输入类型走不同处理。先写分支，再用 `singledispatch` 收敛。

### 完整代码

```python
"""模式选型：分支与分派的取舍。"""

from functools import singledispatch


@singledispatch
def render(value):
    return f"其他:{value}"


@render.register
def _(value: int):
    return f"整数:{value}"


@render.register
def _(value: str):
    return f"字符串:{value}"


if __name__ == "__main__":
    print(render(1))
    print(render("a"))
    print(render([1]))
```

### 运行方式

```bash
python3 demo.py
```

输出三种分派结果。新增类型只需注册函数，不必改主逻辑。

### 常见误区

- 为每个类都先写接口。没有第二个实现时只是负担。
- 用模式名当注释。读者需要的是行为说明。

### 面试追问链

<details>
<summary>怎么判断该不该引入模式？</summary>

看变化是否已经发生或明确将至，以及抽象是否让调用方更简单。
</details>

<details>
<summary>Python 为什么少用单例模式？</summary>

模块本身就是单例，不需要额外结构。
</details>

<details>
<summary>过度设计的典型信号？</summary>

接口只有一实现，且删除后代码更短。
</details>

### 下一讲衔接

下一讲 [创建型模式](/backend/learn/architecture/creational-patterns) 讲对象创建怎么组织。

### 关联组件

暂无。选型原则用于组件边界划分。
