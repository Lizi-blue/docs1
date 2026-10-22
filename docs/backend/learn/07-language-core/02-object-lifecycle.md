---
title: "对象创建与生命周期"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 2
level: advanced
tags: [object-model, __new__, __del__, weakref, gc]
description: "从 __new__ 到 __del__：对象何时创建、何时回收、资源何时释放"
prerequisites:
  - /backend/learn/language-core/data-model
related_knowledge:
  - /backend/learn/language-core/attribute-access
---

### 本讲要解决的问题

实例化时到底调了谁。`__init__` 之前还有一步。
对象什么时候被回收。`__del__` 能不能当资源释放的保证。

### 本讲要解决的问题

- 创建过程分几步。
- 回收靠什么机制。
- 资源释放该写在哪。

## TL;DR

创建分两步。先由 `__new__` 造出实例，再由 `__init__` 填初值。
回收靠引用计数与分代回收。`__del__` 的执行时机不确定。
资源释放写在上下文管理器或 `close` 里，不要依赖 `__del__`。

## 概念定义

**`__new__`**：静态方法，负责造对象。返回实例，也可能是别的类型。

**`__init__`**：实例方法，负责填初值。返回 `None`，返回值会被忽略。

**引用计数**：每个对象记录被引用次数。归零即回收。

**循环引用**：对象互相引用，计数不归零。靠分代回收处理。

**弱引用**：不增加引用计数的引用。用来旁听对象，不阻止回收。

## 原理图解

下图回答一个问题：对象、类型与元类的关系决定了创建过程。

<DiagramFrame src="/diagrams/language-object-model.html" title="对象、类型与元类：创建与回收的层次（Archify 交互图）" :height="560" />

```text
调用 C(...) ──▶ 元类的 __call__ ──▶ __new__ 造实例 ──▶ __init__ 填初值 ──▶ 返回实例
引用减少到 0 ──▶ 立即回收 ──▶ __del__ 可能被调用
```

## 关键对比

| 方法 | 职责 | 返回值 | 常见误用 |
|---|---|---|---|
| `__new__` | 造实例 | 实例 | 忘了调用父类实现 |
| `__init__` | 填初值 | `None` | 返回非 None 会报错 |
| `__del__` | 回收前钩子 | 无 | 当成资源释放保证 |

| 回收机制 | 触发条件 | 代价 |
|---|---|---|
| 引用计数 | 计数归零 | 循环引用处理不了 |
| 分代回收 | 阈值触发 | 有暂停 |
| 显式关闭 | 调用 `close` | 需要调用方配合 |

### 官方依据与版本差异

- [数据模型](https://docs.python.org/3/reference/datamodel.html) — 3.12 起 `__del__` 与回收语义未变，`__new__` 规则稳定。
- [gc 模块](https://docs.python.org/3/library/gc.html) — 3.13 起提供 `gc.freeze` 之外的调优接口，回收阈值可查。
- [weakref 模块](https://docs.python.org/3/library/weakref.html) — 3.12 起弱引用集合接口稳定。

## API 手册：创建与回收

### 创建过程

<ApiTable :items='[{"name":"object.__new__","rank":"必会","signature":"__new__(cls, *args, **kwargs)","params":[{"name":"cls","type":"type","default":"必填","desc":"要创建的类"}],"returns":"新实例","effect":"分配对象并返回","scenario":"需要控制实例来源时","example":"class Singleton:\n    _inst = None\n    def __new__(cls):\n        if cls._inst is None:\n            cls._inst = super().__new__(cls)\n        return cls._inst","exampleLang":"python","pitfall":"返回其它类型时 __init__ 不再被调用。","raises":"TypeError，参数与父类签名不匹配时"},{"name":"object.__init__","rank":"必会","signature":"__init__(self, *args, **kwargs)","params":[{"name":"self","type":"object","default":"必填","desc":"已创建的实例"}],"returns":"None","effect":"填充实例状态","scenario":"常规初始化","example":"class Point:\n    def __init__(self, x, y):\n        self.x, self.y = x, y","exampleLang":"python","pitfall":"返回非 None 会抛 TypeError。","raises":"TypeError，返回值不是 None 时"}]' />

### 销毁与引用

<ApiTable :items='[{"name":"weakref.ref","rank":"常用","signature":"ref(obj, callback=None)","params":[{"name":"obj","type":"object","default":"必填","desc":"被旁听对象"},{"name":"callback","type":"callable","default":"None","desc":"对象回收后回调"}],"returns":"弱引用对象，取值得到对象或 None","effect":"不增加引用计数","scenario":"缓存与观察者","example":"import weakref\n\nclass Node: pass\nnode = Node()\nref = weakref.ref(node)\nprint(ref() is node)","exampleLang":"python","pitfall":"不是所有对象都能被弱引用，带 __slots__ 的类要声明 __weakref__。","raises":"TypeError，对象不支持弱引用时"}]' />

## 组合用法：用弱引用做旁听缓存

### 组合了哪些知识？

组合了三件事：创建、弱引用与回收回调。

### 数据流图解

```text
任务对象 ──▶ 弱引用表 ──▶ 回收时回调 ──▶ 清理登记项
      └── 强引用只在执行期间存在
```

### 分步实现

1. 执行时持强引用。任务结束就松开。
2. 登记时只存弱引用。不阻止回收。
3. 回收回调里删除登记。避免残留。
4. 读取时先取值。为 None 说明已回收。

### 对比表格

| 方案 | 阻止回收 | 读取风险 | 适用 |
|---|---|---|---|
| 强引用表 | 是 | 无 | 需要长期持有 |
| 弱引用表 | 否 | 取到 None | 缓存与旁听 |
| 手动删除 | 否 | 忘记删会泄漏 | 简单场景 |

## 完整 Demo：观察创建与回收

### 场景描述

打印实例的创建与回收顺序。用弱引用判断对象是否还在。

### 完整代码

```python
"""创建与回收：__new__、__init__、__del__ 与弱引用。"""

import weakref


class Resource:
    def __new__(cls, name):
        instance = super().__new__(cls)
        print("new:", name)
        return instance

    def __init__(self, name):
        self.name = name
        print("init:", name)

    def __del__(self):
        print("del:", self.name)


item = Resource("a")
ref = weakref.ref(item)
print("还活着:", ref() is not None)
del item
print("已回收:", ref() is None)
```

### 运行方式

```bash
python3 demo.py
```

输出顺序为 new、init、还活着、del、已回收。

### 常见误区

- 把 `__del__` 当成 `close`。回收时机不确定，解释器退出时可能不执行。
- 在 `__init__` 里返回 `self`。会抛 `TypeError`。

### 面试追问链

<details>
<summary>为什么单例要写 __new__ 而不是 __init__？</summary>

`__init__` 每次都会执行。要控制实例数量，只能拦在 `__new__`。
</details>

<details>
<summary>循环引用怎么处理？</summary>

靠分代回收。对象里有 `__del__` 时旧版本行为不同，3.4 起可回收。
</details>

<details>
<summary>资源释放写在哪最可靠？</summary>

写在上下文管理器或显式 `close` 里。调用方能看到时机。
</details>

### 下一讲衔接

下一讲 [属性访问与 __slots__](/backend/learn/language-core/attribute-access) 讲属性怎么找。重点是查找顺序。

### 关联组件

暂无。对象生命周期在组件里体现为连接与句柄的释放。
