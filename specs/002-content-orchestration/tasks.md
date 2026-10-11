---

description: "Task list for feature 002-content-orchestration (v2, 含 /speckit-analyze 整改)"

---

# Tasks: 内容编排与教学法技能（content-orchestration）

**Input**: Design documents from `/specs/002-content-orchestration/`

**Prerequisites**: [plan.md](./plan.md)（落位与六项关键决策）、[spec.md](./spec.md)（5 个用户故事，25 FR / 10 SC）、
[research.md](./research.md)（8 项决策）、[data-model.md](./data-model.md)（4 类实体与 V15–V18 / S1–S5）、
[contracts/](./contracts/skill-contract.md)（技能 / 台账 / 导出 / 校验四份契约）、
[quickstart.md](./quickstart.md)（S0–S8）、
[.specify/memory/constitution.md](../../.specify/memory/constitution.md)（v1.1.0，原则 VIII 为本特性依据）

**跨特性依赖**：本特性的 T016、T029、T030 依赖 `001-docs-engine` 的引擎实现与既有内容已在仓库中
（`docs/.vitepress/**`、`scripts/check-content.mjs`、8 个知识点页）。001 的实现尚未入库，T005 负责确认或补齐。

**Tests**: 仅在规格明确要求处生成：内容门禁负例（夹具）、连续三次台账规则负例、导出指纹负例。
其余以 quickstart 剧本验收。

**Organization**: 按用户故事分阶段，零新增依赖，脚本复用 001 的解析层
（`buildDocTree` 与 `normalizeLink`）。

**v2 变更来源**：`/speckit-analyze`（002）的 1 项 HIGH + 6 项 MEDIUM，逐条对应见文末
「analyze 整改对应表」。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1…US5）
- 每个任务都带确切文件路径；data-model.md 的字段约束在任务里逐字引用

## Path Conventions

技能在 `.dsh/skills/docs-authoring/`，台账在 `ledger/`，脚本在 `scripts/`，schema 在 `schemas/`，
内容在 `docs/`。见 plan.md「Source Code (repository root)」。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 让技能可以入库，准备好目录与命令入口，并确认对 001 的依赖已满足

- [ ] T001 收窄忽略规则：把 `.gitignore` 中的 `.dsh/` 改为 `.dsh/skills/speckit-*`，注释说明「只忽略 spec-kit 生成的同名技能副本」，并用 `git check-ignore -v .dsh/skills/docs-authoring/SKILL.md` 确认不再被忽略
- [ ] T002 [P] 建目录骨架：`.dsh/skills/docs-authoring/`、`ledger/`，并把 `build/` 加入 `.gitignore`（导出物不入库）
- [ ] T003 [P] 在 `package.json` 的 `scripts` 增加 `check:orchestration`（`node scripts/check-orchestration.mjs`）与 `export:skill`（`node scripts/export-skill.mjs`）
- [ ] T004 [P] 在 `schemas/teach-block.schema.json` 文件头注释写明「设计源在 `specs/002-content-orchestration/contracts/schemas/teach-block.schema.json`，改动必须同步」
- [ ] T005 确认 001 依赖已满足：`git log --oneline -- docs/.vitepress scripts/check-content.mjs docs/backend` 有入库记录，且 `npm run build` 通过；若未入库，先执行 001 的 T001（WIP 提交）再继续本特性

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 登记块、四要素判据、台账、自检骨架，以及技能正文的中文门禁范围

**⚠️ CRITICAL**: 本阶段不完成，US1–US5 无法独立验收

