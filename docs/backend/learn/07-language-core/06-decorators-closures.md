---
title: "装饰器与闭包"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 6
level: advanced
tags: [closures, decorators, functools, wrapping]
description: "闭包捕获什么，装饰器怎么叠加、怎么保温签名与状态"
prerequisites:
  - /backend/learn/language-core/metaclass
related_knowledge:
  - /backend/learn/language-core/context-managers
---

### 本讲要解决的问题

闭包捕获的是值还是变量。循环里为什么全部拿到最后一个值。
多个装饰器叠加时谁先应用、谁先调用。
包装函数怎么保住签名与文档。装饰器之间怎么共享状态。

### 本讲要解决的问题

- 闭包的三要素与捕获规则。
- 晚绑定陷阱与三种修法。
- 装饰器的四种形态与调用顺序。
- 签名保真与状态共享的坑。

## TL;DR

闭包由三要素组成：内层函数、外层变量、外层返回内层函数。
捕获的是**变量（cell）**，不是当时的值，所以循环里会晚绑定。
装饰器应用由内向外，调用由外向内。
包装函数必须用 `functools.wraps`，否则签名与文档都会丢。

## 概念定义

**闭包**：内层函数引用外层函数的变量，且外层把内层返回出去。
三个条件缺一个都不算闭包。

**单元格（cell）**：外层变量的存放位置。多个闭包共享同一个 cell。
可以读 `函数.__closure__` 看到它。

**晚绑定**：闭包在**调用时**才去读 cell，而不是定义时复制值。

**`nonlocal`**：声明要改写外层变量。不写就只能读。

**装饰器**：接收函数并返回新函数的可调用对象。
它本质是「函数替换」：`@d` 等价于 `f = d(f)`。

**签名保真**：包装后仍能通过 `inspect.signature` 拿到原参数。
靠 `functools.wraps` 与 `*args, **kwargs` 一起实现。

## 原理图解

下图回答一个问题：三个装饰器叠加时，应用与调用各是什么顺序。

<DiagramFrame src="/diagrams/decorator-application.html" title="装饰器叠加：应用由内向外，调用由外向内（Archify 交互图）" :height="560" />

```text
@outer           应用顺序（自下而上）        调用顺序（自上而下）
@inner           先包 inner              先进 outer
def f(): ...     再包 outer              再进 inner
                 等价 f = outer(inner(f)) 最后到原函数

闭包捕获：
外层函数 cell[a] ──▶ 内层函数持有引用 ──▶ 调用时读 cell 的当前值
循环结束后 cell 是最后一个值 ──▶ 所以全部闭包都拿到同一个值
```

## 关键对比

| 晚绑定修法 | 写法 | 适用 | 代价 |
|---|---|---|---|
| 默认参数绑定 | `lambda x=i: x` | 简单回调 | 参数列表变形 |
| 再包一层工厂 | `def make(i): return lambda: i` | 需要干净签名 | 多一层函数 |
| `partial` | `partial(fn, i)` | 已有函数要预设参数 | 不能改内部变量 |

| 装饰器形态 | 结构 | 典型用途 |
|---|---|---|
| 无参装饰器 | 两层 | 日志、计时 |
| 带参装饰器 | 三层 | 重试次数、超时 |
| 类装饰器 | 类实现 `__call__` | 需要保存状态 |
| 方法装饰器 | 装饰类方法 | 权限与缓存 |

| 闭包与类 | 状态存放 | 生命周期 | 可读性 |
|---|---|---|---|
| 闭包 | cell | 被引用就存活 | 短逻辑更轻 |
| 类 | 实例属性 | 同上，可显式释放 | 多状态更清楚 |

### 官方依据与版本差异

