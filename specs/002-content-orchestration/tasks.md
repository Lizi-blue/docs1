---

description: "Task list for feature 002-content-orchestration (v4, 含三轮 /speckit-analyze 整改)"

---

# Tasks: 内容编排与教学法技能（content-orchestration）

## 实现进度（2026-10-11，/speckit-implement 首轮）

**已完成 45 项，剩余 15 项。已完成（勾选项）**：T001–T029、T032–T036、T038–T042、T044–T046，以及 T049、T053、T058。
判据：`check:content` 0 错 0 警、`check:zh` 硬违规 0、`check:orchestration` S1–S7 通过、`build` 成功、
9 条路由 200、组件自测 1 passed（3 条因沙箱禁 `sem_open` 跳过，CI 内执行）。

**未完成（保持未勾选，留给下一轮）**：
T030/T031 四条脚手架路径的完整夹具取证 · T037 追问链 3 页抽查记录 · T043 真实迭代演练 ·
T047/T048 发布到 `dev/skill` 与跨仓可用性验证 · T050 图型抽查 5 张 · T051 门禁对齐复核 ·
T052 降级演练 · T054 quickstart S0–S8 全跑 · T055 评审取证 · T056 一致性回归 ·
T057 规格口径对齐 · T059 最近三次迭代齐全性 · T060 Status 改 Implemented。

**本轮由 Lead 发现并修复的真实缺陷**（详见 `checklists/local-baseline.md`）：
V17 知识域路径算错 · `::items` 双冒号致 API 表不渲染 · `check:zh` 目录入参报错 ·
中文门禁 69 处假阳性 · `teach.path` 迁移后引擎未回退（入口页路径分段归零）· 组件自测 dataclass 报错。

**Input**: Design documents from `/specs/002-content-orchestration/`

**Prerequisites**: [plan.md](./plan.md)（落位与六项关键决策）、[spec.md](./spec.md)（5 个用户故事，25 FR / 10 SC）、
[research.md](./research.md)（8 项决策）、[data-model.md](./data-model.md)（4 类实体与 V15–V18 / S1–S6）、
[contracts/](./contracts/skill-contract.md)（技能 / 台账 / 导出 / 校验四份契约）、
[quickstart.md](./quickstart.md)（S0–S8）、
[.specify/memory/constitution.md](../../.specify/memory/constitution.md)（v1.1.0，原则 VIII 为本特性依据）

**跨特性依赖**：本特性的 T035、T036 依赖 `001-docs-engine` 的引擎实现与既有内容已在仓库中
（`docs/.vitepress/**`、`scripts/check-content.mjs`、8 个知识点页）。001 的实现尚未入库，T005 负责确认或补齐。

**Tests**: 仅在规格明确要求处生成：内容门禁负例（夹具）、连续三次台账规则负例、S6/S7 负例、导出指纹负例。
其余以 quickstart 剧本验收。

**Organization**: 按用户故事分阶段，零新增依赖，脚本复用 001 的解析层
（`buildDocTree` 与 `normalizeLink`）。

**v4 变更来源**：第三轮 `/speckit-analyze`（002）的 3 项 MEDIUM（F6 流程演练丢失、F7 `--export-path`
重复实现、F8 基线单调性无判据）与 2 项 LOW（F9 mapping 表 ID、F10 仓外路径口径）。
自检规则由 6 条增至 **7 条**（新增 S7）。三轮整改的完整对应见文末。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1…US5）
- 每个任务都带确切文件路径；data-model.md 的字段约束在任务里逐字引用

## Path Conventions

技能在 `.dsh/skills/docs-authoring/`，台账在 `ledger/`，脚本在 `scripts/`，schema 在 `schemas/`，
内容在 `docs/`，设计源在 `specs/002-content-orchestration/contracts/`。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 让技能可以入库，准备好目录与命令入口，并确认对 001 的依赖已满足

