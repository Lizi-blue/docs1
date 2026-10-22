---
title: "容器化发布"
type: knowledge
domain: backend
knowledge_domain: engineering
order: 10
level: advanced
tags: [container, healthcheck, rollback]
description: "镜像、健康检查与回滚：发布要能安全退回"
prerequisites:
  - /backend/learn/engineering/code-quality
related_knowledge:
  - /backend/learn/engineering/config-management
---

### 本讲要解决的问题

发布出问题只能干等修复。
没有健康检查，坏版本也在接流量。

### 本讲要解决的问题

- 镜像怎么做得可回滚。
- 健康检查检查什么。
- 回滚要准备什么。

## TL;DR

镜像不可变，用标签区分版本。
就绪检查决定是否接流量，存活检查决定是否重启。
回滚靠切回上一个标签，并预先演练。

## 概念定义

**不可变镜像**：构建后不再改动。

**就绪检查**：依赖就绪才接流量。

**存活检查**：进程卡死时重启。

**回滚**：切回上一个可用版本。

## 原理图解

下图回答一个问题：发布与回滚在交付链路里的位置。

<DiagramFrame src="/diagrams/delivery-pipeline.html" title="一次可回滚的发布：构建、测试、部署与回滚（Archify 交互图）" :height="560" />

```text
构建镜像 ──▶ 部署新标签 ──▶ 就绪检查 ──▶ 接流量
                        └── 失败 ──▶ 切回旧标签
```

## 关键对比

| 检查 | 失败动作 | 目的 |
|---|---|---|
| 就绪 | 不接流量 | 避免坏版本收请求 |
| 存活 | 重启 | 恢复卡死进程 |

| 回滚方式 | 速度 | 风险 |
|---|---|---|
| 切标签 | 快 | 低 |
| 重新构建 | 慢 | 中 |

### 官方依据与版本差异

- [signal 文档](https://docs.python.org/3/library/signal.html) — 3.12 起信号处理接口稳定，用于优雅退出。
- [HTTP 状态码](https://developer.mozilla.org/docs/Web/HTTP/Status) — HTTP/1.1 定义健康检查返回码语义。
- [PEP 8](https://peps.python.org/pep-0008/) — PEP 8 建议入口与配置分离。

## API 手册：发布相关

### 进程与信号

<ApiTable :items='[{"name":"signal.signal","rank":"必会","signature":"signal(SIGTERM, handler)","params":[{"name":"handler","type":"callable","default":"必填","desc":"信号处理函数"}],"returns":"旧处理函数","effect":"优雅退出","scenario":"容器停止","example":"import signal\n\nsignal.signal(signal.SIGTERM, lambda *_: exit(0))","exampleLang":"python","pitfall":"退出前要停止接新请求并等待在途请求。","raises":"ValueError，非主线程注册时"}]' />

### 健康检查

<ApiTable :items='[{"name":"就绪返回","rank":"必会","signature":"GET /ready","params":[],"returns":"200 或 503","effect":"告知是否接流量","scenario":"滚动发布","example":"GET /ready -> 200","exampleLang":"http","pitfall":"把就绪检查做成全量依赖探测，会让发布长时间卡住。","raises":"无"},{"name":"存活返回","rank":"必会","signature":"GET /health","params":[],"returns":"200","effect":"告知进程是否存活","scenario":"异常重启","example":"GET /health -> 200","exampleLang":"http","pitfall":"存活检查不要依赖下游，否则下游抖动会触发全量重启。","raises":"无"}]' />

## 组合用法：滚动发布与回滚

### 组合了哪些知识？

组合了三件事：不可变镜像、就绪检查与回滚。

### 数据流图解

```text
构建 ──▶ 部署新标签 ──▶ 等就绪 ──▶ 接流量 ──▶ 失败切回旧标签
```

### 分步实现

1. 构建镜像并打唯一标签。
2. 部署新标签。旧版本保持可用。
3. 等就绪检查通过再切流量。
4. 失败立刻切回旧标签，并保留现场。

### 对比表格

| 策略 | 中断时间 | 复杂度 |
|---|---|---|
| 全量替换 | 长 | 低 |
| 滚动 | 短 | 中 |
| 蓝绿 | 最短 | 高 |

## 完整 Demo：优雅退出

### 场景描述

收到停止信号后停止接新请求，等待在途任务结束。

### 完整代码

```python
"""容器发布：优雅退出的最小骨架。"""

import signal
import threading
import time

stopping = threading.Event()


def on_term(signum, frame):
    stopping.set()


def serve() -> None:
    while not stopping.is_set():
        time.sleep(0.05)
    print("停止接新请求")
    time.sleep(0.1)
    print("在途任务已结束")


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, on_term)
    worker = threading.Thread(target=serve)
    worker.start()
    time.sleep(0.1)
    print("模拟收到停止信号")
    stopping.set()
    worker.join()

```

### 运行方式

```bash
python3 demo.py
```

输出停止流程。真实服务里在这两步之间完成在途请求收尾。

### 常见误区

- 镜像用 latest 标签。回滚时分不清版本。
- 没有就绪检查。坏版本一上线就接流量。

### 面试追问链

<details>
<summary>就绪与存活检查为什么分开？</summary>

一个决定接流量，一个决定重启。混用会放大故障。
</details>

<details>
<summary>回滚前要确认什么？</summary>

旧版本可用、数据兼容，且回滚命令演练过。
</details>

<details>
<summary>优雅退出为什么重要？</summary>

避免在途请求被硬切断，也避免重复处理。
</details>

### 下一讲衔接

本域结束。下一域 [类型系统与类型检查](/backend/learn/type-system/typing-basics) 已在前文，可回看对照。

### 关联组件

暂无。组件以同一套容器规范交付。
