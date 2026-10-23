---
title: "密钥管理"
type: knowledge
domain: backend
knowledge_domain: engineering
order: 2
level: advanced
tags: [secrets, rotation, least-privilege]
description: "密钥托管、轮换与最小权限：不把凭据写进仓库"
prerequisites:
  - /backend/learn/engineering/config-management
related_knowledge:
  - /backend/learn/engineering/logging
---

### 本讲要解决的问题

密钥一旦进仓库就等于公开。
怎么托管，怎么轮换，怎么限制范围。

- 密钥的托管位置。
- 轮换期间的兼容做法。
- 最小权限怎么落。

## TL;DR

密钥只放密钥管理系统或部署环境的变量里。
仓库里只出现占位符与读取代码。
轮换要支持新旧并存，权限按需最小化。

## 概念定义

**密钥管理系统**：集中存放与审计密钥。

**环境注入**：部署时把密钥放进程环境。

**轮换**：定期更换。新旧并存一段时间。

**最小权限**：只给完成任务所需的权限。

## 原理图解

下图回答一个问题：本讲在工程化与交付里的位置。

<DiagramFrame src="/diagrams/engineering-map.html" title="工程化与交付地图：运行支撑与交付链路（Archify 交互图）" :height="560" />

```text
密钥系统 ──▶ 部署注入 ──▶ 进程环境 ──▶ 应用读取
仓库里只有读取代码与占位符
```

## 关键对比

| 存放位置 | 安全 | 可审计 |
|---|---|---|
| 代码与配置 | 最差 | 无 |
| 环境变量 | 中 | 弱 |
| 密钥管理系统 | 好 | 强 |

| 轮换方式 | 中断风险 | 实现成本 |
|---|---|---|
| 直接替换 | 高 | 低 |
| 新旧并存 | 低 | 中 |

### 官方依据与版本差异

- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 建议常量与敏感值分离。
- [os 文档](https://docs.python.org/3/library/os.html) — 3.12 起进程环境读取接口稳定。
- [logging 文档](https://docs.python.org/3/library/logging.html) — 3.12 起日志过滤接口稳定。

## API 手册：密钥读取

### 读取与检查

<ApiTable :items='[{"name":"os.environ","rank":"必会","signature":"environ.get(name)","params":[{"name":"name","type":"str","default":"必填","desc":"密钥变量名"}],"returns":"字符串或 None","effect":"读取注入的密钥","scenario":"服务启动","example":"token = os.environ.get(\"API_TOKEN\")\nif not token:\n    raise RuntimeError(\"缺少 API_TOKEN\")","exampleLang":"python","pitfall":"缺失时不要退化为空字符串，要直接拒绝启动。","raises":"RuntimeError，缺失时主动抛出"}]' />

### 防泄漏

<ApiTable :items='[{"name":"日志脱敏","rank":"必会","signature":"filter(record)","params":[{"name":"record","type":"LogRecord","default":"必填","desc":"日志记录"}],"returns":"是否放行","effect":"拦敏感字段","scenario":"全局日志","example":"class Mask(logging.Filter):\n    def filter(self, record):\n        record.msg = str(record.msg).replace(\"token=\", \"token=***\")\n        return True","exampleLang":"python","pitfall":"只拦日志不够。异常栈与请求体也要处理。","raises":"无"}]' />

## 组合用法：启动读取与轮换

### 组合了哪些知识？

组合了三件事：读取、检查与新旧并存。

### 数据流图解

```text
部署注入新旧密钥 ──▶ 应用优先用新 ──▶ 失败回退旧 ──▶ 观察期后移除旧
```

### 分步实现

1. 部署时同时注入新旧两个密钥。
2. 应用优先用新密钥。
3. 调用失败且是鉴权错误时回退旧密钥。
4. 观察期结束移除旧密钥。

### 对比表格

| 阶段 | 应用行为 | 风险 |
|---|---|---|
| 并存 | 优先新，回退旧 | 低 |
| 切换 | 只用新 | 中 |
| 清理 | 旧密钥移除 | 低 |

## 完整 Demo：密钥读取与轮换

### 场景描述

同时提供新旧密钥。优先新密钥，鉴权错误时回退。

### 完整代码

```python
"""密钥管理：读取、缺失拒绝与轮换回退。"""

import os


def read_keys() -> list[str]:
    keys = [os.environ.get("TOKEN_NEW"), os.environ.get("TOKEN_OLD")]
    return [key for key in keys if key]


def call_api(fn, keys: list[str]) -> str:
    if not keys:
        raise RuntimeError("没有可用密钥")
    last = None
    for key in keys:
        try:
            return fn(key)
        except PermissionError as error:
            last = error
    raise last


if __name__ == "__main__":
    os.environ["TOKEN_NEW"] = "new"
    os.environ["TOKEN_OLD"] = "old"

    def fake(key: str) -> str:
        if key == "new":
            raise PermissionError(f"密钥被拒：{key}")
        return f"成功:{key}"

    print(call_api(fake, read_keys()))
    os.environ.pop("TOKEN_NEW")
    os.environ.pop("TOKEN_OLD")
    try:
        call_api(fake, read_keys())
    except RuntimeError as error:
        print("错误:", error)
```

### 运行方式

```bash
python3 demo.py
```

输出回退成功与一条缺失错误。仓库里没有任何密钥明文。

### 常见误区

- 把密钥写进配置文件并提交。等同于公开。
- 轮换时直接替换。旧请求全部失败。

### 面试追问链

<details>
<summary>密钥为什么不能进仓库？</summary>

版本库会被克隆与镜像。写入即视为泄漏。
</details>

<details>
<summary>环境变量足够安全吗？</summary>

比明文好。仍要限制进程权限，并避免打印到日志。
</details>

<details>
<summary>轮换要准备什么？</summary>

新旧并存、回退逻辑与观察期。还要能快速回滚。
</details>

### 下一讲衔接

下一讲 [结构化日志](/backend/learn/engineering/logging) 讲日志字段与上下文。

### 关联组件

暂无。密钥由部署环境注入，组件不保存。