- [x] T001 收窄忽略规则：把 `.gitignore` 中的 `.dsh/` 改为 `.dsh/skills/speckit-*`，注释说明「只忽略 spec-kit 生成的同名技能副本」，并用 `git check-ignore -v .dsh/skills/docs-authoring/SKILL.md` 确认不再被忽略
- [x] T002 [P] 建目录骨架：`.dsh/skills/docs-authoring/`、`ledger/`，并把 `build/` 加入 `.gitignore`（导出物不入库）
- [x] T003 [P] 在 `package.json` 的 `scripts` 增加 `check:orchestration`（`node scripts/check-orchestration.mjs`）与 `export:skill`（`node scripts/export-skill.mjs`）
- [x] T004 [P] 在 `schemas/teach-block.schema.json` 文件头注释写明「设计源在 `specs/002-content-orchestration/contracts/schemas/teach-block.schema.json`，改动必须同步」
- [x] T005 确认 001 依赖已满足：`git log --oneline -- docs/.vitepress scripts/check-content.mjs docs/backend` 有入库记录，且 `npm run build` 通过；若未入库，先执行 001 的 T001（WIP 提交）再继续本特性

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 登记块、四要素判据、台账、自检骨架、三处契约补充与技能正文的中文门禁范围

**⚠️ CRITICAL**: 本阶段不完成，US1–US5 无法独立验收

- [x] T006 [P] 落地 `schemas/teach-block.schema.json`：五字段必填，`audience` 10–80 字、`prerequisites` ≥1 条且每条 ≤60 字、`outcomes` 1–5 条且每条 10–80 字、`path` ≥1 段含 `from`/`to`、`lessons` ≥1 条含 `slug`/`goal`（10–60 字），`additionalProperties: false`
- [x] T007 [P] 扩写 `schemas/dir-meta.schema.json`：新增可选 `teach` 键并引用上一步的 schema 语义；文件头注明「知识域目录必填」
- [x] T008 在 `scripts/check-content.mjs` 实现 **V15**：知识域 `_meta.yml` 存在 `teach` 块且五字段类型正确；失败输出文件名、缺失字段与模板片段
- [x] T009 在 `scripts/check-content.mjs` 实现 **V16**：四个教学要素标题存在（`### 本讲要解决的问题`、`### 常见误区`、`### 面试追问链`、`### 下一讲衔接`），且 `### 面试追问链` 节内 `<details>` 条目为 3–5 条
- [x] T010 在 `scripts/check-content.mjs` 实现 **V17**：`teach.lessons[].slug` 归一化后与知识点页 URL 双向完整，输出「幽灵条目」与「未登记页面」两份清单
- [x] T011 在 `scripts/check-content.mjs` 实现 **V18**：各要素标题下 ≥1 行实质文本；`### 常见误区` ≥1 条列表项；`### 下一讲衔接` 含至少一个页面链接
- [x] T012 实现 `scripts/check-orchestration.mjs` 骨架：规则注册表（S1–S7）、`--json` 输出（`{ ok, errors: [{code,message,fix,subject}] }`）、退出码 `0/1/2`
- [x] T013 在 `scripts/check-orchestration.mjs` 实现 **S1**（技能内取值零复制：成组字段名 ≥3 个、阈值数字、目录树结构块）与 **S2**（九个必需章节齐全且顺序正确，见 `contracts/skill-contract.md` §2）
- [x] T014 在 `scripts/check-orchestration.mjs` 实现 **S3**：`ledger/orchestration-decisions.tsv` 表头逐字为 `date	iteration	scope	decision	reason	review`、列数一致、`decision ∈ {writeback,no-writeback}`、`review ∈ {-,recheck:valid,recheck:update}`；从表尾向前统计连续 `no-writeback`，达到 3 条且其后无 `recheck:*` 即判错
- [x] T015 在 `scripts/check-orchestration.mjs` 实现 **S4**（技能内指向仓内文件的指针可达）与 **S5 的缺省分支**（读 `build/skill-export/docs-authoring/SKILL.md` 的 `body-sha256-16` 与当前源比对；导出物不存在则跳过并打印提示）。路径参数由 T045 实现，本任务 MUST NOT 重复实现
- [x] T016 [P] 在 `specs/002-content-orchestration/contracts/check-contract.md` §3 增加 **S6** 定义：`SKILL.md` 首部版本号 MUST 等于 `CHANGELOG.md` 最新条目的版本，且最新条目日期 MUST ≥ 正文最后修改日期
- [x] T017 [P] 在 `specs/002-content-orchestration/contracts/export-contract.md` §6 增加 `--export-path <file>` 参数定义：用法、缺省值、**接受仓内相对路径与仓外绝对路径**、目标不存在时退出码 1 并给出提示
- [x] T018 [P] 在 `specs/002-content-orchestration/contracts/check-contract.md` §3 增加 **S7** 定义：基线只减不增——从台账 `reason` 中提取最近一条 `baseline:<N>`，与 `scripts/ste-lint-zh.baseline` 的当前值比对，当前值更大即判错；同时约定「改动基线 MUST 在 `reason` 写 `baseline:<N>`」
- [x] T019 在 `docs/.vitepress/plugins/doc-engine.ts` 支持 `teach.path ?? path` 回退读取知识域路径，并在 `KnowledgeDomainNode` 暴露 `teach` 摘要；同步更新 `docs/.vitepress/theme/components/EntryIndex.vue` 使用回退后的路径
- [x] T020 扩写 `scripts/new-content.mjs`：`knowledge-domain` 生成含五字段的 `teach` 块骨架；`knowledge` 追加页面时自动在其知识域 `teach.lessons` 追加 `{ slug, goal: "<待填，10–60 字>" }`，并在目标页骨架生成四个教学要素标题；`component` 生成组件页骨架（含三种引用方式标题）
- [x] T021 建立 `ledger/orchestration-decisions.tsv`：写入固定表头与首条记录（`date=2026-10-11`、`iteration=002-content-orchestration`、`scope=技能首次落地`、`decision=writeback`、`reason=-`、`review=-`）
- [x] T022 把技能正文纳入中文门禁范围：把 `package.json` 的 `check:zh` 改为同时检查 `docs` 与 `.dsh/skills/docs-authoring`；把首次数值写入 `scripts/ste-lint-zh.baseline`，并在台账 `reason` 写 `baseline:<首次数值>`、在 `CHANGELOG.md` 记录「只减不增」承诺（宪法 IV 留痕 + S7 数据源）
- [x] T023 在 `scripts/check-orchestration.mjs` 实现 **S6**（版本 ↔ 变更日志一致），按 T016 的契约定义输出失败原因与修法
- [x] T024 在 `scripts/check-orchestration.mjs` 实现 **S7**（基线单调性），按 T018 的契约定义读取台账 `baseline:<N>` 与基线文件比对
- [x] T025 S7 负例：把 `scripts/ste-lint-zh.baseline` 的数值调大且不改台账，断言 `npm run check:orchestration` 报 S7 并给出两次数值；恢复后归零

