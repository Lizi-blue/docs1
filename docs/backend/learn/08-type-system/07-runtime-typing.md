---
title: "运行时类型信息"
type: knowledge
domain: backend
knowledge_domain: type-system
order: 7
level: advanced
tags: [get_type_hints, annotations, inspect, dataclass]
description: "注解在运行时能拿到什么，拿不到什么"
prerequisites:
  - /backend/learn/type-system/type-checkers
related_knowledge:
  - /backend/learn/type-system/type-migration
---

### 本讲要解决的问题

运行时能拿到注解吗。拿到的是字符串还是类型。
泛型参数还在吗。如何做参数检查或文档生成。

- 注解的存放位置与求值时机。
- 前向引用与解析。
- 用注解做检查的边界。

## TL;DR

函数注解存在 `__annotations__`，可能是字符串。
用 `typing.get_type_hints` 解析成真实类型。
泛型参数能取到，但变量的注解不会在运行期保留值。

## 概念定义

**`__annotations__`**：注解字典。3.10 起默认按字符串保存。

**前向引用**：注解里写还没定义的类型。需要延迟解析。

**`get_type_hints`**：把注解解析成类型对象。

**`inspect.signature`**：取参数与默认值。

**变量注解**：模块与类级能查，函数内局部变量查不到。

## 原理图解

下图回答一个问题：注解在运行时的可用性。

<DiagramFrame src="/diagrams/type-system-checker-pipeline.html" title="注解在运行时的解析链路（Archify 交互图）" :height="560" />

```text
源码注解 ──▶ __annotations__（可能是字符串）──▶ get_type_hints 解析 ──▶ 类型对象
类与模块级变量 ──▶ __annotations__ 可查
函数局部变量 ──▶ 运行期不可查
```

## 关键对比

| 位置 | 运行时可查 | 形式 |
|---|---|---|
| 函数参数与返回 | 是 | 字符串或类型 |
| 类属性 | 是 | 字符串或类型 |
| 模块级变量 | 是 | 字符串或类型 |
| 函数局部变量 | 否 | 无 |

| 取值方式 | 是否解析前向引用 | 开销 |
|---|---|---|
| 直接读 `__annotations__` | 否 | 最小 |
| `get_type_hints` | 是 | 有 |
| `inspect.signature` | 部分 | 中 |

### 官方依据与版本差异

- [函数注解](https://docs.python.org/3/reference/compound_stmts.html#function-definitions) — 3.12 起注解求值规则稳定。
- [PEP 563](https://peps.python.org/pep-0563/) — 3.7 起可延迟注解求值。
- [typing.get_type_hints](https://docs.python.org/3/library/typing.html#typing.get_type_hints) — 3.12 起接口稳定。

## API 手册：注解读取

### 解析注解

<ApiTable :items='[{"name":"typing.get_type_hints","rank":"必会","signature":"get_type_hints(obj, globalns=None, localns=None)","params":[{"name":"obj","type":"object","default":"必填","desc":"函数、类或模块"},{"name":"globalns","type":"dict","default":"None","desc":"解析用的全局命名空间"}],"returns":"注解字典，值为类型对象","effect":"解析前向引用","scenario":"参数检查与文档生成","example":"from typing import get_type_hints\n\ndef f(x: \"int\") -> None: ...\nprint(get_type_hints(f))","exampleLang":"python","pitfall":"局部定义的类可能解析不到，要传 localns。","raises":"NameError，引用的名字不存在时"},{"name":"inspect.signature","rank":"常用","signature":"signature(callable)","params":[{"name":"callable","type":"callable","default":"必填","desc":"目标函数"}],"returns":"签名对象","effect":"取参数、默认值与注解","scenario":"装饰器与参数绑定","example":"import inspect\n\ndef f(a: int, b: str = \"x\") -> None: ...\nprint(inspect.signature(f))","exampleLang":"python","pitfall":"内置函数可能取不到签名。","raises":"ValueError，取不到签名时"}]' />

### 运行期检查

<ApiTable :items='[{"name":"isinstance","rank":"必会","signature":"isinstance(obj, class_or_tuple)","params":[{"name":"obj","type":"object","default":"必填","desc":"待检查对象"},{"name":"class_or_tuple","type":"type","default":"必填","desc":"类型或类型元组"}],"returns":"布尔值","effect":"运行期类型判断","scenario":"入参检查","example":"if not isinstance(value, int):\n    raise TypeError(\"需要整数\")","exampleLang":"python","pitfall":"泛型参数不参与判断。list[int] 与 list[str] 无法区分。","raises":"TypeError，第二个参数不是类型时"},{"name":"typing.get_args","rank":"常用","signature":"get_args(tp)","params":[{"name":"tp","type":"type","default":"必填","desc":"泛型类型"}],"returns":"参数元组","effect":"取泛型实参","scenario":"按元素类型分支","example":"from typing import get_args\n\nprint(get_args(list[int]))","exampleLang":"python","pitfall":"非泛型类型返回空元组。","raises":"无"}]' />

## 组合用法：按注解检查入参

### 组合了哪些知识？

组合了三件事：签名读取、前向引用解析与类型判断。

### 数据流图解

```text
调用 ──▶ 取签名 ──▶ 解析注解 ──▶ 逐个参数 isinstance ──▶ 通过或报错
```

### 分步实现

1. 先取签名。拿到参数名与注解。
2. 用 `get_type_hints` 解析。前向引用才会变成类型。
3. 逐个检查实参。不通过就抛错误。
4. 只用于边界。不要在每个函数里都做。

### 对比表格

| 做法 | 开销 | 覆盖 | 适用 |
|---|---|---|---|
| 手写检查 | 低 | 明确 | 关键函数 |
| 注解驱动检查 | 中 | 广 | 接口边界 |
| 不检查 | 无 | 无 | 内部调用 |

## 完整 Demo：注解驱动的参数检查

### 场景描述

用注解检查一个函数的入参类型。类型不对直接抛错误。

### 完整代码

```python
"""运行时类型信息：按注解检查入参。"""

from typing import get_type_hints
import inspect


def checked(fn):
    hints = get_type_hints(fn)
    signature = inspect.signature(fn)

    def wrapper(*args, **kwargs):
        bound = signature.bind(*args, **kwargs)
        for name, value in bound.arguments.items():
            expected = hints.get(name)
            if expected and not isinstance(value, expected):
                raise TypeError(f"{name} 需要 {expected.__name__}")
        return fn(*args, **kwargs)
    return wrapper


@checked
def greet(name: str, times: int) -> str:
    return name * times


if __name__ == "__main__":
    print(greet("a", 3))
    try:
        greet(1, 3)
    except TypeError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出重复字符串与一条错误。把 `times` 传成字符串也会被拦住。

### 常见误区

- 以为泛型参数能判断。运行时拿不到元素类型。
- 在热路径上每次解析注解。应缓存结果。

### 面试追问链

<details>
<summary>为什么字符串注解要解析？</summary>

延迟求值能避免前向引用。检查与运行时都需要真实类型。
</details>

<details>
<summary>局部变量注解能查到吗？</summary>

不能。函数体内的注解不会进入可查字典。
</details>

<details>
<summary>注解检查能替代检查吗？</summary>

不能。只覆盖类型，不覆盖取值范围与业务规则。
</details>

### 下一讲衔接

下一讲 [渐进式类型迁移](/backend/learn/type-system/type-migration) 讲存量代码怎么加类型。

### 关联组件

暂无。运行时注解用于检查与文档生成。
