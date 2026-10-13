---
description: "Task list for 组件面向对象重构与教学"
---

# Tasks: 组件面向对象重构与教学（oo-component-teaching）

**Input**: Design documents from `/specs/008-oo-component-teaching/`

**Prerequisites**: [spec.md](./spec.md)、[plan.md](./plan.md)、`.specify/memory/constitution.md`（1.6.0 原则 XII）

## Format: `[ID] [P?] [Story] Description`

- 每个任务给出确切文件路径，并在末尾标注覆盖的需求（`（覆盖 FR-0xx）`）

---

## Phase 1: Setup

- [ ] T001 在 `specs/004-component-hub-console/contracts/component-page-contract.md` 起草新章节表（16 → 15 节）：删除「涉及的知识点」，新增「对象模型」与「对象协作与流程」两节，并把「核心源码」改名为「对象实现」（覆盖 FR-015）
- [ ] T002 [P] 在 `specs/008-oo-component-teaching/checklists/local-baseline.md` 建证据文件（覆盖 SC-001…SC-009）

## Phase 2: Foundational

- [ ] T003 更新 `scripts/check-component.mjs` 的 C2 章节顺序为 15 节新表（覆盖 FR-015）
- [ ] T004 在 `scripts/check-component.mjs` 增 C8：对象清单表的行数 MUST 等于对象小节数，且对象名与源码中的类名一致（覆盖 FR-003、FR-005）
- [ ] T005 [P] 在 `scripts/data/` 建组件对象清单登记（对象名 → 源码位置），供门禁比对（覆盖 FR-005）

## Phase 3: User Story 1 - 对象模型先行（Priority: P1）

**Goal**: 后端任务服务的源码以对象为单位组织，页面先给对象清单。

**Independent Test**: `python3 -m pytest tests/ -q` 全绿；源码中每个对象有独立类或模块。

- [x] T006 [US1] `service/output.py` 抽出 `OutputBuffer`（缓冲、序号、截断、订阅分发），`Task` 改为持有并委托（覆盖 FR-004）
- [ ] T007 [US1] `service/registry.py` 把 `Task` 拆为 `Task`（状态机与指标）+ 组合 `OutputBuffer`；`Registry` 改名 `TaskRegistry` 并保留别名（覆盖 FR-004、FR-005）
- [ ] T008 [US1] `service/limits.py` 拆出 `Allowlist` 类（白名单与参数校验），`Limits` 只留限额（覆盖 FR-004）
- [ ] T009 [US1] `service/executor.py` 拆出 `Executor`（线程池与名额）、`ChildProcess`（进程组与信号）、`MetricsSampler`（/proc 采样）三个对象（覆盖 FR-004、FR-010）
- [ ] T010 [US1] `service/app.py` 拆出 `StreamHub`（SSE 订阅、续传、心跳）与 `TaskService`（组合根），路由只做参数与响应（覆盖 FR-004）
- [ ] T011 [US1] 跑 `python3 -m pytest tests/ -q`，确认对象化重构未破坏行为；把对象清单写入 `specs/008-oo-component-teaching/checklists/local-baseline.md`（覆盖 SC-006）

## Phase 4: User Story 2 - 逐对象成节（Priority: P1）

**Goal**: 后端组件页按对象重写：对象模型 + 每个对象一节。

**Independent Test**: 对象小节数 = 清单条数；每节含职责、持有、方法、边界。

- [ ] T012 [US2] 在 `docs/backend/components/03-task-console.md` 重写「对象模型」节：对象清单表（对象｜职责｜状态｜生命周期）（覆盖 FR-001、FR-002）
- [ ] T013 [US2] 在 `docs/backend/components/03-task-console.md` 为 `Allowlist`、`TaskRegistry`、`OutputBuffer`、`StreamHub`、`Executor`、`ChildProcess`、`MetricsSampler` 各写一节，含职责、持有、方法、边界（覆盖 FR-003）
- [ ] T014 [US2] 在 `docs/backend/components/03-task-console.md` 按对象重排「API 手册」，方法组名与对象名一致（覆盖 FR-006）
- [ ] T015 [US2] 在 `docs/backend/components/03-task-console.md` 更新「对象实现」小节：按对象给出关键代码片段，与源码一致（覆盖 FR-004、FR-005）

