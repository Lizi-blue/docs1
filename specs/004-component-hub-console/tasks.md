---
description: "Task list for 组件首发仓与前后端双端任务控制台"
---

# Tasks: 组件首发仓与前后端双端任务控制台（component-hub-console）

**Input**: Design documents from `/specs/004-component-hub-console/`

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/](./contracts/)、[quickstart.md](./quickstart.md)、`.specify/memory/constitution.md`（1.5.0）

**Tests**: 本特性**包含测试任务**（数据模型与契约明确要求机械校验：SC-004 链接有效率 100%、SC-005 体验逐项、
FR-007 独立可运行）。测试集中在「平台契约」（`tests/test_reuse_manifest.py`）与「门禁自测负例」（`scripts/selftest-gates.mjs`）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、不依赖未完成任务）
- **[Story]**: 仅用户故事阶段使用（`[US1]`…`[US5]`）
- 每个任务都给出确切文件路径，并在末尾标注覆盖的需求（`（覆盖 FR-0xx、SC-00y）`）
- T047–T049 为 `/speckit-analyze` 修复轮新增（C1 作用域门禁、T1 宪法核验）。它们按所在阶段执行，ID 顺序与执行顺序的差异仅限这三条

## Path Conventions

- 站点内容：`docs/<domain>/components/`、`docs/cross-domain/`
- 站点主题：`docs/.vitepress/theme/`（`components/`、`styles/`、`index.ts`）
- 可复用资产：`reuse/<component>/`（事实源）、`templates/component/`（骨架）
- 门禁脚本：`scripts/`；测试：`tests/`
- 规格与契约：`specs/004-component-hub-console/`

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 建立目录骨架 `reuse/task-console/backend/`、`reuse/task-console/frontend/`、`templates/component/`，并确认 `docs/frontend/components/` 具备 `_meta.yml` 与 `index.md`（覆盖 FR-008）
- [x] T002 [P] 在 `package.json` 增脚本别名 `check:component`（`node scripts/check-component.mjs`）与 `check:experience`（`node scripts/check-experience.mjs`）（覆盖 FR-018）
- [x] T003 [P] 在 `specs/001-docs-engine/contracts/content-contract.md` 增指针一节：组件页条款以 `specs/004-component-hub-console/contracts/component-page-contract.md` 为准（只写指针，不复制取值）（覆盖 FR-018）
- [x] T004 [P] 在 `AGENTS.md` §4 增组件四件套与方向归属要点，并在 §2 增两条门禁命令（先占位，实现后核对）（覆盖 FR-001、FR-018）
- [x] T005 [P] 在 `ledger/orchestration-decisions.tsv` 追加本轮迭代行（scope=`004-component-hub-console`，decision 与 reason 写实）（覆盖 Governance）

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T006 [P] 在 `schemas/page-frontmatter.schema.json` 的 component 与 cross-component 两个分支增：`direction` 枚举 `backend|frontend|fullstack`、`knowledge_index` 数组（每项 `page` 必填、`role` 长度 10–80）、`reuse_manifest`、`cross_link`（覆盖 FR-002、FR-003）
- [x] T007 [P] 在 `docs/.vitepress/plugins/doc-engine.ts` 的 `PageNode` 暴露 `direction`、`knowledgeIndex`、`reuseManifest`、`crossLink` 字段（从 frontmatter 读取，缺省为空）（覆盖 FR-002、FR-003）
- [x] T008 [P] 新增 `docs/.vitepress/theme/components/KnowledgeIndex.vue` 并在 `docs/.vitepress/theme/index.ts` 注册（渲染 `knowledge_index` 表格：知识点 | 知识域 | 在本组件中的作用）（覆盖 FR-003）
- [x] T009 [P] 新增 `docs/.vitepress/theme/styles/tokens.css`（`--docs1-*` 令牌：space/font/radius/shadow/color/focus/state 与深色覆盖），并在 `docs/.vitepress/theme/index.ts` 中先于 `styles/custom.css` 引入（覆盖 FR-010）
- [x] T010 新建 `scripts/check-component.mjs`：按 `contracts/component-page-contract.md` §1/§2 校验组件页必填元数据与必需章节顺序；支持 `--json`，退出码 0/1/2（覆盖 FR-018）
- [x] T011 [P] 新建 `scripts/check-experience.mjs`：按 `contracts/design-tokens-contract.md` §5 实现 X1–X7 断言框架（令牌齐全、深色覆盖、无原始色值、焦点环、状态类、对比度、响应式与滚动）（覆盖 FR-010、FR-016）
- [x] T012 [P] 新建 `tests/test_reuse_manifest.py`：`reuse/*/manifest.json` 的 `files[].path` 必须存在、`page` 与组件页互指、`verify[].command` 非空（覆盖 FR-007、SC-004）

