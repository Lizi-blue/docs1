---
description: "Task list for Agent 方向（演进、原理、平台与落地实践）"
---

# Tasks: Agent 方向（演进、原理、平台与落地实践）

**Input**: Design documents from `/specs/009-agent-domain/`

**Prerequisites**: [spec.md](./spec.md)（7 US / 54 FR / 23 SC）· [plan.md](./plan.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) · [quickstart.md](./quickstart.md)

## Format: `[ID] [P?] [Story] Description`

- 每个任务给出确切文件路径，并在末尾标注覆盖的需求
- 本专题**不产出项目代码**：除门禁脚本外不新增源码，不改被调研项目（FR-041）

## Path Conventions

- 内容：`docs/agent/**`（领域元数据 + 知识域 + 讲）
- 图解：源 `diagrams/src/**`，产物 `docs/public/diagrams/**`
- 门禁与登记：`scripts/**`
- 规格证据：`specs/009-agent-domain/**`

---

## Phase 1: Setup（共享骨架）

- [x] T001 新建领域元数据 `docs/agent/_meta.yml`，字段按 `specs/009-agent-domain/contracts/domain-metadata-contract.md`：名称、图标、顺序、描述、入口类型（覆盖 FR-001、FR-050）
- [x] T002 [P] 新建 6 个知识域目录与各自 `docs/agent/<域>/_meta.yml`（evolution / collaboration / platform / service-entry / landscape / practice），未开写的域标大纲态（覆盖 FR-051、FR-019）
- [x] T003 [P] 在 `docs/agent/index.md` 建术语表小节（≥12 个术语，可锚点跳转）（覆盖 FR-004）
- [x] T004 读基准方向 `docs/backend/learn/**` 提取四段式、教学要素与官方依据格式，落成写作模板 `specs/009-agent-domain/checklists/lesson-template.md`（覆盖 FR-052、FR-053）
- [x] T005 [P] 建调研登记文件 `scripts/data/research-registry.json`，字段按 `specs/009-agent-domain/contracts/research-entry-contract.md`（覆盖 FR-036、FR-037）
- [x] T006 [P] 建公开安全禁词表 `scripts/data/public-safety-banned.json`，规则按 `specs/009-agent-domain/contracts/public-release-safety-contract.md`（覆盖 FR-044、FR-048）

## Phase 2: Foundational（阻塞项，先于所有故事）

- [x] T007 实现门禁 `scripts/check-public-safety.mjs`：扫描 `docs/**`、`specs/**`、`schemas/**` 与根文件，命中禁词即失败并给修复提示（覆盖 FR-048、SC-021）
- [x] T008 [P] 在 `package.json` 注册 `check:public-safety` 命令，并在 `AGENTS.md` §2 命令清单增补说明（覆盖 FR-048）
- [x] T009 [P] 在两条发布链路接入新门禁（`scripts/check-public-safety.mjs`）：`.gitea/workflows/ci.yaml` 与 `.github/workflows/pages.yml`（覆盖 SC-021）
- [x] T010 用原生 HTTPS 取一轮公开数据并落实测记录（含抓取日期与来源）到 `specs/009-agent-domain/research.md` 附录（覆盖 FR-035、FR-037）
- [x] T011 确认公开镜像可见范围（整仓还是仅站点产物），结论写入 `specs/009-agent-domain/research.md` 的 R3 与 `specs/009-agent-domain/checklists/local-baseline.md`（覆盖 FR-044）
- [x] T012 依 T011 结论决定历史文件脱敏组（T049）是否执行，判定依据记入 `specs/009-agent-domain/research.md`，并把判定写入 `specs/009-agent-domain/checklists/local-baseline.md`（覆盖 FR-044）

## Phase 3: User Story 1 - 从基础问答走到 agent 的主线（Priority: P1）🎯 MVP

**Goal**: 主线阶段 ≥5，每阶段写清「解决了什么／带来什么新问题／能力／局限」。

**Independent Test**: 打开领域首页按主线读完，任一阶段页四要素齐全。