- [ ] T006 [P] 落地 `schemas/teach-block.schema.json`：五字段必填，`audience` 10–80 字、`prerequisites` ≥1 条且每条 ≤60 字、`outcomes` 1–5 条且每条 10–80 字、`path` ≥1 段含 `from`/`to`、`lessons` ≥1 条含 `slug`/`goal`（10–60 字），`additionalProperties: false`
- [ ] T007 [P] 扩写 `schemas/dir-meta.schema.json`：新增可选 `teach` 键并引用上一步的 schema 语义；文件头注明「知识域目录必填」
- [ ] T008 在 `scripts/check-content.mjs` 实现 **V15**：知识域 `_meta.yml` 存在 `teach` 块且五字段类型正确；失败输出文件名、缺失字段与模板片段
- [ ] T009 在 `scripts/check-content.mjs` 实现 **V16**：四个教学要素标题存在（`### 本讲要解决的问题`、`### 常见误区`、`### 面试追问链`、`### 下一讲衔接`），且 `### 面试追问链` 节内 `<details>` 条目为 3–5 条
- [ ] T010 在 `scripts/check-content.mjs` 实现 **V17**：`teach.lessons[].slug` 归一化后与知识点页 URL 双向完整，输出「幽灵条目」与「未登记页面」两份清单
- [ ] T011 在 `scripts/check-content.mjs` 实现 **V18**：各要素标题下 ≥1 行实质文本；`### 常见误区` ≥1 条列表项；`### 下一讲衔接` 含至少一个页面链接
- [ ] T012 实现 `scripts/check-orchestration.mjs` 骨架：规则注册表、`--json` 输出（`{ ok, errors: [{code,message,fix,subject}] }`）、退出码 `0/1/2`
- [ ] T013 在 `scripts/check-orchestration.mjs` 实现 **S1**（技能内取值零复制：成组字段名 ≥3 个、阈值数字、目录树结构块）与 **S2**（九个必需章节齐全且顺序正确，见 `contracts/skill-contract.md` §2）
- [ ] T014 在 `scripts/check-orchestration.mjs` 实现 **S3**：`ledger/orchestration-decisions.tsv` 表头逐字为 `date	iteration	scope	decision	reason	review`、列数一致、`decision ∈ {writeback,no-writeback}`、`review ∈ {-,recheck:valid,recheck:update}`；从表尾向前统计连续 `no-writeback`，达到 3 条且其后无 `recheck:*` 即判错
- [ ] T015 在 `scripts/check-orchestration.mjs` 实现 **S4**（技能内指向仓内文件的指针可达）与 **S5**（导出物存在时比对 `body-sha256-16`，不存在则跳过并打印提示）
- [ ] T016 在 `docs/.vitepress/plugins/doc-engine.ts` 支持 `teach.path ?? path` 回退读取知识域路径，并在 `KnowledgeDomainNode` 暴露 `teach` 摘要；同步更新 `docs/.vitepress/theme/components/EntryIndex.vue` 使用回退后的路径
- [ ] T017 扩写 `scripts/new-content.mjs`：`knowledge-domain` 生成含五字段的 `teach` 块骨架；`knowledge` 追加页面时自动在其知识域 `teach.lessons` 追加 `{ slug, goal: "<待填，10–60 字>" }`，并在目标页骨架生成四个教学要素标题；`component` 生成组件页骨架（含三种引用方式标题）
- [ ] T018 建立 `ledger/orchestration-decisions.tsv`：写入固定表头与首条记录（`date=2026-10-11`、`iteration=002-content-orchestration`、`scope=技能首次落地`、`decision=writeback`、`reason=-`、`review=-`）
- [ ] T019 把技能正文纳入中文门禁范围：把 `package.json` 的 `check:zh` 改为同时检查 `docs` 与 `.dsh/skills/docs-authoring`，跑一次确认退出码 0；若首批硬违规不为零，按 `scripts/ste-lint-zh.baseline` 机制处理并记录基线数

**Checkpoint**: `check:content`、`check:orchestration`、`check:zh` 三条命令均可运行并给出可定位结论

---

## Phase 3: User Story 1 - 作者按统一编排落地一个新知识域 (Priority: P1) 🎯 MVP

**Goal**: 技能给出可判定的编排判据与可套用模板；作者照做即可产出合规内容

**Independent Test**: 用脚手架新建一个最小领域（含知识域、知识点、组件页）并跑内容门禁全绿；
再按技能判据手工判断两个边界场景（该不该拆页、路径是否过长）