## Phase 3: User Story 1 - 双端各看到自己那一份实现（Priority: P1）🎯 MVP

**Goal**: 后端组件页只讲后端实现，前端组件页只讲前端实现，两页互链，方向错配 0 处。

**Independent Test**: `npm run check:component` 0 错；`grep -nE "\.vue|EventSource" docs/backend/components/03-task-console.md` 无命中；两页互链可达。

- [x] T013 [US1] 改写 `docs/backend/components/03-task-console.md` 为「后端任务服务组件」：只讲调度、进程组、取消、超时、限额、指标与 SSE 服务端实现；按契约 §2 的 16 个章节重排（含 V8 要求的「核心源码」与「其他项目如何引用」三种方式）（覆盖 FR-002、FR-006、FR-018）
- [x] T014 [P] [US1] 新建 `docs/frontend/components/01-task-console.md`：只讲前端控制台组件（表单与校验提示、状态机呈现、实时日志面板、错误与降级、键盘可达）（覆盖 FR-002、FR-008）
- [x] T015 [US1] 在 `docs/backend/components/03-task-console.md` 与 `docs/frontend/components/01-task-console.md` 各补 `## 对应另一端` 互链（backend ↔ frontend），`cross_link` 字段与正文链接一致（覆盖 FR-002）
- [x] T016 [US1] 在 `scripts/check-component.mjs` 实现方向纯净拒绝词表：后端页禁 `.vue`、`EventSource`、`document.`、`window.`、`fetch(`；前端页禁 `killpg`、`SIGTERM`、`进程组`、`/proc/`；`## 对应另一端` 一节豁免（覆盖 FR-002、SC-002）
- [x] T017 [P] [US1] 在 `scripts/selftest-gates.mjs` 增负例 G11：后端组件页含 `.vue` 时 `check:component` 判红（覆盖 SC-002）
- [x] T018 [P] [US1] 在 `docs/.vitepress/theme/components/EntryIndex.vue` 的 `kind="components"` 视图按 `direction` 分组呈现（后端实现 / 前端实现 / 跨端）（覆盖 FR-002、FR-008、FR-009）

## Phase 4: User Story 2 - 依赖的知识点可点可学（Priority: P1）

**Goal**: 组件页索引依赖的知识域与知识点，每条含链接与作用；未开写处标「待补」；组件索引可按方向与知识域筛选。

**Independent Test**: `npm run check:component` 校验链接命中与 `role` 长度；组件索引筛选可用；两次点击内到达任一依赖知识点。

- [x] T019 [US2] 为 `docs/backend/components/03-task-console.md` 与 `docs/frontend/components/01-task-console.md` 填 `knowledge_index`：各 ≥3 条，`page` 指向真实知识点页或知识域入口，`role` 10–80 字（后端页指向并发域与服务端相关讲，前端页指向前端工程化域相关讲）（覆盖 FR-003）
- [x] T020 [US2] 在 `KnowledgeIndex.vue` 落地渲染：知识点标题（链接）| 所属知识域 | 在本组件中的作用；`is_outline` 为真时渲染「待补」标签且不产生死链（覆盖 FR-003、FR-004）
- [x] T021 [US2] 在 `scripts/check-component.mjs` 增校验：`knowledge_index` 命中链接表、`role` 长度合规、同一组件内 `page` 唯一、outline 目标必须标「待补」（覆盖 FR-003、FR-004、SC-004）
- [x] T022 [US2] 在 `EntryIndex.vue` 增方向筛选与知识域筛选（客户端过滤，数据取自组件 `direction` 与 `knowledge_index[].page` 的第 2 段），并补筛选控件样式到 `docs/.vitepress/theme/styles/custom.css`（覆盖 FR-009）
- [x] T023 [P] [US2] 在 `specs/004-component-hub-console/checklists/local-baseline.md` 记录 S2 证据（命令与输出）（覆盖 SC-001）