- [x] T013 [US1] 写讲 A1 `docs/agent/evolution/01-from-qa-to-tools.md`（基础问答 → 上下文与提示 → 工具调用）（覆盖 FR-002、FR-003）
- [x] T014 [P] [US1] 写讲 A2 `docs/agent/evolution/02-planning-and-loop.md`（规划与循环；含 agent 与「带工具的聊天」分界判据）（覆盖 FR-003、FR-006）
- [x] T015 [P] [US1] 写讲 A3 `docs/agent/evolution/03-minimal-agent.md`（最小 agent：循环、工具、终止条件、失败处理；示例或伪代码）（覆盖 FR-007）
- [x] T016 [US1] 在 `docs/agent/index.md` 排学习路径，主线阶段按先后排列且 ≥5（覆盖 FR-002）
- [x] T017 [US1] 产图解演进时间线：源 `diagrams/src/agent-evolution-timeline.architecture.json`，产物 `docs/public/diagrams/agent-evolution-timeline.html`（覆盖 FR-022）
- [x] T018 [US1] 三讲补齐官方依据（每讲 ≥2 条带适用版本）与面试追问链（3–5 条）：`docs/agent/evolution/01-from-qa-to-tools.md`、`docs/agent/evolution/02-planning-and-loop.md`、`docs/agent/evolution/03-minimal-agent.md`（覆盖 FR-053、FR-052）
- [x] T019 [US1] 跑 `npm run check:content`、`npm run check:zh`、`npm run check:nav` 并记录结果到 `specs/009-agent-domain/checklists/local-baseline.md`（覆盖 SC-009）

## Phase 4: User Story 2 - 原理：定义、最小实现、协同、并发（Priority: P1）

**Goal**: 协同 ≥3 类拓扑、并发 ≥3 类模型，各带失败模式；给出「该用/不该用 agent」判据。

**Independent Test**: 按示例理解最小 agent；对三类拓扑与三类并发各说出一个失败模式。

- [ ] T020 [US2] 写讲 B1 `docs/agent/collaboration/01-topologies.md`（主从／对等／流水线 + 适用与失败模式）（覆盖 FR-008）
- [ ] T021 [US2] 写讲 B2 `docs/agent/collaboration/02-concurrency-and-isolation.md`（进程／线程／异步 + 隔离、限额、取消、背压）（覆盖 FR-009）
- [ ] T022 [P] [US2] 写讲 B3 `docs/agent/collaboration/03-cost-and-circuit-breaker.md`（成本上限、死循环与熔断）（覆盖 FR-009）
- [x] T023 [P] [US2] 产图解最小 agent 循环：源 `diagrams/src/agent-minimal-loop.sequence.json`，产物 `docs/public/diagrams/agent-minimal-loop.html`（覆盖 FR-022）
- [ ] T024 [P] [US2] 产图解协同拓扑：源 `diagrams/src/agent-collaboration-topologies.architecture.json`，产物 `docs/public/diagrams/agent-collaboration-topologies.html`（覆盖 FR-008）
- [ ] T025 [P] [US2] 产图解并发隔离：源 `diagrams/src/agent-concurrency-isolation.architecture.json`，产物 `docs/public/diagrams/agent-concurrency-isolation.html`（覆盖 FR-009）
- [ ] T026 [US2] 把「该用/不该用 agent」判据清单落到 `docs/agent/collaboration/01-topologies.md` `docs/agent/collaboration/_meta.yml` 指向的域首页（覆盖 FR-010）

## Phase 5: User Story 3 - 平台的能力与局限（Priority: P1）

**Goal**: 能力 ≥8 条（含证据来源）、局限 ≥6 条（含规避方式），给出平台分工判据。

**Independent Test**: 能力与局限各抽查 3 条，能对应到场景与规避做法。

- [ ] T027 [US3] 写讲 C2 `docs/agent/platform/02-capabilities-and-limits.md` 的能力表（≥8 条，每条含适用场景与证据来源）（覆盖 FR-011、SC-005）
- [ ] T028 [US3] 在 `docs/agent/platform/02-capabilities-and-limits.md` 补齐局限表（≥6 条，每条含规避方式）（覆盖 FR-012、SC-005）
- [ ] T029 [P] [US3] 写讲 C1 `docs/agent/platform/01-bench-vs-runtime-entry.md`（开发台与运行时入口的分工判据）（覆盖 FR-034）
- [ ] T030 [P] [US3] 写讲 C3 `docs/agent/platform/03-long-running-delivery.md`（长周期专项交付的工作方式与退出条件）（覆盖 FR-013）

## Phase 6: User Story 4 - 两条使用路线与上下文归属（Priority: P1）

