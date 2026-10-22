---
title: "上下文管理器"
type: knowledge
domain: backend
knowledge_domain: language-core
order: 7
level: advanced
tags: [context-manager, with, contextlib, cleanup]
description: "with 块怎么保证释放，错误路径怎么走"
prerequisites:
  - /backend/learn/language-core/decorators-closures
related_knowledge:
  - /backend/learn/language-core/exceptions
---

### 本讲要解决的问题

`with` 到底做了哪两步。
块里出错时释放还会执行吗。
多个资源怎么写才不出错。

### 本讲要解决的问题

- 进入与退出的调用约定。
- 出错路径的处理方式。
- 多个资源的组合写法。

## TL;DR

`with` 调用 `__enter__` 取资源，退出时必调 `__exit__`。
`__exit__` 返回真值会吞掉错误。
多个资源用一条 `with` 或 `ExitStack`。后者更适合数量不定时。

## 概念定义

**上下文管理器**：实现 `__enter__` 与 `__exit__` 的对象。

**`__enter__`**：进入时调用。返回值给 `as` 变量。

**`__exit__`**：退出时调用。接收类型、值与回溯三个参数。

**吞掉错误**：`__exit__` 返回真值时，块内错误不再向外传播。

**`ExitStack`**：动态管理多个上下文。按相反顺序退出。

## 原理图解

下图回答一个问题：本讲在语言核心机制里的位置与依赖。

<DiagramFrame src="/diagrams/language-core-map.html" title="语言核心机制地图：协议与工程五讲（Archify 交互图）" :height="560" />

```text
with 语句 ──▶ __enter__ ──▶ 执行块
                     ├── 正常结束 ──▶ __exit__(None, None, None)
                     └── 出错 ──▶ __exit__(类型, 值, 回溯)
                                        ├── 返回真 ──▶ 错误被吞
                                        └── 返回假 ──▶ 错误继续抛
```

## 关键对比

| 写法 | 保证释放 | 多个资源 | 适用 |
|---|---|---|---|
| `try/finally` | 是 | 要嵌套 | 简单场景 |
| `with` | 是 | 一条语句可写多个 | 常规 |
| `ExitStack` | 是 | 数量不定 | 动态组合 |

| `__exit__` 返回值 | 块内错误 | 结果 |
|---|---|---|
| `None` 或 `False` | 存在 | 继续向外抛 |
| 真值 | 存在 | 被吞掉 |
| 任意 | 无 | 无影响 |

### 官方依据与版本差异

