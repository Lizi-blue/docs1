---
title: "装饰器与闭包"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 6
level: advanced
tags: [decorators, closures, functools, wrapping]
description: "闭包捕获了什么，装饰器按什么顺序叠加与调用"
prerequisites:
  - /backend/learn/language-core/metaclass
related_knowledge:
  - /backend/learn/language-core/context-managers
---

### 本讲要解决的问题

闭包捕获的是值还是变量。循环里为什么拿到同一个值。
多个装饰器叠加时谁先执行。
包装函数怎么保住原有签名与文档。

### 本讲要解决的问题

- 闭包捕获的规则。
- 叠加与调用的顺序。
- 包装函数的坑与修法。

## TL;DR

闭包按名字捕获变量，不按值。循环变量是同一个单元格，所以晚绑定。
装饰器应用顺序由内向外，调用顺序由外向内。
包装函数要用 `functools.wraps` 保住名字与文档。

## 概念定义

**闭包**：内层函数引用外层函数的变量。外层返回后变量仍存活。

**单元格**：闭包捕获的变量存放位置。多个闭包共享同一个单元格。

**装饰器**：接收函数并返回新函数的可调用对象。

**带参装饰器**：先接收参数，再返回真正的装饰器。

**`functools.wraps`**：把原函数的名字、文档与注解复制到包装函数。

## 原理图解

下图回答一个问题：三个装饰器叠加时，应用与调用各是什么顺序。

<DiagramFrame src="/diagrams/decorator-application.html" title="装饰器叠加：应用由内向外，调用由外向内（Archify 交互图）" :height="560" />

```text
@outer
@inner
def f(): ...
等价于 f = outer(inner(f))
调用 f() ──▶ outer 包装层 ──▶ inner 包装层 ──▶ 原函数
```

## 关键对比

| 场景 | 捕获方式 | 结果 |
|---|---|---|
| 普通闭包 | 按名字 | 外层变量变化后可见 |
| 循环里定义函数 | 同一个单元格 | 全部拿到最后一个值 |
| 默认参数绑定 | 按值 | 循环里用它固定当前值 |

| 写法 | 签名保真 | 文档保真 | 推荐 |
|---|---|---|---|
| 直接包装 | 否 | 否 | 不推荐 |
| `@wraps` | 是 | 是 | 推荐 |
| 类实现装饰器 | 取决于实现 | 需手动设置 | 复杂场景 |

### 官方依据与版本差异