- [ ] T020 [P] [US1] 编写 `.dsh/skills/docs-authoring/SKILL.md` 第 1–3 节：何时加载、目录落位与命名、四类编排判据（知识点拆分与合并、知识域划分、路径排法与长度、组件与知识点对应），每类含可判定条件、一个正例、一个反例（照 `contracts/skill-contract.md` §3）
- [ ] T021 [P] [US1] 编写 `SKILL.md` 第 4–5 节：每讲教学结构（四要素的标题、位置、写法）与模板（`teach` 块、知识点页骨架、组件页骨架、路径声明），模板可直接复制
- [ ] T022 [US1] 编写 `SKILL.md` 第 7 节（常见错误与修法 ≥5 条）并补文件头：YAML frontmatter（`name: docs-authoring` + `description`）与「技能版本：1.0.0」
- [ ] T023 [US1] 迁移 2 个既有知识域到 `teach` 块：`docs/backend/learn/01-concurrency/_meta.yml` 与 `docs/frontend/learn/01-engineering/_meta.yml`（五字段齐全、`lessons` 覆盖各自 4 页、`path` 迁入后删除顶层 `path`）
- [ ] T024 [US1] 夹具验证四条路径：在临时夹具依次用 `node scripts/new-content.mjs` 建 `domain`、`knowledge-domain`、`knowledge`、`component`，断言：内容门禁 V15–V18 全绿；建知识点后其知识域 `teach.lessons` 自动多一条且 V17 通过；建组件页后 V8（三种引用方式）通过；删除夹具并记录
- [ ] T025 [US1] 把 T024 的结论（含四条路径的命令与输出摘要）写入 `specs/002-content-orchestration/checklists/local-baseline.md`

**Checkpoint**: US1 独立可验（技能可用、登记可迁移、四条新增路径全绿）

---

## Phase 4: User Story 2 - 读者获得稳定的学习节奏 (Priority: P1)

**Goal**: 每讲四要素齐备且追问链递进；入口页呈现路径与层级

**Independent Test**: 抽查任意三讲，核对四要素、追问链条数（3–5）与递进关系；打开入口页确认路径分段与推荐起点

- [ ] T026 [P] [US2] 补齐 `docs/backend/learn/01-concurrency/` 4 页（`01-thread-basics.md`、`02-process-basics.md`、`03-queue-pipe.md`、`04-async-io.md`）的四要素：新增 `### 本讲要解决的问题`（`## TL;DR` 之前）、`### 常见误区`（≥2 条列表项）、`### 下一讲衔接`（含下一讲链接）；核对 `### 面试追问链` 为 3–5 条，且后一问依赖前一问的结论
- [ ] T027 [P] [US2] 补齐 `docs/frontend/learn/01-engineering/` 4 页（`01-single-html-entry.md`、`02-npm-and-modules.md`、`03-vite-dev-and-build.md`、`04-project-structure.md`）的四要素，要求同上
- [ ] T028 [US2] 负例夹具：在 `docs/backend/learn/01-concurrency/01-thread-basics.md` 删掉 `### 常见误区`，在 `03-queue-pipe.md` 把追问链改成 2 条 `<details>`，断言 `npm run check:content` 报 V16 并给出文件行号与「实际条数」；恢复后归零
- [ ] T029 [US2] 入口页与页面验收：对 `http://127.0.0.1:4173/backend/learn/` 断言路径分段与每讲层级可见；对 `/backend/learn/concurrency/thread-basics` 断言四要素按顺序渲染（`## TL;DR` 之前是「本讲要解决的问题」）
- [ ] T030 [US2] 反向链接验收：断言 `/backend/components/safe-queue` 列出依赖的知识点，且 `/backend/learn/concurrency/queue-pipe` 底部列出复用它的组件（复用 001 的 `<RelatedLinks>`）
- [ ] T031 [US2] 追问链递进抽查：从 8 页里抽 3 页，逐条核对「后一问依赖前一问」，把抽查页面、条目数与结论写入 `specs/002-content-orchestration/checklists/local-baseline.md`（SC-009 的人工判据）

**Checkpoint**: US1 + US2 构成 MVP（技能可用 + 读者节奏稳定）

---

## Phase 5: User Story 3 - 每次内容迭代回写技能 (Priority: P2)