## Phase 5: User Story 3 - 复制即可复用（Priority: P1）

**Goal**: 组件页给出最小文件清单、外部依赖、适配点与验收命令；组件可在不依赖本仓其余部分时独立运行。

**Independent Test**: `python3 -m pytest tests/ -q` 全绿；`check:component` 校验清单与实际文件一致；按 quickstart S4 在空项目跑通。

- [x] T024 [US3] 新建 `reuse/task-console/manifest.json`：`contract_version` 1.0.0，`page` 指向后端组件页，`sides.backend`（`service/**` 文件清单、零第三方依赖、适配点、验收命令）与 `sides.frontend`（`TaskConsole.vue` + 令牌子集、Vue 3 依赖、适配点、验收命令）（覆盖 FR-005、FR-006、FR-007）
- [x] T025 [US3] 在 `docs/backend/components/03-task-console.md` 与 `docs/frontend/components/01-task-console.md` 渲染 `## 复用四件套` 与 `### 契约版本与迁移`（内容取自 `reuse/task-console/manifest.json` 的 `contract_version` 与迁移说明；作者不手写清单）（覆盖 FR-005、SC-003）
- [x] T026 [US3] 在 `scripts/check-component.mjs` 增校验：`files[].path` 存在、`page` 与组件页互指、`external_deps` 非本仓私有、`adaptation` 与 `verify` 均 ≥1（覆盖 FR-005、SC-004）
- [x] T027 [US3] 落地 `tests/test_reuse_manifest.py` 并跑通（与 T012 骨架对齐；同源校验，测试侧只读断言）（覆盖 FR-007、SC-004）
- [x] T028 [P] [US3] 在 `templates/component/` 放组件页骨架（含 15 章节 + `direction` + `knowledge_index` + `reuse_manifest` 占位），并在 `scripts/new-content.mjs` 的 `component` kind 生成这些字段（覆盖 FR-001、FR-005）
- [x] T029 [US3] 执行 quickstart S4（后端一次、前端一次）并在 `specs/004-component-hub-console/checklists/local-baseline.md` 记录文件清单、命令与耗时（覆盖 FR-007、SC-003）

## Phase 6: User Story 5 - 本仓是组件首发地（Priority: P1）

**Goal**: 组件先在本仓成型的流程可执行：有模板、有约定、有技能判据、有台账记录。

**Independent Test**: 用 `npm run new component <name> --domain <d>` 生成的页面通过 `check:component`；`reuse/README.md` 能按步骤完成一次复制。

- [x] T030 [US5] 新建 `reuse/README.md`：复用约定（怎么拿、怎么改、怎么验、契约版本与迁移规则、目录要求）（覆盖 FR-001、FR-005）
- [x] T031 [US5] 在 `AGENTS.md` §4 写明「组件先在本仓成型再复制到生产项目」的流程与模板路径（`templates/component/`、`reuse/<component>/`）（覆盖 FR-001）
- [x] T032 [US5] 在 `.dsh/skills/docs-authoring/SKILL.md` 增组件编排判据（四件套、方向归属、知识索引、复用清单），版本升 1.4.0 并补 `CHANGELOG.md`，随后 `npm run export:skill`（覆盖 FR-001、FR-018）
- [x] T049 [US5] 核验宪法已含原则 XI「组件首发仓与按方向归属」且版本 ≥ 1.5.0（FR-017），核验命令与输出写入 `specs/004-component-hub-console/checklists/local-baseline.md`（覆盖 FR-017、SC-008）
- [x] T033 [P] [US5] 在 `specs/002-content-orchestration/contracts/check-contract.md` §4 增组件页规则指针（方向纯净、知识索引、清单一致）（覆盖 FR-018）