- [functools 文档](https://docs.python.org/3/library/functools.html) — 3.12 起 `wraps` 与 `lru_cache` 接口稳定。
- [PEP 318](https://peps.python.org/pep-0318/) — 2.4 起提供装饰器语法。
- [PEP 443](https://peps.python.org/pep-0443/) — 3.4 起提供单分派泛型函数。

## API 手册：装饰器工具

### 包装与缓存

<ApiTable :items='[{"name":"functools.wraps","rank":"必会","signature":"wraps(wrapped)","params":[{"name":"wrapped","type":"callable","default":"必填","desc":"被包装的函数"}],"returns":"装饰器","effect":"复制名字、文档与注解","scenario":"所有包装函数","example":"from functools import wraps\n\ndef log(func):\n    @wraps(func)\n    def wrapper(*args, **kwargs):\n        return func(*args, **kwargs)\n    return wrapper","exampleLang":"python","pitfall":"忘了它会让调试信息全指向 wrapper。","raises":"AttributeError，被包装对象缺少属性时部分字段跳过"},{"name":"functools.lru_cache","rank":"常用","signature":"lru_cache(maxsize=128)","params":[{"name":"maxsize","type":"int","default":"128","desc":"缓存条目上限"}],"returns":"装饰器","effect":"按参数缓存结果","scenario":"纯函数重复计算","example":"from functools import lru_cache\n\n@lru_cache(maxsize=64)\ndef fib(n):\n    return n if n < 2 else fib(n-1) + fib(n-2)","exampleLang":"python","pitfall":"参数必须可哈希。带副作用的函数不要缓存。","raises":"TypeError，参数不可哈希时"}]' />

### 闭包与部分应用

<ApiTable :items='[{"name":"functools.partial","rank":"常用","signature":"partial(func, *args, **kwargs)","params":[{"name":"func","type":"callable","default":"必填","desc":"目标函数"},{"name":"args","type":"tuple","default":"()","desc":"预置位置参数"}],"returns":"新的可调用对象","effect":"固定部分参数","scenario":"回调与工厂","example":"from functools import partial\n\nint2 = partial(int, base=2)\nprint(int2(\"1010\"))","exampleLang":"python","pitfall":"预置的关键字可被调用时覆盖，位置参数不可。","raises":"TypeError，参数不匹配时"},{"name":"nonlocal","rank":"必会","signature":"nonlocal name","params":[{"name":"name","type":"str","default":"必填","desc":"外层变量名"}],"returns":"声明语句","effect":"允许改写外层变量","scenario":"闭包里的计数器","example":"def counter():\n    n = 0\n    def step():\n        nonlocal n\n        n += 1\n        return n\n    return step","exampleLang":"python","pitfall":"不写 nonlocal 会创建新的局部变量。","raises":"SyntaxError，外层无同名绑定时"}]' />

## 组合用法：带重试的装饰器

### 组合了哪些知识？

组合了三件事：带参装饰器、闭包计数与错误处理。

### 数据流图解

```text
调用包装函数 ──▶ 尝试执行 ──▶ 成功返回
                        └── 出错 ──▶ 计数加一 ──▶ 未到上限重试
                                              └── 到上限抛出
```

### 分步实现

1. 外层接收参数。例如重试次数。
2. 中层接收函数。返回包装函数。
3. 包装函数里循环。成功即返回。
4. 全部失败抛出最后一个错误。

### 对比表格

| 方案 | 代码量 | 可控性 | 适用 |
|---|---|---|---|
| 手写循环重试 | 多 | 高 | 单处逻辑 |
| 装饰器 | 少 | 中 | 多处复用 |
| 第三方库 | 最少 | 低 | 快速接入 |

## 完整 Demo：带重试的装饰器

### 场景描述

给一个不稳定的函数加重试。最多试三次，失败抛出最后一条错误。

### 完整代码

```python
"""带参装饰器与闭包：失败重试。"""

from functools import wraps
import time

attempts = {"count": 0}


def retry(times=3, delay=0.01):
    def decorate(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last = None
            for index in range(times):
                try:
                    return func(*args, **kwargs)
                except RuntimeError as error:
                    last = error
                    time.sleep(delay * (index + 1))
            raise last
        return wrapper
    return decorate


@retry(times=3)
def flaky():
    attempts["count"] += 1
    if attempts["count"] < 3:
        raise RuntimeError(f"第 {attempts['count']} 次失败")
    return "成功"


if __name__ == "__main__":
    print(flaky())
    print("调用次数:", attempts["count"])
```

### 运行方式

```bash
python3 demo.py
```

输出成功与调用次数 3。把 `times` 改成 1 可以看到错误被抛出。

### 常见误区

- 循环里定义函数不绑当前值。结果全是最后一个。
- 装饰器漏写 `wraps`。堆栈与文档全指向包装层。

### 面试追问链

<details>
<summary>为什么循环里的闭包都拿到最后一个值？</summary>

按名字捕获，共享同一单元格。循环结束后该单元格是最后一项。
</details>

<details>
<summary>怎么固定当前值？</summary>

用默认参数绑定，或再包一层函数。
</details>

<details>
<summary>装饰器能装饰类吗？</summary>

可以。接收类对象并返回新的类即可。
</details>

### 下一讲衔接

下一讲 [上下文管理器](/backend/learn/language-core/context-managers) 讲资源释放。重点是退出时的错误处理。

### 关联组件

暂无。装饰器在组件里用于缓存与重试。
