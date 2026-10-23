---
title: "Protocol 与结构化子类型"
type: knowledge
domain: backend
knowledge_domain: type-system
order: 3
level: advanced
tags: [protocol, structural-typing, abc, duck-typing]
description: "按成员判断兼容：不继承也能满足接口"
prerequisites:
  - /backend/learn/type-system/generics
related_knowledge:
  - /backend/learn/type-system/callable-typing
---

### 本讲要解决的问题

鸭子类型在静态检查里怎么表达。
协议与抽象基类怎么选。
运行时能不能判断一个对象满足协议。

- 结构化子类型的判断方式。
- 协议与抽象基类的差别。
- 运行时检查的边界。

## TL;DR

协议按成员判断兼容，不要求继承。
抽象基类要求显式继承或注册。
`runtime_checkable` 只能检查成员是否存在，不检查签名。

## 概念定义

**结构化子类型**：看有哪些成员，不看继承关系。

**协议**：用 `Protocol` 声明的接口。可被隐式满足。

**名义子类型**：靠继承或注册建立关系。

**`runtime_checkable`**：允许用 `isinstance` 做成员检查。

**密封协议**：只允许本模块内实现。用于封闭集合。

## 原理图解

下图回答一个问题：协议在整个类型系统里的位置。

<DiagramFrame src="/diagrams/type-system-map.html" title="类型系统八讲地图：协议与检查器的位置（Archify 交互图）" :height="560" />

```text
类定义 ──▶ 有没有需要的成员 ──▶ 有则兼容（隐式）
抽象基类 ──▶ 是否继承或注册 ──▶ 是则兼容（显式）
```

## 关键对比

| 方案 | 兼容依据 | 需要改动被适配方 | 运行时检查 |
|---|---|---|---|
| 协议 | 成员 | 不需要 | 有限支持 |
| 抽象基类 | 继承或注册 | 需要 | 支持 |
| 直接判断 | 运行时成员 | 不需要 | 支持 |

| 检查方式 | 检查内容 | 局限 |
|---|---|---|
| `isinstance` 加协议 | 成员是否存在 | 不检查签名 |
| 直接调用 | 真实行为 | 出错误才知道 |
| 单元测试 | 行为约定 | 需要写用例 |

### 官方依据与版本差异

- [typing.Protocol](https://docs.python.org/3/library/typing.html#typing.Protocol) — 3.8 起提供协议。
- [PEP 544](https://peps.python.org/pep-0544/) — 3.8 起支持结构化子类型。
- [abc 文档](https://docs.python.org/3/library/abc.html) — 3.12 起抽象基类接口未变。

## API 手册：协议工具

### 协议声明

<ApiTable :items='[{"name":"typing.Protocol","rank":"必会","signature":"Protocol","params":[],"returns":"协议基类","effect":"声明结构化接口","scenario":"不修改第三方类就适配","example":"from typing import Protocol\n\nclass Reader(Protocol):\n    def read(self) -> str: ...","exampleLang":"python","pitfall":"协议里不要写实现。写了也不会被执行。","raises":"无"},{"name":"typing.runtime_checkable","rank":"常用","signature":"runtime_checkable(cls)","params":[{"name":"cls","type":"type","default":"必填","desc":"协议类"}],"returns":"同一个协议类","effect":"允许 isinstance 检查","scenario":"按能力分支","example":"from typing import Protocol, runtime_checkable\n\n@runtime_checkable\nclass Closeable(Protocol):\n    def close(self) -> None: ...","exampleLang":"python","pitfall":"只检查成员存在，不检查参数与返回值类型。","raises":"无"}]' />

### 名义与结构化

<ApiTable :items='[{"name":"abc.ABC","rank":"常用","signature":"ABC","params":[],"returns":"抽象基类","effect":"要求显式继承并实现抽象方法","scenario":"需要注册机制与严格约束","example":"from abc import ABC, abstractmethod\n\nclass Store(ABC):\n    @abstractmethod\n    def save(self) -> None: ...","exampleLang":"python","pitfall":"未实现抽象方法时实例化会抛错误。","raises":"TypeError，实例化未实现抽象方法的子类时"},{"name":"abc.ABCMeta.register","rank":"进阶","signature":"register(cls)","params":[{"name":"cls","type":"type","default":"必填","desc":"要注册的类"}],"returns":"被注册的类","effect":"把无关类声明为子类型","scenario":"适配第三方类","example":"class Store(ABC): ...\n\nclass Legacy: ...\nStore.register(Legacy)","exampleLang":"python","pitfall":"注册不做任何成员检查，错了只能靠测试发现。","raises":"RuntimeError，循环注册时"}]' />

## 组合用法：适配第三方客户端

### 组合了哪些知识？

组合了三件事：协议声明、包装类与运行时分支。

### 数据流图解

```text
业务代码 ──▶ 只依赖 Reader 协议
第三方客户端 ──▶ 包装类补齐 read ──▶ 满足协议
```

### 分步实现

1. 先写协议。只放业务真正用到的方法。
2. 写包装类。把第三方接口转成协议形状。
3. 业务代码只接收协议类型。
4. 需要分支时用 `runtime_checkable`。

### 对比表格

| 做法 | 改动第三方 | 类型安全 | 适用 |
|---|---|---|---|
| 协议 + 包装 | 不需要 | 强 | 主流选择 |
| 继承抽象基类 | 需要改造 | 强 | 自有代码 |
| 不声明类型 | 不需要 | 无 | 原型阶段 |

## 完整 Demo：按能力分支

### 场景描述

定义一个可关闭协议，对实现了 close 的对象做清理，其余跳过。

### 完整代码

```python
"""Protocol 与运行时检查：按能力分支。"""

from typing import Protocol, runtime_checkable


@runtime_checkable
class Closeable(Protocol):
    def close(self) -> None: ...


class File:
    def __init__(self, name: str) -> None:
        self.name = name
        self.closed = False

    def close(self) -> None:
        self.closed = True


class Plain:
    pass


def cleanup(items: list[object]) -> list[str]:
    done = []
    for item in items:
        if isinstance(item, Closeable):
            item.close()
            done.append(type(item).__name__)
    return done


if __name__ == "__main__":
    handle = File("a.txt")
    print(cleanup([handle, Plain()]))
    print("已关闭:", handle.closed)
```

### 运行方式

```bash
python3 demo.py
```

输出被清理的类名与关闭状态。`Plain` 没有 close，被跳过。

### 常见误区

- 协议里写实现细节。运行时不会执行。
- 以为 `runtime_checkable` 会检查签名。它只看成员名字。

### 面试追问链

<details>
<summary>协议与鸭子类型的关系？</summary>

协议把鸭子类型写成可检查的声明。语义一致，多了一层静态检查。
</details>

<details>
<summary>什么时候必须用抽象基类？</summary>

需要注册机制，或需要强制子类实现时。协议做不到强制。
</details>

<details>
<summary>runtime_checkable 的性能代价？</summary>

每次 isinstance 都要查成员。热路径上避免频繁使用。
</details>

### 下一讲衔接

下一讲 [可调用类型与重载](/backend/learn/type-system/callable-typing) 讲函数签名怎么表达。

### 关联组件

暂无。协议用于组件对外接口。
