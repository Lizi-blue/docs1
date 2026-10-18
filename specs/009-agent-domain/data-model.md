# Phase 1 数据模型：Agent 方向的内容实体

> 本专题无运行时数据；实体即**内容结构**。每项给出字段、校验与落点门禁。

## 1. Domain（领域）

| 字段 | 必填 | 说明 | 校验 |
|---|---|---|---|
| name | 是 | 领域显示名（Agent） | 与元数据 schema 一致 |
| icon | 是 | 图标 | 同上 |
| order | 是 | 排序（排在既有三个领域之后） | 整数且不与他人冲突 |
| description | 是 | 一句话定位 | 受控中文门禁 |
| entry_type | 是 | 入口类型 | 枚举内取值 |

**注册规则**：新增领域只落目录与元数据，**不改站点配置**（宪法 II）。落点门禁：内容门禁 + 导航门禁。

## 2. KnowledgeDomain（知识域）

| 字段 | 必填 | 说明 | 校验 |
|---|---|---|---|
| id | 是 | 目录名 | 小写连字符 |
| name | 是 | 显示名 | 受控中文 |
| order | 是 | 域内排序 | 整数 |
| status | 是 | `active` / `outline` | `outline` 时**不得**建页面 |

**落点门禁**：未开写域只登记大纲态、不建空页面（既有门禁已覆盖）。

## 3. Lesson（讲）

| 字段 | 必填 | 说明 | 校验 |
|---|---|---|---|
| title | 是 | 讲标题 | 与基准方向命名风格一致 |
| order | 是 | 域内排序 | 整数 |
| sections | 是 | 四段式小节 | 小节标题与顺序对齐基准方向 |
| elements | 是 | 教学要素 | 齐全缺一即判错 |
| sources | 是 | 官方依据，≥2 条 | 每条带链接 + 适用版本 |
| terms | 是 | 引用术语 | 术语须在术语表出现 |
| questions | 是 | 面试追问链 | 3–5 条递进 |

**落点门禁**：内容门禁（官方依据、层级、导航）+ 受控中文门禁。

## 4. EvolutionStage（演进阶段）

字段：`stage`、`solved`（解决了什么）、`newProblems`（带来什么新问题）、`capabilities[]`、`limits[]`。
**校验**：阶段数量 ≥5；每阶段四要素齐全（对应 SC-002）。

## 5. AgentLoop（最小 agent 循环）

字段：`observation`、`decision`、`action`、`termination`、`failureHandling`。
**校验**：终止条件与失败处理缺一即判错（对应 FR-007）。

## 6. CollaborationTopology / ConcurrencyModel

| 实体 | 字段 | 校验 |
|---|---|---|
| CollaborationTopology | `kind`（主从／对等／流水线）、`whenToUse`、`failureModes[]` | 三类齐全，各含失败模式（SC-004） |
| ConcurrencyModel | `kind`（进程／线程／异步）、`isolation`、`limits`、`cancel`、`backpressure` | 三类齐全，四要素齐（FR-009） |

## 7. CapabilityEntry（平台能力／局限）

字段：`type`（capability／limitation）、`name`、`scenario`、`evidence`（证据来源）、`mitigation`（局限必填规避）。
**校验**：能力 ≥8、局限 ≥6；局限 100% 带规避（SC-005）。

## 8. ServiceEntry / AccessPolicy / MemoryLayer（入口与归属）

| 实体 | 字段 | 校验 |
|---|---|---|
| ServiceEntry | `service`、`addressPattern`、`roles[]`、`memoryOwner` | 每服务独立地址、互不共用（FR-025） |
| AccessPolicy | `role`（只读／操作／管理）、`allowedActions[]`、`auditRequired` | 三角色齐全；越权必拒且留审计（SC-012） |
| MemoryLayer | `layer`（会话／服务／平台）、`owner`、`retention`、`migrationPath` | 三层齐全（FR-032） |

## 9. ResearchCandidate（调研候选）

字段：`name`、`url`、`license`、`activity{lastCommit, archived}`、`scenario`、`cost`、
`decision`（adopt／reference／reject）、`reason`、`fetchedAt`、`source`。
**校验**：每条主题 ≥3 个候选；`fetchedAt` 与 `source` 必填；无来源热度数字 0 处（SC-016/018/023）。

## 10. PublicSafetyRule（公开安全规则）

字段：`pattern`、`scope`、`action`、`fixHint`。
**校验**：扫描命中即失败（SC-021）；规则清单见 `contracts/public-release-safety-contract.md`。

## 11. Diagram（图解）

字段：`id`、`type`（时间线／流程／拓扑／架构）、`nodes[]`、`sourcePath`、`productPath`、`selfContained`。
**校验**：6 张齐全；`selfContained` 为真（无外部资源加载）。

## 实体关系

```text
Domain 1─* KnowledgeDomain 1─* Lesson
Lesson *─* EvolutionStage / AgentLoop / CollaborationTopology / ConcurrencyModel
Lesson *─* CapabilityEntry / ServiceEntry / AccessPolicy / MemoryLayer
Lesson *─* ResearchCandidate / Diagram
全仓 *─1 PublicSafetyRule（横切校验）
```