**Checkpoint**: `check:content`、`check:orchestration`（S1–S7）、`check:zh` 三条命令均可运行并给出可定位结论

---

## Phase 3: User Story 1 - 作者按统一编排落地一个新知识域 (Priority: P1) 🎯 MVP

**Goal**: 技能给出可判定的编排判据与可套用模板；作者照做即可产出合规内容

**Independent Test**: 用脚手架新建一个最小领域（含知识域、知识点、组件页）并跑内容门禁全绿；
再按技能判据手工判断两个边界场景（该不该拆页、路径是否过长）

- [x] T026 [P] [US1] 编写 `.dsh/skills/docs-authoring/SKILL.md` 第 1–3 节：何时加载、目录落位与命名、四类编排判据（知识点拆分与合并、知识域划分、路径排法与长度、组件与知识点对应），每类含可判定条件、一个正例、一个反例（照 `contracts/skill-contract.md` §3）
- [x] T027 [P] [US1] 编写 `SKILL.md` 第 4–5 节：每讲教学结构（四要素的标题、位置、写法）与模板（`teach` 块、知识点页骨架、组件页骨架、路径声明），模板可直接复制
- [x] T028 [US1] 编写 `SKILL.md` 第 7 节（常见错误与修法 ≥5 条）并补文件头：YAML frontmatter（`name: docs-authoring` + `description`）与「技能版本：1.0.0」；同步确保 `CHANGELOG.md` 有对应首条记录（版本与日期一致，S6 通过）
- [x] T029 [US1] 迁移 2 个既有知识域到 `teach` 块：`docs/backend/learn/01-concurrency/_meta.yml` 与 `docs/frontend/learn/01-engineering/_meta.yml`（五字段齐全、`lessons` 覆盖各自 4 页、`path` 迁入后删除顶层 `path`）
- [ ] T030 [US1] 夹具验证四条路径：在临时夹具依次用 `node scripts/new-content.mjs` 建 `domain`、`knowledge-domain`、`knowledge`、`component`，断言：内容门禁 V15–V18 全绿；建知识点后其知识域 `teach.lessons` 自动多一条且 V17 通过；建组件页后 V8（三种引用方式）通过；删除夹具并记录
- [ ] T031 [US1] 把 T030 的结论（含四条路径的命令与输出摘要）写入 `specs/002-content-orchestration/checklists/local-baseline.md`