## Phase 7: User Story 4 - 专业的前端体验（Priority: P2）

**Goal**: 站点与前端组件遵循统一设计规范；可机械化的体验项进门禁，不可机械化的进人工清单。

**Independent Test**: `npm run check:experience` X1–X7 全绿；quickstart S6/S7 人工步骤通过并留证据。

- [x] T034 [US4] 在 `docs/.vitepress/theme/styles/tokens.css` 落地全量令牌：space 5 档、font 4 档、radius 3 档、shadow 2 档、语义色、`--docs1-focus-ring`、state 5 档，并给深色模式同批覆盖（覆盖 FR-010、FR-015）
- [x] T035 [US4] 把 `docs/.vitepress/theme/styles/custom.css` 与 `TaskConsole.vue` 的尺寸/颜色改为引用令牌，清除原始色值与魔法尺寸（覆盖 FR-010、FR-016）
- [x] T036 [US4] 在 `TaskConsole.vue` 补可访问性与状态：`<label for>`、日志面板 `aria-live="polite"`、错误 `role="alert"`、`aria-disabled`、`:focus-visible` 焦点环、空/错/降级/加载四态文案（覆盖 FR-011、FR-012、FR-013）
- [x] T037 [US4] 落地 `scripts/check-experience.mjs` 的 X1–X7（含 WCAG 对比度计算与令牌白名单），并保证退出码语义与既有门禁一致（覆盖 FR-011、FR-014、FR-015、SC-005、SC-007）
- [x] T038 [P] [US4] 在 `scripts/selftest-gates.mjs` 增体验负例：移除 `--docs1-focus-ring` 引用或注入原始色值时应判红（覆盖 SC-005）
- [x] T047 [US4] 在 `scripts/check-component.mjs` 增样式作用域断言与两端互链双向校验：扫描 `docs/.vitepress/theme/components/*.vue` 的 `<style>` 是否 `scoped` 或选择器带组件类前缀、`docs/.vitepress/theme/styles/custom.css` 中组件选择器是否带组件前缀（禁全局元素选择器）；并校验两个组件页的 `## 对应另一端` 双向存在（覆盖 FR-016、FR-002、SC-002）
- [x] T048 [P] [US4] 在 `scripts/selftest-gates.mjs` 增负例 G12：组件样式去掉 `scoped`/类前缀、或组件页缺少 `## 对应另一端` 时 `check:component` 判红（覆盖 FR-016、SC-002）
- [x] T039 [US4] 执行 quickstart S6/S7（键盘流程、三档视口、深色、朗读顺序）并记录到 `specs/004-component-hub-console/checklists/local-baseline.md`（覆盖 FR-013、FR-014、FR-015、SC-006、SC-007）

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T040 在 `Dockerfile` 的构建阶段增两条门禁：`npm run check:component` 与 `npm run check:experience`（覆盖 SC-008）
- [x] T041 [P] 在 `AGENTS.md` §2 更新命令清单为十一条并标注适用时机（含需先构建的两条）（覆盖 SC-008）
- [x] T042 跑全量门禁并修复残留（`package.json` 中十一条命令），结论写入 `specs/004-component-hub-console/checklists/local-baseline.md`：`check:content`、`check:zh`、`check:component`、`check:experience`、`check:orchestration`、`test:component`、`selftest:gates`、`check:extensibility`、`build`、`check:responsive`、`check:nav`（覆盖 SC-008）
- [x] T043 [P] 记录 quickstart S0–S8 全量证据到 `specs/004-component-hub-console/checklists/local-baseline.md`（含命令与真实输出）（覆盖 SC-008）
- [x] T044 部署验收：推送后确认 CI Run 全绿，`https://<internal-host>/backend/components/task-console` 与 `/frontend/components/task-console` 均 200，且经域名提交 `cp` 任务能看到实时输出（覆盖 SC-008）
- [x] T045 [P] 按 Governance 移除 `.specify/memory/constitution.md` 头部的 Sync Impact Report，并确认版本行日期（覆盖 Governance）
- [x] T046 [P] 文档一致性回归：核对 `AGENTS.md`、`README.md`、`specs/001` 契约、`specs/004` 契约与技能五处口径一致（命令清单、组件四件套、方向规则、令牌规则）（覆盖 SC-008）