**Goal**: 两条路线判据 + 上下文与记忆归属决策表（≥3 类）+ 过渡方案。

**Independent Test**: 用决策表回答「日历接入放哪／HA 上下文放哪／过渡期谁承载」。

- [ ] T031 [US4] 在 `docs/agent/index.md` 补两条路线的选择判据（专项工作台／外部系统接入）（专项工作台／外部系统接入）（覆盖 FR-013）
- [ ] T032 [US4] 写讲 D3 `docs/agent/service-entry/03-memory-layers.md`：三层归属决策表（会话／服务／平台），逐条给理由（覆盖 FR-014、SC-006）
- [ ] T033 [US4] 在 `docs/agent/service-entry/03-memory-layers.md` 补过渡方案与后续迁移路径（集群暂无其他运行时入口时）（覆盖 FR-015）
- [ ] T034 [US4] 在 `docs/agent/service-entry/03-memory-layers.md` 补凭据归属与最小权限写法（凭据不进入口页面与记忆）（覆盖 FR-016、FR-031）

## Phase 7: User Story 5 - 落地：vibe coding 与自建集群（Priority: P2）

**Goal**: 五步工作流 + 人的把关点；集群实践用抽象能力类别；待评估项目只登记。

**Independent Test**: 按工作流走一遍，能说出 agent 负责什么、人负责什么。

- [ ] T035 [US5] 写讲 F1 `docs/agent/practice/01-vibe-coding-workflow.md`（需求／计划／实现／验证／提交 + 人的把关点）（覆盖 FR-017）
- [ ] T036 [US5] 写讲 F2 `docs/agent/practice/02-agents-in-selfrun-cluster.md`（抽象能力类别；禁写产品版本、拓扑、地址、节点信息）（覆盖 FR-018、FR-045）
- [ ] T037 [US5] 写讲 F3 `docs/agent/practice/03-project-registry.md`（待评估项目只登记目录与待补标注）（覆盖 FR-019）

## Phase 8: User Story 6 - 每个服务一个入口：地址、权限与复用（Priority: P2）

**Goal**: 入口表（≥3 服务）+ 权限矩阵（≥3 角色 × 3 操作）+ 声明式接入 ≤5 步。

**Independent Test**: 用日历、HA、任务服务三类服务画出入口表并说明分权。

- [ ] T038 [US6] 写讲 D1 `docs/agent/service-entry/01-per-service-entry.md`：独立地址规范、会话绑定单服务、审计要求（覆盖 FR-025、FR-027、FR-028）
- [ ] T039 [US6] 在 `docs/agent/service-entry/01-per-service-entry.md` 补入口表（≥3 个服务，含地址、可见角色、可操作角色、凭据与记忆归属）（覆盖 SC-011）
- [ ] T040 [US6] 在 `docs/agent/service-entry/01-per-service-entry.md` 补权限矩阵（≥3 角色 × 3 操作，越权必拒并留审计）与声明式接入 5 步（覆盖 FR-026、FR-029、SC-012、SC-013）
- [ ] T041 [P] [US6] 产图解入口架构：源 `diagrams/src/agent-service-entry-architecture.architecture.json`，产物 `docs/public/diagrams/agent-service-entry-architecture.html`（覆盖 FR-025）
- [ ] T042 [P] [US6] 产图解三层记忆归属：源 `diagrams/src/agent-memory-layers.architecture.json`，产物 `docs/public/diagrams/agent-memory-layers.html`（覆盖 FR-032）

## Phase 9: User Story 7 - 格式同构与公开发布安全（Priority: P1）

**Goal**: 与既有方向同构 + 公开内容 0 泄漏。

**Independent Test**: 对照基准方向抽查 3 讲；对新增与仓内公开面跑泄漏扫描 0 命中。