**Checkpoint**: US1 独立可验（技能可用、登记可迁移、四条新增路径全绿）

---

## Phase 4: User Story 2 - 读者获得稳定的学习节奏 (Priority: P1)

**Goal**: 每讲四要素齐备且追问链递进；入口页呈现路径与层级

**Independent Test**: 抽查任意三讲，核对四要素、追问链条数（3–5）与递进关系；打开入口页确认路径分段与推荐起点

- [x] T032 [P] [US2] 补齐 `docs/backend/learn/01-concurrency/` 4 页（`01-thread-basics.md`、`02-process-basics.md`、`03-queue-pipe.md`、`04-async-io.md`）的四要素：新增 `### 本讲要解决的问题`（`## TL;DR` 之前）、`### 常见误区`（≥2 条列表项）、`### 下一讲衔接`（含下一讲链接）；核对 `### 面试追问链` 为 3–5 条，且后一问依赖前一问的结论
- [x] T033 [P] [US2] 补齐 `docs/frontend/learn/01-engineering/` 4 页（`01-single-html-entry.md`、`02-npm-and-modules.md`、`03-vite-dev-and-build.md`、`04-project-structure.md`）的四要素，要求同上
- [x] T034 [US2] 负例夹具：在 `docs/backend/learn/01-concurrency/01-thread-basics.md` 删掉 `### 常见误区`，在 `03-queue-pipe.md` 把追问链改成 2 条 `<details>`，断言 `npm run check:content` 报 V16 并给出文件行号与「实际条数」；恢复后归零
- [x] T035 [US2] 入口页与页面验收：对 `http://127.0.0.1:4173/backend/learn/` 断言路径分段与每讲层级可见；对 `/backend/learn/concurrency/thread-basics` 断言四要素按顺序渲染（`## TL;DR` 之前是「本讲要解决的问题」）
- [x] T036 [US2] 反向链接验收：断言 `/backend/components/safe-queue` 列出依赖的知识点，且 `/backend/learn/concurrency/queue-pipe` 底部列出复用它的组件（复用 001 的 `<RelatedLinks>`）
- [ ] T037 [US2] 追问链递进抽查：从 8 页里抽 3 页，逐条核对「后一问依赖前一问」，把抽查页面、条目数与结论写入 `specs/002-content-orchestration/checklists/local-baseline.md`（SC-009 的人工判据）

**Checkpoint**: US1 + US2 构成 MVP（技能可用 + 读者节奏稳定）

---

## Phase 5: User Story 3 - 每次内容迭代回写技能 (Priority: P2)

**Goal**: 迭代有判定记录、技能有变更日志、连续三次无需回写会触发复核，版本与基线均一致

**Independent Test**: 检查最近三次迭代的台账记录；制造连续三条 `no-writeback` 看 S3 是否判错；
改技能版本看 S6、改基线看 S7；完成一次真实迭代演练

- [x] T038 [P] [US3] 建立 `.dsh/skills/docs-authoring/CHANGELOG.md`：倒序排列，首条记录技能首次落地（日期、改动内容、原因三要素齐备，照 `data-model.md` E1.1），并与 `SKILL.md` 首部版本号一致
- [x] T039 [P] [US3] 编写 `SKILL.md` 第 9 节：优先级声明（宪法 > 内容契约 > 本技能）与变更日志指针
- [x] T040 [US3] 编写 `SKILL.md` 第 8 节：自检与门禁命令全集（`npm run check:content`、`npm run check:zh`、`npm run check:orchestration`、`npm run export:skill`、`npm run build`）、S6 版本一致性要求与 S7 基线只减不增流程
- [x] T041 [US3] 三连负例：在 `ledger/orchestration-decisions.tsv` 追加三条 `decision=no-writeback`、`review=-`，断言 `npm run check:orchestration` 报 S3 并提示缺少复核记录；补一条 `review=recheck:valid` 后归零
- [x] T042 [US3] 版本一致性负例（S6）：把 `.dsh/skills/docs-authoring/SKILL.md` 首部版本改为 `1.0.1` 而不动 `CHANGELOG.md`，断言 S6 判错并指出两处版本；改回后归零
- [ ] T043 [US3] 迭代演练（FR-010 端到端）：对 `docs/backend/learn/01-concurrency/04-async-io.md` 做一次小改，在 `ledger/orchestration-decisions.tsv` 追加一行并按判定回写 `SKILL.md`（同时递增版本与 `CHANGELOG.md`）或注明无需回写；确认台账能独立回答「这次迭代为什么没改技能」