- [with 语句](https://docs.python.org/3/reference/compound_stmts.html#the-with-statement) — 3.12 起语义未变。
- [contextlib 文档](https://docs.python.org/3/library/contextlib.html) — 3.11 起 `ExitStack` 接口稳定。
- [PEP 343](https://peps.python.org/pep-0343/) — 2.5 起提供 `with` 语句。

## API 手册：上下文协议

### 协议方法

<ApiTable :items='[{"name":"__enter__","rank":"必会","signature":"__enter__(self)","params":[],"returns":"交给 as 变量的对象","effect":"获取资源","scenario":"打开文件或连接","example":"class Res:\n    def __enter__(self):\n        return self\n    def __exit__(self, *exc):\n        return False","exampleLang":"python","pitfall":"返回值不是自身时，as 拿到的是返回值。","raises":"错误原样向外抛"},{"name":"__exit__","rank":"必会","signature":"__exit__(self, exc_type, exc, tb)","params":[{"name":"exc_type","type":"type","default":"None","desc":"错误类型"},{"name":"exc","type":"BaseException","default":"None","desc":"错误实例"},{"name":"tb","type":"traceback","default":"None","desc":"回溯对象"}],"returns":"布尔值或 None","effect":"释放资源并决定是否吞掉错误","scenario":"所有清理逻辑","example":"def __exit__(self, exc_type, exc, tb):\n    self.close()\n    return False","exampleLang":"python","pitfall":"返回真值会吞掉错误，调试时很难发现。","raises":"清理本身出错时会替换原错误"}]' />

### contextlib 工具

<ApiTable :items='[{"name":"contextlib.contextmanager","rank":"常用","signature":"contextmanager(func)","params":[{"name":"func","type":"callable","default":"必填","desc":"生成器函数"}],"returns":"装饰器","effect":"用生成器写上下文管理器","scenario":"一次性资源封装","example":"from contextlib import contextmanager\n\n@contextmanager\ndef opened(path):\n    handle = open(path)\n    try:\n        yield handle\n    finally:\n        handle.close()","exampleLang":"python","pitfall":"yield 只能出现一次。异常要在 finally 里清理。","raises":"生成器内抛出的错误会传给调用方"},{"name":"contextlib.ExitStack","rank":"常用","signature":"ExitStack()","params":[],"returns":"上下文管理器","methods":["enter_context(cm) — 登记一个上下文","callback(fn, *args) — 登记退出回调","close() — 按相反顺序退出"],"effect":"动态管理多个资源","scenario":"资源数量在运行时确定","example":"from contextlib import ExitStack\n\nwith ExitStack() as stack:\n    files = [stack.enter_context(open(p)) for p in paths]","exampleLang":"python","pitfall":"全部退出在 with 结束时发生，不要提前依赖释放。","raises":"退出阶段的错误会合并抛出"}]' />

## 组合用法：资源池式打开多个文件

### 组合了哪些知识？

组合了三件事：`with` 协议、`ExitStack` 与错误传播。

### 数据流图解

```text
进入 with ──▶ 逐个登记资源 ──▶ 使用资源
退出 with ──▶ 逆序释放 ──▶ 汇总错误
```

### 分步实现

1. 建 `ExitStack`。用一条 `with` 管住。
2. 逐个登记。数量由运行时决定。
3. 使用资源。失败会走退出路径。
4. 退出时逆序释放。先开的后关。

### 对比表格

| 场景 | 写法 | 风险 |
|---|---|---|
| 固定两个资源 | 一条 `with a, b:` | 顺序写反难查 |
| 数量不定 | `ExitStack` | 忘记登记会泄漏 |
| 需要条件释放 | `stack.callback` | 回调顺序要留意 |

## 完整 Demo：安全打开多个文件

### 场景描述

打开两个文件，读取内容。第二个打不开时，第一个仍要关闭。

### 完整代码

```python
"""上下文管理：一条 with 与 ExitStack。"""

from contextlib import ExitStack
import pathlib
import tempfile


def read_all(paths):
    with ExitStack() as stack:
        handles = [stack.enter_context(open(p, encoding="utf-8")) for p in paths]
        return [handle.read() for handle in handles]


if __name__ == "__main__":
    folder = pathlib.Path(tempfile.mkdtemp())
    first = folder / "a.txt"
    second = folder / "b.txt"
    first.write_text("甲", encoding="utf-8")
    second.write_text("乙", encoding="utf-8")
    print(read_all([first, second]))
    handles = [path for path in folder.iterdir()]
    print("文件数:", len(handles))
```

### 运行方式

```bash
python3 demo.py
```

输出两个文件的读取结果。把第二个路径改错，可以看到错误照常抛出，第一个文件已被关闭。

### 常见误区

- 在 `__exit__` 里返回真值。错误被吞掉，调用方看不到。
- 手动 `close` 又用 `with`。重复释放可能抛错误。

### 面试追问链

<details>
<summary>__exit__ 的参数什么时候为空？</summary>

块内没出错时三个参数都是 None。
</details>

<details>
<summary>contextmanager 与手写类怎么选？</summary>

一次性的用生成器写法。需要复用或带状态时写类。
</details>

<details>
<summary>ExitStack 的释放顺序？</summary>

与登记顺序相反。先登记的后释放。
</details>

### 下一讲衔接

下一讲 [迭代器与生成器](/backend/learn/language-core/iterators-generators) 讲另一种暂停恢复机制。重点是生成器的状态保存。

### 关联组件

暂无。组件里用它管理连接与临时文件。
