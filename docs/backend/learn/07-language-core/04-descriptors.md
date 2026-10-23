---
title: "描述符协议"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 4
level: advanced
tags: [descriptors, __get__, __set__, property]
description: "把属性访问变成可编程逻辑：描述符的调用规则与三类内置用法"
prerequisites:
  - /backend/learn/language-core/attribute-access
related_knowledge:
  - /backend/learn/language-core/metaclass
---

### 本讲要解决的问题

一个类属性为什么能影响实例的属性访问。
数据描述符与非数据描述符差在哪。
哪些内置设施其实就是描述符。

- 描述符的调用规则。
- 两类描述符的优先级。
- 用描述符实现校验与惰性加载。

## TL;DR

描述符是实现了 `__get__` 或 `__set__` 的类属性。
数据描述符有 `__set__`，优先级高于实例字典。
非数据描述符没有 `__set__`，实例字典可以覆盖它。
`property`、`classmethod`、`staticmethod` 都是描述符。

## 概念定义

**描述符**：实现了 `__get__`、`__set__` 或 `__delete__` 的对象。

**数据描述符**：实现了 `__set__` 或 `__delete__`。优先级最高。

**非数据描述符**：只有 `__get__`。实例字典可以盖住它。

**`__set_name__`**：类创建时被调用。能拿到属性名。

**`__get__(self, obj, owner)`**：`obj` 为 None 时表示从类上访问。

## 原理图解

下图回答一个问题：描述符在查找顺序里的位置。

<DiagramFrame src="/diagrams/attribute-lookup.html" title="描述符在属性查找中的位置（Archify 交互图）" :height="560" />

```text
类字典里存描述符对象
实例访问 ──▶ 数据描述符先执行
        └── 无数据描述符再看实例字典
                └── 最后才执行非数据描述符
```

## 关键对比

| 类型 | 实现 | 优先级 | 例子 |
|---|---|---|---|
| 数据描述符 | `__get__` + `__set__` | 最高 | `property` |
| 非数据描述符 | 只有 `__get__` | 低于实例字典 | 普通方法 |
| 普通类属性 | 无 | 最低 | 常量 |

| 用法 | 收益 | 代价 |
|---|---|---|
| 类型校验 | 命中即抛错误 | 每次赋值有开销 |
| 惰性加载 | 首次访问才计算 | 要处理并发 |
| 只读字段 | 防止误改 | 需要额外约定 |

### 官方依据与版本差异

- [描述符指南](https://docs.python.org/3/howto/descriptor.html) — 3.12 起调用规则未变。
- [数据模型：描述符](https://docs.python.org/3/reference/datamodel.html#implementing-descriptors) — 3.12 起 `__set_name__` 稳定可用。
- [functools 文档](https://docs.python.org/3/library/functools.html) — 3.8 起提供 `cached_property`。

## API 手册：描述符协议

### 协议方法

<ApiTable :items='[{"name":"__get__","rank":"必会","signature":"__get__(self, obj, owner=None)","params":[{"name":"obj","type":"object","default":"必填","desc":"实例，类访问时为 None"},{"name":"owner","type":"type","default":"None","desc":"所属类"}],"returns":"属性值","effect":"定义读取行为","scenario":"代理与计算属性","example":"class Doubler:\n    def __get__(self, obj, owner=None):\n        return 42","exampleLang":"python","pitfall":"obj 为 None 时要返回描述符自身或类级结果。","raises":"AttributeError，表示属性不存在"},{"name":"__set__","rank":"必会","signature":"__set__(self, obj, value)","params":[{"name":"obj","type":"object","default":"必填","desc":"实例"},{"name":"value","type":"object","default":"必填","desc":"新值"}],"returns":"None","effect":"定义赋值行为","scenario":"类型校验与只读字段","example":"class Typed:\n    def __set__(self, obj, value):\n        if not isinstance(value, int):\n            raise TypeError(\"只收整数\")\n        obj.__dict__[\"v\"] = value","exampleLang":"python","pitfall":"有 __set__ 后实例字典盖不住它。","raises":"TypeError，校验不通过时"}]' />

### 内置用法

<ApiTable :items='[{"name":"functools.cached_property","rank":"常用","signature":"cached_property(func)","params":[{"name":"func","type":"callable","default":"必填","desc":"无参方法"}],"returns":"非数据描述符","effect":"首次访问后缓存结果","scenario":"昂贵计算只做一次","example":"from functools import cached_property\n\nclass Report:\n    @cached_property\n    def total(self):\n        return sum(range(100))","exampleLang":"python","pitfall":"实例必须可写字典，带 __slots__ 时不可用。","raises":"AttributeError，实例不可写时"}]' />

## 组合用法：类型校验描述符

### 组合了哪些知识？

组合了三件事：描述符协议、属性名登记与错误提示。

### 数据流图解

```text
类创建 ──▶ __set_name__ 记录属性名
赋值 ──▶ __set__ 校验 ──▶ 存入实例字典
读取 ──▶ __get__ 取实例字典
```

### 分步实现

1. 写描述符类。实现 `__set_name__` 存属性名。
2. 实现 `__set__`。校验类型后写入实例字典。
3. 实现 `__get__`。从实例字典读。
4. 声明时直接写描述符实例。

### 对比表格

| 写法 | 复用性 | 错误信息 | 开销 |
|---|---|---|---|
| 手写 property | 低 | 明确 | 小 |
| 描述符类 | 高 | 可统一 | 中 |
| `__setattr__` 全局拦截 | 中 | 难定位 | 大 |

## 完整 Demo：类型校验描述符

### 场景描述

用描述符限制两个字段的类型。赋值类型不对直接抛错误，并指出字段名。

### 完整代码

```python
"""描述符：类型校验与属性名登记。"""


class Typed:
    def __init__(self, expected):
        self.expected = expected

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, obj, owner=None):
        if obj is None:
            return self
        return obj.__dict__[self.name]

    def __set__(self, obj, value):
        if not isinstance(value, self.expected):
            raise TypeError(f"{self.name} 需要 {self.expected.__name__}")
        obj.__dict__[self.name] = value


class User:
    age = Typed(int)
    name = Typed(str)

    def __init__(self, age, name):
        self.age = age
        self.name = name


if __name__ == "__main__":
    user = User(18, "ada")
    print(user.age, user.name)
    try:
        User("18", "ada")
    except TypeError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出两行。第二行说明描述符拦住了类型错误，并指出字段名。

### 常见误区

- 直接写 `obj.name = value`。会再次进入描述符，造成递归。
- 忘了实现 `__set_name__`。错误信息里拿不到字段名。

### 面试追问链

<details>
<summary>为什么数据描述符优先级更高？</summary>

它要在赋值时收回控制权。否则实例字典会盖住校验逻辑。
</details>

<details>
<summary>方法为什么是非数据描述符？</summary>

函数只有 `__get__`。所以实例字典可以存同名项覆盖方法。
</details>

<details>
<summary>描述符能用 __slots__ 吗？</summary>

可以。但插入数据要换存放位置，不能依赖实例字典。
</details>

### 下一讲衔接

下一讲 [元类编程](/backend/learn/language-core/metaclass) 讲类本身怎么创建。描述符在类创建后由它生效。

### 关联组件

暂无。描述符在组件里用于声明式配置。
