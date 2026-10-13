# 验收证据（008 组件面向对象重构与教学）

> 打样对象：后端任务服务。源码可动，既有服务用例作为回归网。

## 一、对象化重构（进行中）

| 对象 | 源码位置 | 状态 |
|---|---|---|
| `OutputBuffer` | `service/output.py` | ✅ 已抽出（缓冲、序号、截断、订阅分发） |
| `Task` | `service/registry.py` | ✅ 改为持有 `OutputBuffer` 并委托（对外 API 未变） |
| `TaskRegistry` | `service/registry.py` | ⏳ 待改名并明确边界 |
| `Allowlist` | `service/limits.py` | ⏳ 待拆出 |
| `Executor` / `ChildProcess` / `MetricsSampler` | `service/executor.py` | ⏳ 待拆出 |
| `StreamHub` / `TaskService` | `service/app.py` | ⏳ 待拆出 |

**回归验证**：`python3 -m pytest tests/ -q` → **57 passed / 3 skipped**（对象化未破坏行为）。

## 二、门禁

重构后抽样门禁全绿：`check:content`、`check:component`、`check:experience`、`check:layout`、
`test:component`、`check:pages`、`check:nav`。

## 三、待完成

页面按对象重写（对象模型 / 逐对象成节 / 协作与流程 / 图解 / 删除重复知识点节），
契约章节表 16 → 15 节，门禁 C8 对象断言，另两个组件的对象化。