**Goal**: 迭代有判定记录、技能有变更日志、连续三次无需回写会触发复核

**Independent Test**: 检查最近三次迭代的台账记录；制造连续三条 `no-writeback` 看自检是否判错

- [ ] T032 [P] [US3] 建立 `.dsh/skills/docs-authoring/CHANGELOG.md`：倒序排列，首条记录技能首次落地（日期、改动内容、原因三要素齐备，照 `data-model.md` E1.1）
- [ ] T033 [P] [US3] 编写 `SKILL.md` 第 9 节：优先级声明（宪法 > 内容契约 > 本技能）与变更日志指针
- [ ] T034 [US3] 编写 `SKILL.md` 第 8 节：自检与门禁命令全集（`npm run check:content`、`npm run check:zh`、`npm run check:orchestration`、`npm run export:skill`、`npm run build`）与各自适用时机
- [ ] T035 [US3] 三连负例：在 `ledger/orchestration-decisions.tsv` 追加三条 `decision=no-writeback`、`review=-`，断言 `npm run check:orchestration` 报 S3 并提示缺少复核记录；补一条 `review=recheck:valid` 后归零
- [ ] T036 [US3] 流程演练：对 `docs/backend/learn/01-concurrency/04-async-io.md` 做一次小改，在 `ledger/orchestration-decisions.tsv` 追加一行并按判定回写 `SKILL.md` 或注明无需回写，确认台账能独立回答「这次迭代为什么没改技能」

**Checkpoint**: 迭代留痕与复核机制可用

---

## Phase 6: User Story 4 - 技能可跨仓复用 (Priority: P2)

**Goal**: 导出物可独立使用，指纹保证不与源漂移，发布副本只读

**Independent Test**: 在 `dev/skill` 检出目录里加载技能，确认拿到完整判据；手改导出物后自检判错

- [ ] T037 [US4] 实现 `scripts/export-skill.mjs`：抽取 `<!-- export:begin -->` 与 `<!-- export:end -->` 之间的正文，按 `contracts/export-contract.md` §2 归一化（LF、去行尾空白、去首尾空行、末尾补换行），计算 `sha256` 前 16 位，写出带七字段头部的 `build/skill-export/docs-authoring/SKILL.md`
- [ ] T038 [US4] 接通 S5：`scripts/check-orchestration.mjs` 读导出物头部 `body-sha256-16`，对当前源重新计算并比对；导出物不存在时跳过并打印一行提示
- [ ] T039 [US4] 指纹负例：手改 `build/skill-export/docs-authoring/SKILL.md` 一个字符后断言 S5 判错并提示「源已变更，请重新导出」；重新执行 `npm run export:skill` 后通过
- [ ] T040 [US4] 发布到跨仓：把导出物复制到 `dev/skill` 的 `skills/docs-authoring/SKILL.md`，并在 `dev/skill` 的 `skills/index.tsv` 追加一行（`docs-authoring`、描述、`docs/docs-authoring`），保持与既有行同格式
- [ ] T041 [US4] 跨仓可用性与只读性验证：在 `dev/skill` 检出目录内按技能判据完成一次「新增知识点」的编排决策（不打开本仓契约）；再对已发布的副本跑一次指纹校验（把导出物路径指向该副本），确认未被手改

**Checkpoint**: 跨仓可用 + 漂移可检出 + 发布副本只读

---

## Phase 7: User Story 5 - 三类工具的选用判据与反例 (Priority: P3)

**Goal**: 写作规则、交互图解、云架构静态图的使用边界与反例写进技能

**Independent Test**: 抽查 5 张图解与 5 段正文，核对是否符合技能的选用判据

