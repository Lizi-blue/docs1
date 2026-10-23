---
title: "属性访问与 __slots__"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 3
level: advanced
tags: [attribute-access, property, slots, __getattr__]
description: "obj.x 走了哪几条路，__slots__ 省了什么又限制了什么"
prerequisites:
  - /backend/learn/language-core/object-lifecycle
related_knowledge:
  - /backend/learn/language-core/descriptors
---

### 本讲要解决的问题

读一个属性时，解释器按什么顺序找。
`__slots__` 只省内存吗。它关掉了什么。

- 属性查找走哪几步。
- `__getattr__` 与 `__getattribute__` 的差别。
- `__slots__` 的收益与限制。

## TL;DR

查找顺序是固定的。数据描述符优先，然后实例字典，再找类属性，最后才进 `__getattr__`。
`__getattribute__` 每次访问都会调用，改它风险高。
`__slots__` 去掉实例字典，省内存，也限制动态加属性。

## 概念定义

**属性查找**：从实例与类型上依次找同名的描述符、字典项与类属性。

**数据描述符**：实现了 `__set__` 或 `__delete__` 的描述符。优先级最高。

**`__getattr__`**：只在正常查找都失败后调用。适合做兜底。

**`__getattribute__`**：每次访问都会进。改它影响所有属性。

**`__slots__`**：声明固定属性名。实例不再有 `__dict__`。

## 原理图解

下图回答一个问题：`obj.x` 依次问了哪些地方。

<DiagramFrame src="/diagrams/attribute-lookup.html" title="属性查找顺序：描述符、实例字典、类属性与兜底（Archify 交互图）" :height="560" />

```text
obj.x ──▶ 类型查同名 ──▶ 数据描述符？是则调用
                    └── 否则查实例字典
                            └── 命中返回
                                └── 否则查类属性或非数据描述符
                                        └── 都没有则 __getattr__
```

## 关键对比

| 钩子 | 调用时机 | 风险 |
|---|---|---|
| `__getattr__` | 查找失败后 | 兜底写成万能返回会掩盖错误 |
| `__getattribute__` | 每次访问 | 容易递归，影响全部属性 |
| `__setattr__` | 每次赋值 | 忘记调用父类会丢状态 |

| 方案 | 内存 | 动态属性 | 适用 |
|---|---|---|---|
| 普通类 | 每实例一个字典 | 支持 | 一般场景 |
| `__slots__` | 固定布局，更省 | 不支持 | 大量小对象 |
| `dataclass(slots=True)` | 同 `__slots__` | 不支持 | 3.10 起推荐写法 |

### 官方依据与版本差异

