---
title: "打包与依赖治理"
type: knowledge
domain: backend
knowledge_domain: engineering
order: 8
level: advanced
tags: [packaging, pyproject, locking]
description: "打包、锁文件与依赖治理：构建可复现"
prerequisites:
  - /backend/learn/engineering/property-testing
related_knowledge:
  - /backend/learn/engineering/code-quality
---

### 本讲要解决的问题

本地能跑，换台机器就装不上。
依赖版本漂移，构建不可复现。

### 本讲要解决的问题

- 项目元数据写在哪。
- 锁文件的作用。
- 依赖怎么治理。

## TL;DR

项目元数据放 pyproject。构建后端由声明决定。
锁文件固定全部依赖版本。
直接依赖写范围，间接依赖交给锁文件。

## 概念定义

**pyproject**：项目元数据与构建配置。

**构建后端**：负责把源码打成包。

**锁文件**：记录完整依赖树与版本。

**可复现构建**：同一输入得到同一产物。

## 原理图解

下图回答一个问题：打包在交付链路里的位置。

<DiagramFrame src="/diagrams/delivery-pipeline.html" title="一次可回滚的发布：构建、测试、部署与回滚（Archify 交互图）" :height="560" />

```text
源码 ──▶ 读 pyproject ──▶ 装依赖并锁版本 ──▶ 构建产物 ──▶ 发布
```

## 关键对比

| 元数据位置 | 现状 | 建议 |
|---|---|---|
| setup.py | 旧写法 | 仅兼容保留 |
| pyproject | 标准 | 新项目使用 |

| 依赖写法 | 可复现 | 升级可控 |
|---|---|---|
| 只写范围 | 差 | 好 |
| 范围加锁 | 好 | 好 |

### 官方依据与版本差异

- [PEP 621](https://peps.python.org/pep-0621/) — PEP 621 规定项目元数据字段。
- [PEP 517](https://peps.python.org/pep-0517/) — 3.7 起支持声明构建后端。
- [importlib.metadata 文档](https://docs.python.org/3/library/importlib.metadata.html) — 3.12 起读取已安装元数据接口稳定。

## API 手册：元数据与版本

### 项目元数据

<ApiTable :items='[{"name":"project.name","rank":"必会","signature":"[project] name = \"app\"","params":[{"name":"name","type":"str","default":"必填","desc":"包名"}],"returns":"元数据字段","effect":"声明包身份","scenario":"所有项目","example":"[project]\nname = \"app\"\nversion = \"1.0.0\"","exampleLang":"toml","pitfall":"包名与导入名可以不同，别混用。","raises":"无"},{"name":"project.dependencies","rank":"必会","signature":"dependencies = [\"requests>=2\"]","params":[{"name":"range","type":"str","default":"必填","desc":"版本范围"}],"returns":"依赖列表","effect":"声明直接依赖","scenario":"运行时依赖","example":"dependencies = [\"requests>=2,<3\"]","exampleLang":"toml","pitfall":"写成固定版本会阻碍安全更新。用范围加锁。","raises":"无"}]' />

### 读取已安装版本

<ApiTable :items='[{"name":"version","rank":"常用","signature":"metadata.version(name)","params":[{"name":"name","type":"str","default":"必填","desc":"分发包名"}],"returns":"版本字符串","effect":"运行时读取版本","scenario":"健康检查与日志","example":"from importlib.metadata import version\nprint(version(\"app\"))","exampleLang":"python","pitfall":"传错包名会抛 PackageNotFoundError。","raises":"PackageNotFoundError，包未安装时"}]' />

## 组合用法：可复现构建

### 组合了哪些知识？

组合了三件事：元数据、锁与构建。

### 数据流图解

```text
写元数据 ──▶ 生成锁文件 ──▶ 按锁安装 ──▶ 构建产物 ──▶ 校验哈希
```

### 分步实现

1. 元数据写 pyproject。字段最小化。
2. 生成锁文件并入库。
3. 构建时按锁安装。禁止隐式升级。
4. 记录产物哈希。便于比对。

### 对比表格

| 方案 | 可复现 | 升级成本 |
|---|---|---|
| 只装最新 | 差 | 低 |
| 锁文件 | 好 | 中 |
| 锁加哈希 | 最好 | 中 |

## 完整 Demo：读取版本与依赖

### 场景描述

读项目元数据里的依赖范围，并输出已安装版本。

### 完整代码

```python
"""打包：元数据与版本读取。"""

import tomllib
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path


def read_project(path: Path) -> dict:
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    project = data.get("project")
    if not project:
        raise ValueError("缺少 [project] 段")
    return project


if __name__ == "__main__":
    sample = Path("pyproject.toml")
    sample.write_text('[project]\nname = "app"\nversion = "1.0.0"\n', encoding="utf-8")
    project = read_project(sample)
    print("项目:", project["name"], project["version"])
    try:
        print("已安装:", version("app"))
    except PackageNotFoundError:
        print("已安装: 未安装")
    sample.unlink()

```

### 运行方式

```bash
python3 demo.py
```

输出项目名与版本。样例文件用完即删，不留残留。

### 常见误区

- 把依赖固定成单一版本。安全更新被卡住。
- 锁文件不入库。每台机器装的都不同。

### 面试追问链

<details>
<summary>pyproject 与传统 setup.py 的区别？</summary>

元数据与构建解耦。构建后端可替换。
</details>

<details>
<summary>锁文件要不要进版本库？</summary>

要。它保证部署与本地一致。
</details>

<details>
<summary>间接依赖怎么管？</summary>

交给锁文件。直接依赖只写范围。
</details>

### 下一讲衔接

下一讲 [代码质量门禁](/backend/learn/engineering/code-quality) 讲静态检查。

### 关联组件

暂无。组件按同一套元数据规范发布。