- [ ] T042 [US5] 编写 `SKILL.md` 第 6 节：写作规则检查（命令、阈值、基线、`--disable` 流程）、交互图解（图型选择表：architecture/sequence/dataflow/lifecycle/workflow + 图注要求 + 放置规则）、云架构静态图边界；每类 ≥3 条反例与降级路径
- [ ] T043 [US5] 与 001 契约对齐并抽查图解：核对技能图型表与 `specs/001-docs-engine/contracts/engine-contract.md`、`specs/001-docs-engine/contracts/content-contract.md` §4 一致；抽查 5 张 `docs/public/diagrams/*.html`，逐张核对「图型与图回答的问题一致」「图注写明该问题」，把结论写入 `specs/002-content-orchestration/checklists/local-baseline.md`
- [ ] T044 [US5] 与门禁对齐：核对 `.dsh/skills/docs-authoring/SKILL.md` 第 6 节的写作规则说明与实际命令一致（`npm run check:zh`、`scripts/ste-lint-zh.baseline` 路径、`--disable` 用法），断言技能里出现的每条命令都能在仓内跑通
- [ ] T045 [US5] 降级演练：在无 Archify 的环境下按技能的降级路径手写一个自包含 SVG/HTML 图解并嵌入一页，跑 `npm run check:content` 通过，并把降级原因写入 `ledger/orchestration-decisions.tsv` 的 `reason`

**Checkpoint**: 工具误用有判据可挡

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 收口、证据、口径对齐

- [ ] T046 门禁全绿：按 `package.json` 依次执行 `npm run check:content`、`npm run check:zh`（已含技能正文）、`npm run check:orchestration`、`npm run build`，四者退出码均为 0
- [ ] T047 按 [quickstart.md](./quickstart.md) 跑完 S0–S8；在 `quickstart.md` 文件头补「计时口径」一节（单一执行者、从打开技能起算、记录起止命令与用时），并用该口径记录 SC-001（≤30 分钟）与 SC-006（≤60 分钟）的实测值
- [ ] T048 评审取证（SC-002）：从 8 页中抽 2 页，按技能判据核查并记录评审用时与结论定位（步骤号与行号），结论写入 `specs/002-content-orchestration/checklists/local-baseline.md`
- [ ] T049 [P] 一致性回归：核对 `.dsh/skills/docs-authoring/SKILL.md`、`specs/001-docs-engine/contracts/content-contract.md`、宪法 VIII 三者无冲突、无重复取值（S1 提供机械证据）
- [ ] T050 [P] 规格与契约口径对齐：把 `specs/002-content-orchestration/spec.md` 的 FR-019 反例条数由「≥1」改为「≥3」；在 FR-002 补路径长度阈值「单知识域 ≤12 讲，阈值以契约为准」；合并 SC-003 与 FR-024、FR-009 与 FR-015 的重复表述（每处保留一条并交叉引用）
- [ ] T051 [P] 清理：删除全部临时夹具与 `build/skill-export/`，确认导出物未入库（`git status` 干净），台账、技能、CHANGELOG 三个文件均已跟踪
- [ ] T052 提交并推送；把 `specs/002-content-orchestration/spec.md` 的 `Status` 由 `Draft` 改为 `Implemented`；在台账追加本轮收口记录并补 `review` 字段

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖；**T001 是本特性首个必做任务**（不做则技能无法入库）；T005 是其余任务的前置（需 001 已入库）
- **Foundational (Phase 2)**: 依赖 Setup；阻塞全部用户故事
- **User Stories (Phase 3–7)**: 均依赖 Foundational
- **Polish (Phase 8)**: 依赖所需用户故事完成

### User Story Dependencies

| 故事 | 依赖 | 说明 |
|---|---|---|
| US1 编排与登记 | Foundational(T006–T017) | 技能正文与登记块迁移 |
| US2 教学节奏 | Foundational(T009/T011)、US1 的模板（松耦合） | 内容收口可独立完成 |
| US3 迭代留痕 | Foundational(T014) | 台账与 CHANGELOG 独立可验 |
| US4 跨仓复用 | Foundational(T015)、US1（技能正文存在） | 导出依赖技能正文 |
| US5 工具判据 | Foundational(T012/T013) | 只改技能第 6 节 |

### 关键顺序约束

