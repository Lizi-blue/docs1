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

## 四、第三轮（三页齐活 + 逐对象成节 + 前端对象化）

### 后端页逐对象成节（T013–T015）

- 「对象模型」加 7 个对象小节，每节固定四块（职责、持有、方法、边界）+ 两列（谁调用它、它调用谁）
- 「API 手册」三组改名与对象同名：`TaskHandler`、`StreamHub`、`Executor`
- 「核心源码」按对象分块：`TaskHandler`/`TaskServer`/`Allowlist`/`Task`/`TaskRegistry`/`OutputBuffer`/
  `StreamHub`/`Executor`/`ChildProcess`/`MetricsSampler`，代码从 `service/*.py` 直接提取

### 前端对象化（T025）

- 新增 `docs/.vitepress/theme/components/task-console/api.ts`：`ApiClient`（请求、JSON 解析、错误体映射）
- 新增 `…/task-console/stream.ts`：`EventStream`（建连、三类事件转发、关连接）
- `TaskConsole.vue` 改为委托两个对象（调用点与响应式状态未动；`request`/`messageOf` 变薄封装）
- 前端页补「对象模型（3 对象 + 逐对象三节）」「对象层级（无继承）」「对象协作与流程（提交到看到输出 / 服务不可用降级）」
- 「API 手册」三组改名与对象同名：`TaskConsole`、`EventStream`、`ApiClient`

### 队列页逐对象成节

- 「对象模型」加 3 个对象小节（`SafeQueue`/`TaskResult`/`_worker`），每节同样四块 + 两列
- 「API 手册」两组改名：`SafeQueue`、`TaskResult`

### 门禁与迁移收口

- 新增 **C8**：对象清单行数 MUST 等于对象小节数，且对象名 MUST 能在登记的源码里找到
  （登记表 `scripts/data/component-objects.json`；负例：清单塞假对象 → 判红）
- 迁移期清单 `scripts/data/oo-rollout.txt` 与门禁分支**已删除**：对象三节改为始终必需
- 门禁自测正例夹具补上对象三节（G16 恢复通过）
- 复用清单 `reuse/task-console/manifest.json` 升 1.1.0，补两个前端对象文件

### 本轮验证

- `pytest tests/ -q` → **57 passed / 3 skipped**；`pytest tests/test_reuse_manifest.py -q` → 11 passed
- 十三条门禁 → **13/13 全绿**；`selftest:gates` 全部符合预期（含 G16 正例恢复）
- 前端重构静态复核（产物 JS）：`EventSource` 13 处、`stream?from=` 1 处、`Last-Event-ID` 5 处、`aria-live` 1 处

## 五、闭环验收（2026-10-14 01:xx）

| 项 | 结果 |
|---|---|
| 内网流水线 | Gitea CI **#4783** 全绿（构建 + 部署） |
| 三页对象内容 | 后端任务服务、进程安全队列、前端控制台：对象模型 / 对象层级 / 对象协作与流程 各 1 处；「涉及的知识点」**0** 处 |
| 对象小节 | 线上锚点已生成：`#apiclient`、`#eventstream`、`#taskconsole`（侧栏可见），后端页含 7 个对象锚点 |
| 图解 | `/diagrams/task-service-objects.html`、`/diagrams/task-service-submit.html` 均 200 |
| 服务端到端 | `/health` 200；`sha256sum` 任务 `succeeded`（退出码 0、80 字节）；SSE 首帧 `event: status` |
| 公网 | 首页 200；后端页对象模型内容已同步（镜像链路正常） |
| 门禁 | 十三条 13/13；`selftest:gates` 全部符合预期（G16 正例恢复） |
| 单测 | `pytest tests/ -q` → 57 passed / 3 skipped |

**T028 部署验收完成，008 三页对象化全部落地。**


页面按对象重写（对象模型 / 逐对象成节 / 协作与流程 / 图解 / 删除重复知识点节），
契约章节表 16 → 15 节，门禁 C8 对象断言，另两个组件的对象化。