**Checkpoint**: 迭代留痕、复核、版本一致性与基线单调性均可验

---

## Phase 6: User Story 4 - 技能可跨仓复用 (Priority: P2)

**Goal**: 导出物可独立使用，指纹保证不与源漂移，发布副本只读可校验

**Independent Test**: 在 `dev/skill` 检出目录里加载技能，确认拿到完整判据；手改导出物后自检判错

- [x] T044 [US4] 实现 `scripts/export-skill.mjs`：抽取 `<!-- export:begin -->` 与 `<!-- export:end -->` 之间的正文，按 `contracts/export-contract.md` §2 归一化（LF、去行尾空白、去首尾空行、末尾补换行），计算 `sha256` 前 16 位，写出带七字段头部的 `build/skill-export/docs-authoring/SKILL.md`
- [x] T045 [US4] 在 `scripts/check-orchestration.mjs` 实现 S5 的 `--export-path <file>` 参数（**唯一实现点**）：接受仓内相对路径与仓外绝对路径，路径不存在时退出码 1 并给出提示；缺省仍用 `build/skill-export/docs-authoring/SKILL.md`（契约见 `contracts/export-contract.md` §6）
- [x] T046 [US4] 指纹负例：手改 `build/skill-export/docs-authoring/SKILL.md` 一个字符后断言 S5 判错并提示「源已变更，请重新导出」；重新执行 `npm run export:skill` 后通过
- [ ] T047 [US4] 发布到跨仓：把导出物复制到 `dev/skill` 的 `skills/docs-authoring/SKILL.md`，并在 `dev/skill` 的 `skills/index.tsv` 追加一行（`docs-authoring`、描述、`docs/docs-authoring`），保持与既有行同格式
- [ ] T048 [US4] 跨仓可用性与只读性验证：在 `dev/skill` 检出目录内按技能判据完成一次「新增知识点」的编排决策（不打开本仓契约）；再用 `--export-path` 指向已发布副本跑一次指纹校验，确认未被手改

**Checkpoint**: 跨仓可用 + 漂移可检出 + 发布副本只读可验证

---

## Phase 7: User Story 5 - 三类工具的选用判据与反例 (Priority: P3)

**Goal**: 写作规则、交互图解、云架构静态图的使用边界与反例写进技能

**Independent Test**: 抽查 5 张图解与 5 段正文，核对是否符合技能的选用判据

- [x] T049 [US5] 编写 `SKILL.md` 第 6 节：写作规则检查（命令、阈值、基线、`--disable` 流程）、交互图解（图型选择表：architecture/sequence/dataflow/lifecycle/workflow + 图注要求 + 放置规则）、云架构静态图边界；每类 ≥3 条反例与降级路径
- [ ] T050 [US5] 与 001 契约对齐并抽查图解：核对技能图型表与 `specs/001-docs-engine/contracts/engine-contract.md`、`specs/001-docs-engine/contracts/content-contract.md` §4 一致；抽查 5 张 `docs/public/diagrams/*.html`，逐张核对「图型与图回答的问题一致」「图注写明该问题」，把结论写入 `specs/002-content-orchestration/checklists/local-baseline.md`
- [ ] T051 [US5] 与门禁对齐：核对 `.dsh/skills/docs-authoring/SKILL.md` 第 6 节的写作规则说明与实际一致（`npm run check:zh`、`scripts/ste-lint-zh.baseline` 的 S7 流程、`--disable` 用法），断言技能里出现的每条命令都能在仓内跑通
- [ ] T052 [US5] 降级演练：在无 Archify 的环境下按技能的降级路径手写一个自包含 SVG/HTML 图解并嵌入一页，跑 `npm run check:content` 通过，并把降级原因写入 `ledger/orchestration-decisions.tsv` 的 `reason`

