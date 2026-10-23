---
title: "配置管理"
type: knowledge
domain: backend
knowledge_domain: engineering
order: 1
level: advanced
tags: [config, environment, layering]
description: "分层配置与环境覆盖：默认值、环境变量与启动检查"
prerequisites:
  - /backend/learn/engineering/secrets
related_knowledge:
  - /backend/learn/engineering/logging
---

### 本讲要解决的问题

同一份代码要在本地、测试与生产运行。
配置怎么分层，才不会把环境差异写进代码。

- 配置的来源与优先级。
- 默认值与环境变量怎么配合。
- 启动时怎么检查配置。

## TL;DR

配置分三层：代码默认值、配置文件与环境变量。
优先级从低到高，环境变量最高。
启动时统一检查，缺字段直接拒绝启动。

## 概念定义

**默认值**：写在代码里的安全值。只用于本地与兜底。

**配置文件**：团队共享的参数。进版本库。

**环境变量**：部署环境特有。不进版本库。

**启动检查**：把配置读成对象并检查必填项。

## 原理图解

下图回答一个问题：本讲在工程化与交付里的位置。

<DiagramFrame src="/diagrams/engineering-map.html" title="工程化与交付地图：运行支撑与交付链路（Archify 交互图）" :height="560" />

```text
代码默认值 ──▶ 配置文件 ──▶ 环境变量 ──▶ 检查 ──▶ 配置对象
优先级：从左到右依次升高
```

## 关键对比

| 来源 | 是否进版本库 | 适用 |
|---|---|---|
| 默认值 | 是 | 本地与兜底 |
| 配置文件 | 是 | 团队共享 |
| 环境变量 | 否 | 部署差异 |

| 读取方式 | 类型安全 | 启动检查 |
|---|---|---|
| 直接读环境变量 | 弱 | 无 |
| 读成数据类 | 强 | 有 |

### 官方依据与版本差异

- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 建议常量集中定义。
- [os 文档](https://docs.python.org/3/library/os.html) — 3.12 起 `os.environ` 接口稳定。
- [PEP 557](https://peps.python.org/pep-0557/) — 3.7 起可用数据类承载配置。

## API 手册：配置读取

### 环境变量

<ApiTable :items='[{"name":"os.environ.get","rank":"必会","signature":"environ.get(key, default=None)","params":[{"name":"key","type":"str","default":"必填","desc":"变量名"},{"name":"default","type":"str","default":"None","desc":"缺省值"}],"returns":"字符串或默认值","effect":"读取环境变量","scenario":"部署参数","example":"import os\n\nport = int(os.environ.get(\"PORT\", \"8080\"))","exampleLang":"python","pitfall":"环境变量都是字符串，要显式转换类型。","raises":"ValueError，转换失败时"},{"name":"os.environ","rank":"必会","signature":"environ[key] = value","params":[{"name":"key","type":"str","default":"必填","desc":"变量名"},{"name":"value","type":"str","default":"必填","desc":"变量值"}],"returns":"无","effect":"写入进程环境","scenario":"测试注入","example":"os.environ[\"MODE\"] = \"test\"","exampleLang":"python","pitfall":"只影响当前进程与子进程。","raises":"KeyError，读取不存在的键时"}]' />

### 启动检查

<ApiTable :items='[{"name":"配置数据类","rank":"必会","signature":"@dataclass(frozen=True)","params":[{"name":"fields","type":"str","default":"必填","desc":"配置字段"}],"returns":"配置对象","effect":"集中字段与默认值","scenario":"应用入口","example":"from dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass Config:\n    host: str = \"0.0.0.0\"\n    port: int = 8080","exampleLang":"python","pitfall":"必填字段要给默认值或显式检查。","raises":"TypeError，缺必填字段时"}]' />

## 组合用法：三层配置装配

### 组合了哪些知识？

组合了三件事：默认值、环境变量与启动检查。

### 数据流图解

```text
默认值 ──▶ 覆盖配置文件 ──▶ 覆盖环境变量 ──▶ 检查 ──▶ 配置对象
```

### 分步实现

1. 在数据类里写安全默认值。
2. 读配置文件。覆盖同名字段。
3. 读环境变量。再次覆盖。
4. 启动时检查范围与类型。不合法直接退出。

### 对比表格

| 阶段 | 出错时机 | 影响 |
|---|---|---|
| 读默认值 | 无 | 无 |
| 读环境变量 | 启动 | 转换失败即退出 |
| 运行期 | 使用处 | 难定位 |

## 完整 Demo：三层配置

### 场景描述

用默认值与环境变量组装配置。端口不合法时拒绝启动。

### 完整代码

```python
"""配置管理：默认值加环境变量，加启动检查。"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    host: str = "127.0.0.1"
    port: int = 8080
    debug: bool = False


def load() -> Config:
    host = os.environ.get("HOST", Config.host)
    port_text = os.environ.get("PORT", str(Config.port))
    debug = os.environ.get("DEBUG", "0") == "1"
    try:
        port = int(port_text)
    except ValueError as error:
        raise ValueError(f"PORT 不是整数：{port_text}") from error
    if not 1 <= port <= 65535:
        raise ValueError(f"PORT 越界：{port}")
    return Config(host=host, port=port, debug=debug)


if __name__ == "__main__":
    os.environ["PORT"] = "9000"
    print(load())
    os.environ["PORT"] = "bad"
    try:
        load()
    except ValueError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出配置对象与一条错误。非法端口在启动阶段就被拦住。

### 常见误区

- 把环境变量当字符串直接拼接。类型错误会推迟到运行期。
- 配置散落在各处读取。改字段名要全仓搜索。

### 面试追问链

<details>
<summary>为什么环境变量优先级最高？</summary>

部署环境差异最大。让部署方无需改代码即可覆盖。
</details>

<details>
<summary>配置文件要不要进版本库？</summary>

要。它记录团队共享的基线。环境差异走环境变量。
</details>

<details>
<summary>启动检查检查哪些？</summary>

必填项、类型与范围。发现不合法立即退出。
</details>

### 下一讲衔接

下一讲 [密钥管理](/backend/learn/engineering/secrets) 讲敏感配置怎么托管。

### 关联组件

暂无。配置在组件里由启动参数注入。