- [functools 文档](https://docs.python.org/3/library/functools.html) — 3.12 起 `wraps`、`lru_cache` 与 `singledispatch` 接口稳定。
- [PEP 318](https://peps.python.org/pep-0318/) — 2.4 起提供装饰器语法。
- [PEP 3104](https://peps.python.org/pep-3104/) — 3.0 起提供 `nonlocal`。

## API 手册：闭包与装饰器

### 闭包工具

<ApiTable :items='[{"name":"nonlocal","rank":"必会","signature":"nonlocal name","params":[{"name":"name","type":"str","default":"必填","desc":"外层变量名"}],"returns":"声明语句","effect":"允许改写外层变量","scenario":"闭包里的计数器","example":"def counter():\n    n = 0\n    def step():\n        nonlocal n\n        n += 1\n        return n\n    return step","exampleLang":"python","pitfall":"不写 nonlocal 会新建局部变量，闭包状态永远不变。","raises":"SyntaxError，外层没有同名绑定时"},{"name":"__closure__","rank":"常用","signature":"fn.__closure__","params":[],"returns":"cell 元组或 None","effect":"查看闭包捕获了哪些变量","scenario":"排查晚绑定与内存问题","example":"def make(v):\n    def inner():\n        return v\n    return inner\n\nprint(make(1).__closure__[0].cell_contents)","exampleLang":"python","pitfall":"非闭包函数该属性为 None，别直接下标访问。","raises":"TypeError，None 取下标时"},{"name":"functools.partial","rank":"常用","signature":"partial(fn, *args)","params":[{"name":"fn","type":"callable","default":"必填","desc":"目标函数"},{"name":"args","type":"tuple","default":"()","desc":"预置位置参数"}],"returns":"可调用对象","effect":"固定部分参数","scenario":"循环里固定当前值","example":"from functools import partial\n\ncallbacks = [partial(handle, i) for i in range(3)]","exampleLang":"python","pitfall":"预置位置参数不能被调用时覆盖。","raises":"TypeError，参数不匹配时"}]' />

### 装饰器工具

<ApiTable :items='[{"name":"functools.wraps","rank":"必会","signature":"wraps(wrapped)","params":[{"name":"wrapped","type":"callable","default":"必填","desc":"被包装函数"}],"returns":"装饰器","effect":"复制名字、文档与注解","scenario":"所有包装函数","example":"from functools import wraps\n\ndef log(fn):\n    @wraps(fn)\n    def wrapper(*args, **kwargs):\n        return fn(*args, **kwargs)\n    return wrapper","exampleLang":"python","pitfall":"漏写后调试栈与文档全指向 wrapper。","raises":"无"},{"name":"functools.lru_cache","rank":"常用","signature":"lru_cache(maxsize=128)","params":[{"name":"maxsize","type":"int","default":"128","desc":"缓存条目上限"}],"returns":"装饰器","effect":"按参数缓存结果","scenario":"纯函数重复计算","example":"from functools import lru_cache\n\n@lru_cache(maxsize=64)\ndef fib(n):\n    return n if n < 2 else fib(n-1) + fib(n-2)","exampleLang":"python","pitfall":"参数必须可哈希。带副作用不要缓存。","raises":"TypeError，参数不可哈希时"},{"name":"functools.singledispatch","rank":"常用","signature":"singledispatch(fn)","params":[{"name":"fn","type":"callable","default":"必填","desc":"默认实现"}],"returns":"可注册函数","effect":"按首个参数类型分派","scenario":"同一动作多种类型","example":"from functools import singledispatch\n\n@singledispatch\ndef render(value):\n    return str(value)\n\n@render.register\ndef _(value: int):\n    return f\"int:{value}\"","exampleLang":"python","pitfall":"只按第一个参数分派，其余参数不参与。","raises":"无"}]' />

## 组合用法：闭包做计数器加装饰器做限流

### 组合了哪些知识？

组合了三件事：闭包保存状态、装饰器包装调用、`wraps` 保真。

### 数据流图解

```text
调用方 ──▶ wrapper（装饰层）──▶ 检查次数 ──▶ 原函数 ──▶ 返回
                     │
                     └── 闭包 cell 保存已调用次数
```

### 分步实现

1. 写闭包工厂。用 `nonlocal` 保存计数。
2. 写装饰器。在包装层读取计数。
3. 超过阈值时抛明确错误。
4. 用 `wraps` 保住签名与文档。

### 对比表格

| 方案 | 状态存放 | 可测试 | 适用 |
|---|---|---|---|
| 全局变量 | 模块级 | 差 | 临时脚本 |
| 闭包 | cell | 好 | 单函数限流 |
| 类实现 | 实例属性 | 最好 | 复杂策略 |

## 完整 Demo：闭包计数与装饰器限流

### 场景描述

用闭包保存调用次数，再用装饰器限制最多调用三次。
同时演示循环晚绑定与修法。

### 完整代码

```python
"""闭包与装饰器：状态保存、晚绑定与签名保真。"""

from functools import wraps
import inspect


def make_counter():
    count = 0

    def step():
        nonlocal count
        count += 1
        return count

    return step


def limit(times=3):
    def decorate(fn):
        used = 0

        @wraps(fn)
        def wrapper(*args, **kwargs):
            nonlocal used
            if used >= times:
                raise RuntimeError(f"{fn.__name__} 已超过 {times} 次")
            used += 1
            return fn(*args, **kwargs)

        return wrapper

    return decorate


@limit(times=2)
def fetch(name: str) -> str:
    return f"取到:{name}"


def build_callbacks() -> list:
    callbacks = []
    for index in range(3):
        callbacks.append(lambda: index)
    return callbacks


def build_fixed() -> list:
    callbacks = []
    for index in range(3):
        callbacks.append(lambda index=index: index)
    return callbacks


if __name__ == "__main__":
    counter = make_counter()
    print("计数:", counter(), counter(), counter())
    print("签名保真:", str(inspect.signature(fetch)))
    print(fetch("a"), fetch("b"))
    try:
        fetch("c")
    except RuntimeError as error:
        print("错误:", error)
    print("晚绑定:", [fn() for fn in build_callbacks()])
    print("已修复:", [fn() for fn in build_fixed()])
    print("cell 内容:", [cell.cell_contents for cell in build_fixed()[0].__closure__])
```

### 运行方式

```bash
python3 demo.py
```

输出计数三次、签名、两次成功调用、一条限流错误，
以及晚绑定组全是 2、修复组是 0/1/2、cell 里存的是 0。

### 常见误区

- 装饰器忘记返回包装函数。函数会变成 `None`。
- 循环里直接创建闭包。全部拿到最后一个值。
- 漏写 `wraps`。签名与文档丢失，调试信息也错位。
- 在装饰器里直接调用异步函数。要写 `async def wrapper` 并 `await`。

### 面试追问链

<details>
<summary>闭包捕获的是值还是变量？</summary>

变量。内层函数持有 cell 引用，调用时才取值。
</details>

<details>
<summary>为什么装饰器应用顺序是自下而上？</summary>

语法糖展开是套娃。`@outer` 在 `@inner` 之上，等价 `outer(inner(f))`。
</details>

<details>
<summary>类装饰器与函数装饰器的取舍？</summary>

需要保存多份状态或实现 `__call__` 协议时用类。简单包装用函数。
</details>

<details>
<summary>闭包会让对象回收不掉吗？</summary>

会持有外层变量。长时间存活的闭包要检查 cell 里是否抓着大对象。
</details>

### 下一讲衔接

下一讲 [上下文管理器](/backend/learn/language-core/context-managers) 讲资源释放。
装饰器常与它配合做超时与清理。

### 关联组件

暂无。装饰器在组件里用于缓存、重试与权限检查。