**Checkpoint**: 工具误用有判据可挡

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 收口、证据、口径对齐

- [x] T053 门禁全绿：按 `package.json` 依次执行 `npm run check:content`、`npm run check:zh`（已含技能正文）、`npm run check:orchestration`（S1–S7）、`npm run build`，四者退出码均为 0
- [ ] T054 按 [quickstart.md](./quickstart.md) 跑完 S0–S8；在 `quickstart.md` 文件头补「计时口径」一节（单一执行者、从打开技能起算、记录起止命令与用时），并用该口径记录 SC-001（≤30 分钟）与 SC-006（≤60 分钟）的实测值
- [ ] T055 评审取证（SC-002）：从 8 页中抽 2 页，按技能判据核查并记录评审用时与结论定位（步骤号与行号），结论写入 `specs/002-content-orchestration/checklists/local-baseline.md`
- [ ] T056 [P] 一致性回归：核对 `.dsh/skills/docs-authoring/SKILL.md`、`specs/001-docs-engine/contracts/content-contract.md`、宪法 VIII 三者无冲突、无重复取值（附 S1、S6、S7 的输出作为机械证据）
- [ ] T057 [P] 规格与契约口径对齐（属规格措辞修正，不改需求集合）：把 `specs/002-content-orchestration/spec.md` 的 FR-019 反例条数由「≥1」改为「≥3」；在 FR-002 补路径长度阈值「单知识域 ≤12 讲，阈值以契约为准」；合并 SC-003 与 FR-024、FR-009 与 FR-015 的重复表述（每处保留一条并交叉引用）
- [x] T058 [P] 清理：删除全部临时夹具与 `build/skill-export/`，确认导出物未入库（`git status` 干净），台账、技能、CHANGELOG 三个文件均已跟踪
- [ ] T059 核对最近三次内容迭代均有台账记录（SC-004）：检查 `ledger/orchestration-decisions.tsv` 最近三条的 `iteration`、`decision`、`reason` 是否齐全（含 T043 的演练记录），缺则补齐并把结论写入 `specs/002-content-orchestration/checklists/local-baseline.md`
- [ ] T060 提交并推送；把 `specs/002-content-orchestration/spec.md` 的 `Status` 由 `Draft` 改为 `Implemented`；在台账追加本轮收口记录并补 `review` 字段

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
| US1 编排与登记 | Foundational(T006–T020) | 技能正文与登记块迁移 |
| US2 教学节奏 | Foundational(T009/T011)、US1 的模板（松耦合） | 内容收口可独立完成 |
| US3 迭代留痕 | Foundational(T014/T016/T018/T023/T024)、US1（版本首部存在） | 台账、CHANGELOG、S6、S7 独立可验 |
| US4 跨仓复用 | Foundational(T015)、US1（技能正文存在） | 参数实现见 T045 |
| US5 工具判据 | Foundational(T012/T013) | 只改技能第 6 节 |

### 关键顺序约束

1. T001 → T002 → 其余
2. T005（001 依赖确认）→ 所有 Foundational 任务
3. T006/T007（schema）→ T008–T011（V15–V18）
4. T012（自检骨架）→ T013–T015、T023、T024、T045
5. T016/T018（契约补充）→ T023/T024（S6/S7 实现）
6. T018 → T022（台账写 `baseline:<N>`）→ T024 → T025（S7 负例）
7. T019（`teach.path` 回退）→ T029（迁移知识域）与 T035（入口页验收）
8. T020（脚手架）→ T030（四条路径夹具）与 T043（迭代演练）
9. T022（check:zh 范围）→ T053（门禁全绿）
10. T038（CHANGELOG）→ T028（版本一致性）与 T042（S6 负例）
11. T044（导出）→ T045/T046；T047 依赖 T044；T048 依赖 T045 与 T047
12. T053 依赖全部实现任务；T054/T055/T059 依赖 T053；T057 可独立执行

### Parallel Opportunities