1. T001 → T002 → 其余
2. T005（001 依赖确认）→ 所有 Foundational 任务
3. T006/T007（schema）→ T008–T011（V15–V18）
4. T012（自检骨架）→ T013–T015（S1–S5）
5. T016（`teach.path` 回退）→ T023（迁移知识域）与 T029（入口页验收）
6. T017（脚手架）→ T024（四条路径夹具）与 T036（迭代演练）
7. T019（check:zh 范围）→ T046（门禁全绿）
8. T037（导出）→ T038/T039；T040 依赖 T037；T041 依赖 T040
9. T046 依赖全部实现任务；T047/T048 依赖 T046；T050 可独立执行

### Parallel Opportunities

- Phase 1：T002、T003、T004 并行
- Phase 2：T006、T007 并行；T013–T015 建议串行（同一文件）；T016 与 T017 并行
- Phase 3：T020、T021 并行
- Phase 4：T026、T027 并行（不同领域目录）
- Phase 5：T032、T033 并行
- Phase 8：T049、T050、T051 并行

---

## Parallel Example: 技能正文（Phase 3）

```bash
Task: "编写 SKILL.md 第 1–3 节（编排判据与正反例）"
Task: "编写 SKILL.md 第 4–5 节（教学结构与模板）"
```

## Parallel Example: 内容收口（Phase 4）

```bash
Task: "补齐 docs/backend/learn/01-concurrency/ 4 页四要素与追问链递进"
Task: "补齐 docs/frontend/learn/01-engineering/ 4 页四要素与追问链递进"
```

---

## Implementation Strategy

### MVP First

1. Phase 1（含 T001、T005）+ Phase 2（登记块、判据、门禁范围）
2. Phase 3（US1：技能可用、四条新增路径全绿）
3. **停下来验收**：quickstart S1、S3、S7 的技能侧
4. 再加 Phase 4（US2），此时读者已能看到统一讲法

### Incremental Delivery

1. US1 → 技能可用（MVP）
2. US2 → 内容收口，读者可见节奏
3. US3 → 迭代留痕
4. US4 → 跨仓复用
5. US5 → 工具判据与反例
6. Polish → 口径对齐与取证

### 与 plan.md 决策的对应

| 决策 | 任务 |
|---|---|
| R1 落位与忽略收窄 | T001、T002 |
| R2 九节结构 | T020–T022、T033、T034、T042 |
| R3 四要素落位 | T009、T011、T026、T027 |
| R4 登记块与兼容读法 | T006、T007、T016、T023 |
| R5 台账与连续三次 | T014、T018、T035、T036 |
| R6 校验分工与编号 | T008–T015 |
| R7 导出与指纹 | T037–T041 |
| R8 既有内容收口 | T023、T026、T027、T052 |

### analyze 整改对应表（v2 新增）

| 发现 | 严重度 | 整改任务 |
|---|---|---|
| C1 SC-002 评审用时无任务 | HIGH | T048 |
| C2 SC-008 图型抽查无任务 | MEDIUM | T043 |
| C3 FR-007 追问链递进无验证 | MEDIUM | T026、T027、T031 |
| C4 FR-023 新增组件路径无演练 | MEDIUM | T017、T024 |
| C5 脚手架自动追加无验证 | MEDIUM | T024 |
| A1 SC-001/006 计时口径缺失 | MEDIUM | T047 |
| I1 FR-019 与契约反例条数不一致 | MEDIUM | T050 |
| I2 未声明 001 依赖 | MEDIUM | T005（含 Prerequisites 说明） |
| D1 技能正文不在中文门禁内 | MEDIUM | T019、T046 |
| C6 发布副本只读性未验证 | MEDIUM | T041 |
| D2/D3/I3 重复与阈值口径 | LOW | T050 |

---

## Notes

- [P] 任务指不同文件、无未完成依赖
- 每个任务完成后单独提交，提交信息带任务号（如 `feat(002): T001 收窄技能目录忽略规则`）
- 夹具一律建在系统临时目录或临时路径，验证后删除，MUST NOT 提交
- 修改技能的每个任务都必须同时在 `CHANGELOG.md` 追加一条（T032 建立的机制）
- 台账的每次追加都属一次内容迭代判定，MUST 与技能变更分开记录
- T050 会改动 002 的 `spec.md`：改完若要复核一致性，再跑一次 `/speckit-analyze`
