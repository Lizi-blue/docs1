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

## 三、第二轮（对象化收口 + 图解）

### 源码对象化：七个对象全部落地

| 对象 | 源码 | 验证 |
|---|---|---|
| `OutputBuffer` | `service/output.py` | 委托后 57 用例通过 |
| `ChildProcess` / `MetricsSampler` | `service/process.py`（新） | Executor 改为组合二者 |
| `Allowlist` | `service/limits.py` | `Limits` 组合它，对外接口不变 |
| `TaskRegistry` | `service/registry.py` | 由 `Registry` 改名，保留别名 |
| `StreamHub` | `service/stream.py`（新） | `TaskServer` 持有，`_stream` 改用它 |
| `Task` | `service/registry.py` | 持有 `OutputBuffer` |

回归：`pytest tests/ -q` → **57 passed / 3 skipped**（对象化过程中 3 次回归失败均由用例当场抓出）。

### 页面（契约升为 18 节）

- 契约新增「对象模型」「对象层级」「对象协作与流程」三节，删除重复的「涉及的知识点」；
  「核心源码」按 001 门禁 V8 要求保留原名。
- `03-task-console.md`：对象模型 7 对象；对象层级 3 组继承 + 组合表；对象协作与流程两条流程各 8 步。
- `01-safe-queue.md`：对象模型 3 对象；对象层级写明无继承；两条流程含失败与超时路径。
- 迁移期清单 `scripts/data/oo-rollout.txt` 登记两页；前端页留 2 条迁移告警。

### 图解（Archify，自包含）

| 图 | 源 | 产物 | 内容 |
|---|---|---|---|
| 对象关系 | `diagrams/src/task-service-objects.architecture.json` | `docs/public/diagrams/task-service-objects.html` | 继承边（虚线）与持有边（实线），覆盖 3 组父/子 |
| 下发到完成时序 | `diagrams/src/task-service-submit.sequence.json` | `docs/public/diagrams/task-service-submit.html` | 8 个参与对象、11 条消息 |

门禁新增 **C10**：页面的对象关系图必须包含「对象模型」表中的全部对象名（负例已验证会判红）。
生成过程中按 Archify 校验调过三处：卡片结构 `dot/items`、消息间距 ≥28px、画布 1080×660（小字号投影 ≥6px）。

## 四、待完成

页面按对象重写（对象模型 / 逐对象成节 / 协作与流程 / 图解 / 删除重复知识点节），
契约章节表 16 → 15 节，门禁 C8 对象断言，另两个组件的对象化。