- Phase 1：T002、T003、T004 并行
- Phase 2：T006、T007、T016、T017、T018 并行；T013–T015 与 T023–T024 建议串行（同一文件）；T019 与 T020 并行
- Phase 3：T026、T027 并行
- Phase 4：T032、T033 并行（不同领域目录）
- Phase 5：T038、T039 并行
- Phase 8：T056、T057、T058 并行

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

1. Phase 1（含 T001、T005）+ Phase 2（登记块、判据、三处契约补充、S1–S7）
2. Phase 3（US1：技能可用、四条新增路径全绿）
3. **停下来验收**：quickstart S1、S3、S7 的技能侧
4. 再加 Phase 4（US2），此时读者已能看到统一讲法

### Incremental Delivery

1. US1 → 技能可用（MVP）
2. US2 → 内容收口，读者可见节奏
3. US3 → 迭代留痕、版本与基线一致
4. US4 → 跨仓复用与副本只读校验
5. US5 → 工具判据与反例
6. Polish → 口径对齐、取证与清理

### 与 plan.md 决策的对应

| 决策 | 任务 |
|---|---|
| R1 落位与忽略收窄 | T001、T002 |
| R2 九节结构 | T026–T028、T039、T040、T049 |
| R3 四要素落位 | T009、T011、T032、T033 |
| R4 登记块与兼容读法 | T006、T007、T019、T029 |
| R5 台账与连续三次 | T014、T021、T041、T043 |
| R6 校验分工与编号 | T008–T018、T023–T025 |
| R7 导出与指纹 | T044–T048（参数在 T045） |
| R8 既有内容收口 | T029、T032、T033、T060 |

### analyze 整改对应表（含三轮）

| 轮次 | 发现 | 严重度 | 整改任务 |
|---|---|---|---|
| 一 | C1 SC-002 评审用时无任务 | HIGH | T055 |
| 一 | C2 图型抽查无任务 | MEDIUM | T050 |
| 一 | C3 追问链递进无验证 | MEDIUM | T032、T033、T037 |
| 一 | C4 新增组件路径无演练 | MEDIUM | T020、T030 |
| 一 | C5 脚手架自动追加无验证 | MEDIUM | T030 |
| 一 | A1 计时口径缺失 | MEDIUM | T054 |
| 一 | I1 反例条数不一致 | MEDIUM | T057 |
| 一 | I2 未声明 001 依赖 | MEDIUM | T005 |
| 一 | D1 技能正文不在中文门禁内 | MEDIUM | T022、T053 |
| 一 | C6 发布副本只读性未验证 | MEDIUM | T048 |
| 一 | D2/D3/I3 重复与阈值口径 | LOW | T057 |
| 二 | F1 变更日志无机械检查 | MEDIUM | T016、T023、T042 |
| 二 | F2 导出路径无覆盖能力 | MEDIUM | T017、T045、T048 |
| 二 | F3 SC-004 无验证任务 | MEDIUM | T059 |
| 二 | F4 规格改动留痕 | LOW | T057 |
| 二 | F5 中文基线留痕 | LOW | T022 |
| 三 | **F6 流程演练丢失** | MEDIUM | **T043**（US3 恢复为 6 条） |
| 三 | **F7 `--export-path` 重复实现** | MEDIUM | **T015 与 T045 分工**（参数归 T045） |
| 三 | **F8 基线单调性无判据** | MEDIUM | **T018、T024、T025**（新增 S7） |
| 三 | F9 mapping 表 ID 过期 | LOW | 本版已更新 mapping 表 |
| 三 | F10 仓外路径口径 | LOW | T017 |

---

## Notes

- [P] 任务指不同文件、无未完成依赖
- 每个任务完成后单独提交，提交信息带任务号（如 `feat(002): T001 收窄技能目录忽略规则`）
- 夹具一律建在系统临时目录或临时路径，验证后删除，MUST NOT 提交
- 修改技能的每个任务都必须同时在 `CHANGELOG.md` 追加一条并递增版本（T038 建立的机制，S6 机械校验）
- 改动中文基线时 MUST 在台账 `reason` 写 `baseline:<N>`，否则 S7 无法判定单调性
- 台账的每次追加都属一次内容迭代判定，MUST 与技能变更分开记录
- T057 会改动 002 的 `spec.md`：改完若要复核一致性，再跑一次 `/speckit-analyze`