## Phase 5: User Story 3 - 对象协作与流程（Priority: P1）

- [ ] T016 [US3] 在 `docs/backend/components/03-task-console.md` 新增「对象协作与流程」节：对象关系用「持有／调用／回调」标注（覆盖 FR-007）
- [ ] T017 [US3] 在 `docs/backend/components/03-task-console.md` 写「下发到完成」流程：步骤 ≥5，每步写调用方、被调方与数据形态（覆盖 FR-008）
- [ ] T018 [US3] 在 `docs/backend/components/03-task-console.md` 写「取消与超时」流程：含失败路径与资源释放时机（覆盖 FR-009、FR-010）

## Phase 6: User Story 4 - 图解对应对象模型（Priority: P2）

- [ ] T019 [P] [US4] 产出对象关系图（Archify 源在 `diagrams/src/`，产物在 `docs/public/diagrams/`），节点名与清单一致（覆盖 FR-011、FR-012）
- [ ] T020 [P] [US4] 在 `diagrams/src/` 产出关键流程时序图（产物到 `docs/public/diagrams/`），步骤与流程小节编号一致（覆盖 FR-011、FR-012）
- [ ] T021 [US4] 在 `docs/backend/components/03-task-console.md` 替换原「组合方式图解」为对象关系图 + 时序图，并写图注（覆盖 FR-013）

## Phase 7: User Story 5 - 知识点只登记一处（Priority: P2）

- [ ] T022 [US5] 删除 `docs/backend/components/03-task-console.md`、`docs/backend/components/01-safe-queue.md`、`docs/frontend/components/01-task-console.md` 的「涉及的知识点」一节，只保留 frontmatter 驱动的索引（覆盖 FR-014）
- [ ] T023 [US5] 更新 `reuse/task-console/manifest.json` 的 `files[]` 与 `reuse/README.md` 约定（覆盖 FR-014）
- [ ] T024 [US5] 跑 `scripts/check-component.mjs` 与 `scripts/check-content.mjs`，确认新章节表与单一事实源生效（覆盖 FR-015、SC-005）

## Phase 7b: 对象层级（继承与组合）

- [ ] T029 [US2] 在 `docs/backend/components/03-task-console.md` 新增「对象层级」节：继承表（子类｜父类｜扩展或覆盖的方法）+ 组合表（持有者｜被持有者｜用途），三组真实继承全部登记（覆盖 FR-017、FR-019、SC-010）
- [ ] T030 [P] [US4] 产出对象层级图：继承边用实线三角、组合边用菱形，节点名与对象清单一致（覆盖 FR-018、FR-020）
- [ ] T031 [US5] 在 `scripts/check-component.mjs` 增 C9：组件的后端源码存在继承时，页面 MUST 含「对象层级」节，且表内子类名 MUST 出现在源码中（覆盖 FR-017、SC-011）

## Phase 8: Polish

- [ ] T025 把同一套对象化做法复制到 `docs/frontend/components/01-task-console.md` 与 `TaskConsole.vue`（覆盖 SC-001）
- [ ] T026 把同一套做法复制到 `docs/backend/components/01-safe-queue.md` 与页面内源码（覆盖 SC-001）
- [ ] T027 十三条门禁全绿；证据写入 `specs/008-oo-component-teaching/checklists/local-baseline.md` `specs/008-oo-component-teaching/checklists/local-baseline.md`（覆盖 SC-007）
- [ ] T028 部署验收：内网与公网发布成功，抽查三个组件页；结论写入 `specs/008-oo-component-teaching/checklists/local-baseline.md`（覆盖 SC-008）
