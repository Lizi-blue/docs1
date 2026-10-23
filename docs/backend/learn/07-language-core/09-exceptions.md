---
title: "异常层次与异常组"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 9
level: advanced
tags: [exceptions, exception-group, raise-from, error-design]
description: "异常怎么分层、怎么串联、怎么一次报多个"
prerequisites:
  - /backend/learn/language-core/iterators-generators
related_knowledge:
  - /backend/learn/language-core/modules-import
---

### 本讲要解决的问题

自定义异常该怎么分层。
`raise from` 与不写的差别。
同时出现多个异常时怎么报。

- 异常层次的划分原则。
- 链式传递的两种写法。
- 异常组的用法与边界。

## TL;DR

层次按调用方能否处理来分，不按模块分。
普通异常继承 `Exception`。`raise X from Y` 保留原因链。
3.11 起可用 `ExceptionGroup` 与 `except*` 一次处理多个异常。

## 概念定义

**异常层次**：按可处理性分组。例如参数异常、依赖异常、内部异常。

**链式传递**：把底层异常挂在当前异常上。保留排查路径。

**`raise from`**：显式设置原因。`__cause__` 指向它。

**隐式上下文**：在 `except` 里抛新异常时，`__context__` 自动记录原异常。

**异常组**：把多个异常装进一个。用 `except*` 分别处理。

## 原理图解

下图回答一个问题：本讲在语言核心机制里的位置与依赖。

<DiagramFrame src="/diagrams/language-core-map.html" title="语言核心机制地图：协议与工程五讲（Archify 交互图）" :height="560" />

```text
底层异常 ──▶ raise 新异常 from 底层 ──▶ __cause__ 链
异常组 ──▶ except* 分支 ──▶ 按类型分别处理 ──▶ 未处理的继续抛
```

## 关键对比

| 写法 | 原因链 | 排查价值 |
|---|---|---|
| `raise 新异常` | 隐式 `__context__` | 中 |
| `raise 新异常 from 底层` | 显式 `__cause__` | 高 |
| `raise 新异常 from None` | 切断链 | 低，慎用 |

| 层次 | 例子 | 调用方该做什么 |
|---|---|---|
| 参数异常 | 校验不通过 | 修正入参 |
| 依赖异常 | 下游不可用 | 重试或降级 |
| 内部异常 | 不变量被破坏 | 上报并修代码 |

### 官方依据与版本差异

- [异常处理](https://docs.python.org/3/tutorial/errors.html) — 3.12 起语义未变。
- [PEP 654](https://peps.python.org/pep-0654/) — 3.11 起提供 `ExceptionGroup` 与 `except*`。
- [内建异常](https://docs.python.org/3/library/exceptions.html) — 3.13 起异常层次未变。

## API 手册：异常组织

### 层次与分组

<ApiTable :items='[{"name":"Exception","rank":"必会","signature":"Exception(*args)","params":[{"name":"args","type":"tuple","default":"()","desc":"异常信息"}],"returns":"异常实例","effect":"作为自定义异常的基类","scenario":"业务异常","example":"class ConfigError(Exception):\n    pass","exampleLang":"python","pitfall":"不要继承 BaseException，它会绕过常规捕获。","raises":"无"},{"name":"ExceptionGroup","rank":"常用","signature":"ExceptionGroup(message, exceptions)","params":[{"name":"message","type":"str","default":"必填","desc":"分组说明"},{"name":"exceptions","type":"list","default":"必填","desc":"异常列表"}],"returns":"异常组","effect":"一次携带多个异常","scenario":"并发任务里多个异常","example":"group = ExceptionGroup(\"批量异常\", [ValueError(), TypeError()])","exampleLang":"python","pitfall":"组内为空会抛 ValueError。","raises":"ValueError，列表为空时"}]' />

### 抛出与链

<ApiTable :items='[{"name":"raise ... from ...","rank":"必会","signature":"raise NewError(...) from cause","params":[{"name":"cause","type":"BaseException","default":"必填","desc":"原因异常"}],"returns":"无","effect":"设置 __cause__ 保留原因","scenario":"包装底层异常","example":"try:\n    int(\"x\")\nexcept ValueError as error:\n    raise RuntimeError(\"解析异常\") from error","exampleLang":"python","pitfall":"写 from None 会切断原因链，只在该异常不该暴露时使用。","raises":"无"},{"name":"BaseException.add_note","rank":"常用","signature":"add_note(note)","params":[{"name":"note","type":"str","default":"必填","desc":"附加上下文"}],"returns":"None","effect":"给异常补上下文","scenario":"补充请求号与现场信息","example":"try:\n    run()\nexcept RuntimeError as error:\n    error.add_note(\"任务 42 异常\")\n    raise","exampleLang":"python","pitfall":"3.11 起可用。低版本需要自己拼消息。","raises":"无"}]' />

## 组合用法：批量任务的分组异常

### 组合了哪些知识？

组合了三件事：任务收集、分组异常与分别处理。

### 数据流图解

```text
逐个执行 ──▶ 成功收集结果 ──▶ 异常收集异常
全部结束 ──▶ 有异常则抛异常组 ──▶ except* 分支处理
```

### 分步实现

1. 循环执行。每条单独捕获异常。
2. 结果与异常分开收集。
3. 有异常时抛异常组。消息写清条数。
4. 调用方用 `except*` 按类型分支。

### 对比表格

| 方案 | 丢弃其余 | 一次看全 | 适用 |
|---|---|---|---|
| 首个异常即抛 | 是 | 否 | 快速异常 |
| 异常组 | 否 | 是 | 批量任务 |
| 返回异常列表 | 否 | 是 | 不需要抛错 |

## 完整 Demo：分组异常

### 场景描述

批量解析三个输入。全部记录异常后一次性抛出。

### 完整代码

```python
"""异常组：收集多个异常后一次抛出。"""


def parse_all(values):
    results, errors = [], []
    for value in values:
        try:
            results.append(int(value))
        except (TypeError, ValueError) as error:
            errors.append(error)
    if errors:
        raise ExceptionGroup(f"{len(errors)} 条解析异常", errors)
    return results


if __name__ == "__main__":
    print(parse_all(["1", "2"]))
    try:
        parse_all(["1", "x", None])
    except ExceptionGroup as group:
        for item in group.exceptions:
            print("子异常:", type(item).__name__, item)
```

### 运行方式

```bash
python3 demo.py
```

输出成功结果与两条子异常。低版本会把 `except ExceptionGroup` 当成普通异常处理。

### 常见误区

- 用 `except Exception: pass` 吞掉一切。排查时没有任何线索。
- 包装异常时不写 `from`。原因链断裂。

### 面试追问链

<details>
<summary>__cause__ 与 __context__ 的区别？</summary>

`__cause__` 由 `raise from` 显式设置。`__context__` 是隐式记录。
</details>

<details>
<summary>什么时候不该包装异常？</summary>

调用方需要按原类型分支时。包装会丢掉类型信息。
</details>

<details>
<summary>except* 与 except 能混用吗？</summary>

同一层里不能混用。要么处理组，要么处理单条。
</details>

### 下一讲衔接

下一讲 [模块与导入机制](/backend/learn/language-core/modules-import) 讲代码怎么组织与加载。重点是循环导入。

### 关联组件

暂无。异常分层在组件里对应异常码与响应。
