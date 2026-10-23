---
title: "元类编程"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 5
level: advanced
tags: [metaclass, type, __init_subclass__, class-creation]
description: "类也是对象：用元类或子类钩子定制类的创建"
prerequisites:
  - /backend/learn/language-core/descriptors
related_knowledge:
  - /backend/learn/language-core/decorators-closures
---

### 本讲要解决的问题

类本身也是对象。谁创建了它。
什么时候该用元类，什么时候用更轻的钩子。
两者在复杂度上差多少。

- 类的创建过程分几步。
- 元类与 `__init_subclass__` 的差别。
- 什么场景才值得用元类。

## TL;DR

类由元类创建。默认元类是 `type`。
创建分三步：先准备命名空间，再执行类体，最后调用元类创建类对象。
多数需求用 `__init_subclass__` 就能满足。元类只在需要控制类体执行环境时才必要。

## 概念定义

**元类**：创建类的类。控制类对象怎么创建。

**`__prepare__`**：返回类体执行时用的命名空间。默认是普通字典。

**`__init_subclass__`**：父类上的钩子。子类创建后自动调用。

**类装饰器**：拿到类对象后再加工。比元类简单。

**注册表**：把子类按名字登记。常见于插件与序列化。

## 原理图解

下图回答一个问题：类对象在对象体系里的位置。

<DiagramFrame src="/diagrams/language-object-model.html" title="对象、类型与元类：类由谁创建（Archify 交互图）" :height="560" />

```text
class Foo ──▶ 元类 __prepare__ 给出命名空间 ──▶ 执行类体 ──▶ 元类(...) 创建类对象
子类定义 ──▶ 父类 __init_subclass__ 被调用 ──▶ 注册或校验
```

## 关键对比

| 方案 | 介入时机 | 复杂度 | 适用 |
|---|---|---|---|
| `__init_subclass__` | 子类创建后 | 低 | 注册、校验、补默认值 |
| 类装饰器 | 类创建后 | 低 | 统一改写类属性 |
| 元类 | 类创建过程中 | 高 | 控制类体执行环境 |

| 用途 | 推荐方案 | 理由 |
|---|---|---|
| 自动注册子类 | `__init_subclass__` | 无需替换元类 |
| 类属性排序 | `__prepare__` | 需要有序命名空间 |
| 接口校验 | 元类或装饰器 | 两者都可，选简单者 |

### 官方依据与版本差异

- [数据模型：元类](https://docs.python.org/3/reference/datamodel.html#metaclasses) — 3.12 起规则未变。
- [PEP 487](https://peps.python.org/pep-0487/) — 3.6 起提供 `__init_subclass__` 与 `__set_name__`。
- [type 文档](https://docs.python.org/3/library/functions.html#type) — 3.3 起支持 `type(name, bases, ns)` 三参形式。

## API 手册：类创建

### 类创建入口

<ApiTable :items='[{"name":"type","rank":"必会","signature":"type(name, bases, namespace)","params":[{"name":"name","type":"str","default":"必填","desc":"类名"},{"name":"bases","type":"tuple","default":"必填","desc":"父类元组"},{"name":"namespace","type":"dict","default":"必填","desc":"类字典"}],"returns":"新的类对象","effect":"动态创建类","scenario":"工厂与元类内部","example":"Foo = type(\"Foo\", (), {\"x\": 1})\nprint(Foo.x)","exampleLang":"python","pitfall":"三参形式不会执行 class 语句体，只按字典建类。","raises":"TypeError，参数不合法时"},{"name":"__prepare__","rank":"常用","signature":"__prepare__(mcls, name, bases)","params":[{"name":"name","type":"str","default":"必填","desc":"类名"},{"name":"bases","type":"tuple","default":"必填","desc":"父类元组"}],"returns":"类体命名空间","effect":"控制类体执行时用的映射","scenario":"需要保留定义顺序时","example":"class OrderedMeta(type):\n    @classmethod\n    def __prepare__(mcls, name, bases):\n        return {}","exampleLang":"python","pitfall":"返回的自定义映射要支持普通字典操作。","raises":"TypeError，返回值不可用时"}]' />

### 子类钩子

<ApiTable :items='[{"name":"__init_subclass__","rank":"必会","signature":"__init_subclass__(cls, **kwargs)","params":[{"name":"kwargs","type":"dict","default":"{}","desc":"类声明时传入的关键字"}],"returns":"None","effect":"子类创建后自动被调用","scenario":"注册与统一校验","example":"class Base:\n    registry = {}\n    def __init_subclass__(cls, **kwargs):\n        super().__init_subclass__(**kwargs)\n        Base.registry[cls.__name__] = cls","exampleLang":"python","pitfall":"忘记调用 super 会断掉父类的钩子链。","raises":"TypeError，子类传了未声明的关键字"}]' />

## 组合用法：自动注册子类

### 组合了哪些知识？

组合了三件事：子类钩子、类属性注册表与按名查找。

### 数据流图解

```text
定义子类 ──▶ __init_subclass__ ──▶ 写入注册表
按名取类 ──▶ 查注册表 ──▶ 实例化 ──▶ 返回对象
```

### 分步实现

1. 父类定义注册表。类属性即可。
2. 实现钩子。把子类写进注册表。
3. 定义子类时不必手写登记。
4. 按名取类时查表。未命中给出明确错误。

### 对比表格

| 写法 | 样板代码 | 出错概率 | 可读性 |
|---|---|---|---|
| 手写注册 | 每个子类一行 | 忘写就漏 | 直观 |
| `__init_subclass__` | 一次 | 低 | 好 |
| 元类 | 一次但复杂 | 中 | 差 |

## 完整 Demo：插件注册表

### 场景描述

用子类钩子登记插件，按名字创建实例。未登记的名字抛错误。

### 完整代码

```python
"""元类与子类钩子：自动注册插件。"""


class Plugin:
    registry = {}

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        Plugin.registry[cls.__name__.lower()] = cls

    def run(self):
        raise NotImplementedError


class Echo(Plugin):
    def run(self):
        return "echo"


class Upper(Plugin):
    def run(self):
        return "UPPER"


def build(name):
    cls = Plugin.registry.get(name)
    if cls is None:
        raise KeyError(f"未登记的插件：{name}")
    return cls()


if __name__ == "__main__":
    print(build("echo").run())
    print(build("upper").run())
    try:
        build("missing")
    except KeyError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出两行结果与一行错误。注册表在导入时就已填好。

### 常见误区

- 一上来就写元类。多数需求用钩子就够。
- 元类里忘了调用 `super().__new__`。类可能建不出来。

### 面试追问链

<details>
<summary>元类与类装饰器的区别？</summary>

元类在类创建过程中介入。装饰器拿到的是已创建好的类。
</details>

<details>
<summary>__init_subclass__ 是类方法吗？</summary>

它是隐式类方法。第一个参数是子类，不需要额外装饰。
</details>

<details>
<summary>什么时候必须用元类？</summary>

需要控制类体执行环境时。例如自定义命名空间或拦截类属性定义。
</details>

### 下一讲衔接

下一讲 [装饰器与闭包](/backend/learn/language-core/decorators-closures) 讲对函数与类的包装。重点是叠加顺序。

### 关联组件

暂无。注册表模式在组件里用于策略选择。