- [ ] T043 [US7] 写讲 D2 `docs/agent/service-entry/02-identity-and-access-in-practice.md`（身份与权限的业界做法，按调研契约给候选与结论）（覆盖 FR-039、FR-036）
- [ ] T044 [US7] 写调研讲 E1 `docs/agent/landscape/01-agent-frameworks.md`（≥3 个候选：名称、链接、许可证、最近提交、是否归档、场景、代价）（覆盖 FR-035、FR-036、SC-016）
- [ ] T045 [P] [US7] 写调研讲 E2 `docs/agent/landscape/02-entry-and-gateway.md`（入口与网关候选对比）（覆盖 FR-039）
- [ ] T046 [P] [US7] 写调研讲 E3 `docs/agent/landscape/03-memory-and-context.md`（记忆与上下文方案对比）（覆盖 FR-039）
- [ ] T047 [US7] 写调研讲 E4 `docs/agent/landscape/04-adoption-decisions.md`（采纳／参考／不采纳 + 逐条理由 + 抓取日期与来源）（覆盖 FR-038、FR-043、SC-019）
- [ ] T048 [US7] 抽查 3 讲与基准方向做同构核对（元数据字段、目录层级、四段式、官方依据、导航三级），结果记入 `specs/009-agent-domain/checklists/local-baseline.md`（覆盖 FR-050–FR-053、SC-022）
- [x] T049 [US7] 若 T011 判定整仓公开：脱敏历史文件（`README.md`、`AGENTS.md`、`.specify/memory/constitution.md`、`docs/.vitepress/config.mts`、`schemas/*.json` 示例值、`.gitea/workflows/ci.yaml`、`deploy/ingress.yaml`、`ci.env`）为占位符；否则关闭本任务并记录（覆盖 FR-044、FR-045、FR-047）
- [x] T050 [US7] 跑 `npm run check:public-safety` 并修复全部命中；扫描范围 `docs/agent/**`、`specs/009-agent-domain/**`、`schemas/**`、根文件与 `docs/public/diagrams/**`（覆盖 FR-048、SC-021）

## Phase 10: Polish & 横切

- [ ] T051 跑全部门禁（现有 13 条 + `check:public-safety`）并确认退出码全为 0；输出归档到 `specs/009-agent-domain/checklists/local-baseline.md`（覆盖 SC-009、SC-021）
- [ ] T052 [P] 复核 `docs/public/diagrams/agent-*.html` 共 6 张图解自包含（除矢量命名空间与字体许可注释外无外部资源）（覆盖 SC-007、FR-022）
- [ ] T053 双端发布抽查：公开站点与内部站点的领域首页、任一讲、任一图解均返回成功；记录写入 `specs/009-agent-domain/checklists/local-baseline.md`（覆盖 SC-010）
- [ ] T054 证据归档到 `specs/009-agent-domain/checklists/local-baseline.md`（含门禁输出、抽查结果、调研抓取日期）（覆盖 SC-001、SC-023）
- [ ] T055 范围自检：在仓库根跑 `git status --short` 确认 `service/` 与组件源码零改动、无新增源码文件（门禁脚本除外）（覆盖 FR-041、SC-020）
- [ ] T056 提交并推送 `docs/agent/**`、`diagrams/src/**`、`docs/public/diagrams/**`、`scripts/**`、`specs/009-agent-domain/**`，确认流水线通过（覆盖 SC-010）

---

## Dependencies

```text
Phase 1 (T001–T006)  →  Phase 2 (T007–T012)  →  所有用户故事阶段
T011 ──> T012 ──> T049（是否脱敏历史文件）
T001 ──> 所有内容任务（T013 起）
T004 ──> 所有写作任务（格式基准）
T006/T007 ──> T050（公开安全扫描）
T005 ──> T043–T047（调研条目）
```

- 用户故事之间**互相独立**：US1 完成后即可发布主线（MVP）；US2–US6 各自只依赖 Phase 1/2 与自身文件。
- US7 依赖 US1–US6 的内容存在（要抽查同构与扫描），但可先落门禁与调研讲。

## Parallel Execution Examples

- **Phase 1**：T002、T003、T005、T006 可并行（不同文件）。
- **US1**：T014、T015 可并行；T017 图解与写作并行。
- **US2**：T022、T023、T024、T025 可并行（不同文件）。
- **US6**：T041、T042 两张图解可并行。
- **US7**：T045、T046 两篇调研讲可并行。

## Implementation Strategy

1. **MVP 优先**：先做 Phase 1 + Phase 2 + US1（主线 + 演进时间线），可用 `quickstart.md` 场景 1–3 验收后先发布。
2. **增量交付**：US2（原理）→ US3（平台）→ US4（路线与归属）→ US6（入口）→ US5（落地）→ US7（调研与公开安全收口）。
3. **收口**：Phase 10 跑全部门禁、图解自包含、双端抽查、范围自检，再提交推送。