- [数据模型：属性访问](https://docs.python.org/3/reference/datamodel.html#customizing-attribute-access) — 3.12 起查找顺序未变。
- [描述符指南](https://docs.python.org/3/howto/descriptor.html) — 3.12 起描述符调用规则稳定。
- [dataclass 文档](https://docs.python.org/3/library/dataclasses.html) — 3.10 起支持 `slots=True`。

## API 手册：访问与槽位

### 访问钩子

<ApiTable :items='[{"name":"object.__getattr__","rank":"必会","signature":"__getattr__(self, name)","params":[{"name":"name","type":"str","default":"必填","desc":"找不到的属性名"}],"returns":"属性值","effect":"为缺失属性兜底","scenario":"代理与惰性加载","example":"class Box:\n    def __getattr__(self, name):\n        return f\"没有 {name}\"","exampleLang":"python","pitfall":"兜底返回 None 会让错误延后暴露。","raises":"AttributeError，用于表示真的没有"},{"name":"object.__setattr__","rank":"常用","signature":"__setattr__(self, name, value)","params":[{"name":"name","type":"str","default":"必填","desc":"属性名"},{"name":"value","type":"object","default":"必填","desc":"属性值"}],"returns":"None","effect":"拦截赋值","scenario":"只读属性与校验","example":"class Frozen:\n    def __setattr__(self, name, value):\n        raise AttributeError(\"只读\")","exampleLang":"python","pitfall":"拦截后要调用父类实现，否则状态写不进对象。","raises":"AttributeError，拒绝赋值时"}]' />

### 声明式属性

<ApiTable :items='[{"name":"property","rank":"必会","signature":"property(fget=None, fset=None, fdel=None, doc=None)","params":[{"name":"fget","type":"callable","default":"None","desc":"读方法"},{"name":"fset","type":"callable","default":"None","desc":"写方法"}],"returns":"描述符对象","effect":"把方法挂成属性","scenario":"需要校验或计算属性","example":"class Temp:\n    def __init__(self): self._v = 0\n    @property\n    def value(self): return self._v","exampleLang":"python","pitfall":"只读 property 被赋值会抛 AttributeError。","raises":"AttributeError，缺少 setter 时"},{"name":"__slots__","rank":"常用","signature":"__slots__ = (\"a\", \"b\")","params":[{"name":"a, b","type":"str","default":"必填","desc":"允许的属性名"}],"returns":"类属性声明","effect":"去掉实例字典，固定布局","scenario":"大量小对象","example":"class Point:\n    __slots__ = (\"x\", \"y\")\n    def __init__(self, x, y): self.x, self.y = x, y","exampleLang":"python","pitfall":"父类没有 __slots__ 时子类仍会带字典，省内存失效。","raises":"AttributeError，写未声明的属性时"}]' />

## 组合用法：只读属性加校验

### 组合了哪些知识？

组合了三件事：`property`、私有字段与赋值校验。

### 数据流图解

```text
外部赋值 ──▶ setter ──▶ 校验 ──▶ 写私有字段
外部读取 ──▶ getter ──▶ 读私有字段 ──▶ 返回
```

### 分步实现

1. 私有字段加下划线前缀。表示只从内部访问。
2. 写 getter。返回计算值或字段值。
3. 写 setter。先校验再写。
4. 需要只读时省略 setter。

### 对比表格

| 写法 | 校验 | 只读 | 可读性 |
|---|---|---|---|
| 公开字段 | 无 | 否 | 好 |
| property | 有 | 可 | 好 |
| `__setattr__` | 全局拦截 | 可 | 差，影响所有属性 |

## 完整 Demo：带范围校验的属性

### 场景描述

温度对象只接受 -100 到 100 的值。越界直接抛错误。

### 完整代码

```python
"""property 与 __slots__：校验与省内存。"""


class Temperature:
    __slots__ = ("_celsius",)

    def __init__(self, celsius=0):
        self.celsius = celsius

    @property
    def celsius(self):
        return self._celsius

    @celsius.setter
    def celsius(self, value):
        if not -100 <= value <= 100:
            raise ValueError(f"越界：{value}")
        self._celsius = value


if __name__ == "__main__":
    temp = Temperature(25)
    print(temp.celsius)
    try:
        temp.celsius = 200
    except ValueError as error:
        print("错误:", error)
    try:
        temp.other = 1
    except AttributeError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

依次输出 25 与两条错误。最后一条说明 `__slots__` 拒绝了新属性。

### 常见误区

- 在 `__slots__` 类里又写实例字典。省内存失效。
- 用 `__getattr__` 兜底返回默认值。掩盖了真正的拼写错误。

### 面试追问链

<details>
<summary>property 与描述符是什么关系？</summary>

`property` 就是内置的数据描述符。自己写 `__get__` 也能实现同样效果。
</details>

<details>
<summary>__slots__ 为什么能省内存？</summary>

去掉每实例的字典。属性按固定偏移存放。
</details>

<details>
<summary>继承后 __slots__ 还有效吗？</summary>

父类没有 `__slots__` 时子类会重新带字典。
</details>

### 下一讲衔接

下一讲 [描述符协议](/backend/learn/language-core/descriptors) 把查找顺序展开。重点是数据与非数据描述符。

### 关联组件

暂无。属性机制在组件里用于配置对象与校验。