---

## Dependencies

```text
Phase 1 (T001–T005)
      ↓
Phase 2 (T006–T012)  ← 阻塞全部用户故事：元数据、渲染组件、令牌、两条门禁骨架、测试骨架
      ↓
US1 (T013–T018)  ← MVP：方向拆分与纯净门禁
      ↓
US2 (T019–T023)  ← 依赖知识索引与筛选（依赖 T008 渲染组件）
      ↓
US3 (T024–T029)  ← 复用清单与模板（依赖 T010 门禁骨架）
      ↓
US5 (T030–T033、T049)  ← 首发地流程与技能回写
      ↓
US4 (T034–T039、T047–T048)  ← 令牌、体验与作用域门禁（可与 US2/US3 并行，但 T035 依赖 T034）
      ↓
Phase 8 (T040–T046)
```

**故事间依赖说明**

- US2、US3、US5 都依赖 Phase 2 的元数据与渲染组件；US1 完成后两页才存在，故 US2/US3 排在 US1 之后。
- US4 的令牌层与 US1/US2/US3 无文件冲突（只动 `theme/styles` 与 `TaskConsole.vue`），可与 US2 并行。

## Parallel Execution Examples

**Phase 2**（不同文件，可同时开工）：

```text
T006 schemas/page-frontmatter.schema.json
T007 docs/.vitepress/plugins/doc-engine.ts
T008 docs/.vitepress/theme/components/KnowledgeIndex.vue
T009 docs/.vitepress/theme/styles/tokens.css
T011 scripts/check-experience.mjs
T012 tests/test_reuse_manifest.py
```

**US1**：

```text
T013 docs/backend/components/03-task-console.md   （后端页）
T014 docs/frontend/components/01-task-console.md  （前端页）
T017 scripts/selftest-gates.mjs                   （负例）
T018 EntryIndex.vue                                （方向分组）
```

**US3 + US4**（写域不重叠）：

```text
T024 reuse/task-console/manifest.json              （复用事实源）
T028 templates/component/ + scripts/new-content.mjs （骨架）
T034 tokens.css                                    （令牌）
T036 TaskConsole.vue                               （组件体验）
T047 scripts/check-component.mjs                    （作用域与互链断言）
T048 scripts/selftest-gates.mjs                     （作用域负例）
```

## Implementation Strategy

**MVP 优先**：先交付 US1（方向拆分 + 纯净门禁），此时「后端页不再记前端内容」已可验收，
线上两个方向各自可读。随后依次补 US2（索引）、US3（复用）、US5（首发流程），最后做 US4（体验）。

**增量交付顺序**

1. Phase 1 + Phase 2 → 骨架可跑，门禁能报错但还不判红（T010/T011 为空实现）。
2. US1 → 第一个可验收增量：`check:component` 拦截方向错配。
3. US2 → 依赖索引与筛选；SC-001/SC-004 可测。
4. US3 → 复用清单与模板；SC-003 可测（空项目 10 分钟）。
5. US5 → 流程与技能回写，团队与后续组件都按同一模板。
6. US4 → 令牌与体验门禁；SC-005/SC-006/SC-007 可测。
7. Phase 8 → 门禁入 CI、证据归档、部署验收。

**风险与缓解**

- 旧页迁移风险（T013）：先把后端职责段落写清再删前端内容，避免一次性掏空导致页面不合格。
- 令牌改造面较大（T035）：按「令牌先加、样式后换」两步走，每步跑 `check:experience` 与 `build`。
- 体验人工项（T039）在本沙箱无法自动执行：证据以清单形式记录，并在 CI 注释中标注为人工项。
