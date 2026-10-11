---

description: "Task list for feature 001-docs-engine"

---

# Tasks: 技术面试备考文档引擎（docs-1）

## 实现进度（2026-10-11 收口轮：47/47 完成）

判据集中在 `checklists/local-baseline.md`（S1–S10 执行记录 + 门禁实测 + 缺陷清单）。

- 门禁：`check:content` 0 错 0 警 · `check:zh` 硬违规 0 · `check:orchestration` S1–S7 ·
  `test:component` 通过 · `selftest:gates` 9/9 · `check:extensibility` E1–E10 · `check:responsive` R1–R7 · `build` 成功
- 线上：CI Run #4377 全绿，镜像 tag `c94c52f`，`https://docs1.minilab.uzibird.cn/` 与 12 条路由 200
- 两处口径修正：正文禁止 `<EntryIndex>`（避免重复渲染）；V13/V14 补进 data-model


**Input**: Design documents from `/specs/001-docs-engine/`

**Prerequisites**: [plan.md](./plan.md)（技术栈与结构）、[spec.md](./spec.md)（6 个用户故事）、
[research.md](./research.md)（16 项选型）、[data-model.md](./data-model.md)（实体与 V1–V12 校验规则）、
[contracts/](./contracts/content-contract.md)（内容/引擎/工具/交付四份契约）、
[quickstart.md](./quickstart.md)（S1–S10 验收剧本）、
[.specify/memory/constitution.md](../../.specify/memory/constitution.md)（v1.0.0）

**Tests**: 仅在规格或宪法明确要求处生成测试任务 —— 组件自测（宪法 VI / FR-041）、
零配置扩展断言（FR-010）、千页预算检查（FR-040）、门禁负例（FR-023、FR-034）。
其余以 quickstart 剧本作为验收手段。

**Organization**: 按用户故事分阶段。仓库中已有可运行的引擎骨架（见 plan.md「当前实现状态」），
因此「实现」类任务多为一页之内的收口与门禁补齐，delta 与 plan.md 的 T01–T12 一一对应。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1…US6）
- 每个任务都带确切文件路径

## Path Conventions

单项目结构：站点与引擎在 `docs/`，创作期工具在 `scripts/` 与 `diagrams/`，契约在 `schemas/`，
交付物在仓根与 `deploy/`。详见 plan.md「Source Code (repository root)」。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 固化当前基线，避免后续任务的改动与「已实现但未提交」的代码混在一起

- [x] T001 把现有引擎实现与产物做一次 WIP 提交：`docs/`、`diagrams/src/`、`docs/public/diagrams/`、`scripts/gen-diagrams.sh`、`package.json`、`package-lock.json`、`.npmrc`、`.gitignore`（提交信息写明「引擎骨架 + 7 张图解 + 示例内容骨架」）
- [x] T002 记录本地基线证据：执行 `npm ci && npm run build`，把构建时长、产物页面数与 quickstart S1 的 9 条路由状态写入 `specs/001-docs-engine/checklists/local-baseline.md`
- [x] T003 [P] 在 `package.json` 补 `engines`（`node >=22`）与脚本别名 `test:component`（`python3 -m pytest tests/ -q`）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 内容契约的机器可执行形态。没有它，任何内容类用户故事都无法被机械验收

**⚠️ CRITICAL**: US1–US6 的验收都依赖本阶段完成

- [x] T004 [P] 落地目录元数据 schema 到 `schemas/dir-meta.schema.json`，内容以 `specs/001-docs-engine/contracts/schemas/dir-meta.schema.json` 为准，并在文件头注明「契约目录是设计源，本文件是运行时副本，改动必须同步」
- [x] T005 [P] 落地页面元数据 schema 到 `schemas/page-frontmatter.schema.json`，四类页面（`knowledge` / `component` / `cross-component` / `landing`）的必填字段、枚举与 `additionalProperties: false` 逐字对齐契约
- [x] T006 实现 `scripts/check-content.mjs` 骨架：复用 `docs/.vitepress/plugins/doc-engine.ts` 的 `buildDocTree` 与 `docs/.vitepress/shared/links.ts` 的 `normalizeLink`，支持 `--root docs`、`--json`，退出码 `0` 通过 / `1` 有错误 / `2` 脚本异常
- [x] T007 在 `scripts/check-content.mjs` 实现规则 V1–V6：`_meta.yml` 至多一份且可解析、`type` 白名单、未知字段判错、按类型必填字段、`url` 全局唯一与同目录 slug 不重复、`NN-` 命名规则
- [x] T008 在 `scripts/check-content.mjs` 实现规则 V7–V9：知识点四段式必需小节（标题逐字对齐 `contracts/content-contract.md` §4）、组件页含安装命令/核心源码/≥3 种引用方式、所有链接字段在 `linkMap` 命中
- [x] T009 在 `scripts/check-content.mjs` 实现规则 V10–V14：`<DiagramFrame>` 引用的产物存在且不含外部 `http(s)://` 资源、入口页存在且条目数等于实际页面数、`tags_index` 非空且小写短标签、`<ApiTable>`/`<CodeTabs>` 载荷可解析（含 HTML 实体反转义）、未知 frontmatter 字段
- [x] T010 [P] 实现 `scripts/new-content.mjs`：支持 `domain` / `knowledge-domain` / `knowledge` / `component` / `cross-component` / `entry` 六种 kind，`--domain`、`--knowledge-domain`、`--order`、`--dry-run`；目标已存在时打印冲突路径并退出码 1；`domain` 必须同时生成 `learn/`、`components/` 与两个 `index.md`
- [x] T011 [P] vendored `scripts/ste-lint-zh.py`（取自 `lemonhall/asd-ste100-skill-zh`，逐字节入库）并建立基线文件 `scripts/ste-lint-zh.baseline`（初值按实测填入）
- [x] T012 [P] 编写 `AGENTS.md`：受控中文规则全文（一句一动作、说明句 ≤40 字、禁分号连动作、禁虚动词/套话/营销词、不改情态置信度）、机械检查命令、豁免与基线规则
- [x] T013 [P] 编写 `README.md`：新增领域 / 知识域 / 知识点 / 组件的最少步骤（脚手架命令 + 校验命令 + 验收命令），并指向内容契约与宪法

**Checkpoint**: `npm run check:content` 与 `npm run check:zh` 可运行且对当前内容给出结论

---

## Phase 3: User Story 1 - 零配置新增知识领域 (Priority: P1) 🎯 MVP

**Goal**: 新增领域只建目录与文件，导航、侧边栏、入口页自动生长，且零配置扩展可被机械证明

**Independent Test**: 在临时夹具上新建一个最小领域，断言该领域出现在导航与侧边栏、其知识点页可访问、引擎与配置文件改动数为 0

- [x] T014 [P] [US1] 新建 `scripts/assert-extensibility.mjs`：在系统临时目录构造 `docs/<fixture>/`（`_meta.yml` + `learn/<NN-kd>/` + 1 个知识点页 + 两个入口），调用 `buildDocTree` 断言领域与页面出现，并断言 `git status --porcelain` 中 `docs/.vitepress/**` 与 `package.json` 无改动
- [x] T015 [US1] 在 `docs/.vitepress/plugins/doc-engine.ts` 补「入口缺失」诊断：领域缺 `learn/index.md` 或 `components/index.md` 时记 warning；在 `docs/.vitepress/theme/components/EntryIndex.vue` 补空态渲染（无组件时显示引导文案与学习入口链接）
- [x] T016 [US1] 在 `scripts/check-content.mjs` 落地 V11 的入口页一致性断言（每个领域两个入口都存在，且入口页列出的条目数等于实际页面数）
- [x] T017 [US1] 在 `scripts/assert-extensibility.mjs` 增加子主题用例：构造 `learn/<NN-kd>/<NN-subtopic>/<NN-page>.md`（目录四层），断言页面进入模型、侧边栏第三层可见、第四层默认折叠
- [x] T018 [US1] 运行 `node scripts/assert-extensibility.mjs`，把输出摘要写入 `specs/001-docs-engine/checklists/local-baseline.md`，并在 spec.md 的 FR-010 处标注验证方式

**Checkpoint**: US1 独立可验（夹具领域出现 + 配置零改动）

---

## Phase 4: User Story 2 - 按学习路径逐步学习一个知识点 (Priority: P1)

**Goal**: 每个知识点页四段式完整、API 手册分档齐全、图解存在，顶部有进度与前置知识、底部有双向链接

**Independent Test**: 打开任一知识点页，核对四段式全部必需小节、进度条与前置知识跳转、底部关联与「被哪些组件复用」，并确认页内代码示例可运行

- [x] T019 [P] [US2] 逐页核对 `docs/backend/learn/01-concurrency/*.md`（4 页）与 `docs/frontend/learn/01-engineering/*.md`（4 页）的四段式必需小节，补齐缺失标题（逐字对齐 `contracts/content-contract.md` §4）
- [x] T020 [P] [US2] 补全各知识点页的 API 手册要素与重要性分档：每页 5–15 个方法，每个方法必须带 `rank`（必会/常用/进阶）、`params`（名称、类型、默认值、含义）、`returns`、`effect`、`scenario`、`example`
- [x] T021 [US2] 校验并补齐图解引用：每个知识点页 `## 原理图解` 至少一个 `<DiagramFrame>`，且 `docs/public/diagrams/<name>.html` 存在（由 T009 的 V10 断言）
- [x] T022 [US2] 浏览器验收进度与链接：对 `http://127.0.0.1:4173/backend/learn/concurrency/queue-pipe` 与 `/backend/components/safe-queue` 截图并断言「关联与复用」区显示反向链接（组件 → 知识点、知识点 → 组件）
- [x] T023 [US2] 在 `scripts/check-content.mjs` 增加 `--fixture` 自测用例：构造缺 `## 关键对比` 的页面，断言 V7 判错并给出行号与修法；恢复后归零

**Checkpoint**: US1 + US2 构成 MVP（可读、可导航、可机械验收）

---

## Phase 5: User Story 3 - 按组件查询可复用方案 (Priority: P2)

**Goal**: 组件页双栏可用、安装命令可复制、含知识点对照表、完整源码与三种引用方式，并带自动化测试

**Independent Test**: 打开组件页，核对双栏、安装命令复制、知识点对照表、核心源码与三种引用方式；运行组件测试全绿

- [x] T024 [US3] 补齐 `docs/backend/components/safe-queue.md`：`## 设计说明`、`## 使用文档`、`## 其他项目如何引用`（三种方式：pip 安装、复制源码、Flask/Celery 场景集成）、`## 与其他组件的关系`
- [x] T025 [US3] 验证双栏自动切分与判错：确认 `docs/.vitepress/plugins/cmp-split.ts` 在「其他项目如何引用」处切分；在 `scripts/check-content.mjs` 确认 V8 对「少于三种引用方式」判错
- [x] T026 [US3] 校验标签索引与入口页：确认 `docs/backend/components/index.md` 的 `<EntryIndex kind="components">` 卡片数与 `docs/.vitepress/data/pages.data.ts` 的 `tags_index` 聚合结果一致
- [x] T027 [P] [US3] 新建 `tests/test_safe_queue.py`：覆盖正常路径结果正确、子进程异常回传（`ok=false` 且带 traceback 文本）、哨兵数量等于 worker 数时全部退出、`workers<1` 抛 `ValueError` 四类用例

**Checkpoint**: 组件可搬运、可测试、可查依赖

---

## Phase 6: User Story 4 - 推送即上线到 docs1.minilab.uzibird.cn (Priority: P2)

**Goal**: 推送主干自动构建镜像并部署，HTTPS 入口与健康检查可用，失败可定位

**Independent Test**: 推送一次内容改动，Run 全绿，线上首页含本次提交内容，`/health` 返回 200

- [x] T028 [P] [US4] 新建 `ci.env`：按 `contracts/deploy-contract.md` §1 填 `PROJECT_NAME=docs-1`、`IMAGE_NAME=dev/docs-1-docs`、`MANIFEST_DIR=deploy`、`K8S_NAMESPACE=docs`、`DEPLOYMENT_NAME=docs-1-docs`、`INGRESS_HOST=docs1.minilab.uzibird.cn`、`CONTAINER_PORT=80`、`ROLLOUT_WAIT=true`、`DB_ENABLED=false`、`CONF_ENABLED=false`，不设 `INSTALL_CMD`/`TEST_CMD`/`IMAGE_TAG`
- [x] T029 [P] [US4] 新建 `Dockerfile`：阶段一 `node:22-alpine` + `apk add --no-cache python3`，依次执行 `npm ci`、`npm run check:content`、`npm run check:zh`、`python3 -m pytest tests/ -q`、`npm run build`；阶段二 `caddy:2-alpine`，只拷 `docs/.vitepress/dist` 与 `Caddyfile`，`EXPOSE 80` 并带 `/health` 健康检查
- [x] T030 [P] [US4] 新建 `Caddyfile`：`try_files {path} {path}.html {path}/index.html /index.html` 与 `respond /health 200`
- [x] T031 [P] [US4] 新建 `deploy/deployment.yaml`、`deploy/service.yaml`、`deploy/ingress.yaml`：按契约 §4 使用 `${DEPLOYMENT_NAME}`/`${K8S_NAMESPACE}`/`${IMAGE_FULL}`/`${CONTAINER_PORT}`/`${INGRESS_HOST}`/`${APP_VERSION}` 占位；资源 20m/32Mi 与 200m/128Mi；探针打 `/health`
- [x] T032 [US4] 新建 `.gitea/workflows/ci.yaml`：薄触发文件，`uses: dev/ci/.gitea/workflows/template.yaml@main`，`project` 取 `github.event.repository.name`，按 dev-roadmap 的口径转发 Secrets
- [x] T033 [US4] 首次部署验收：推送后确认 Run 全绿、`kubectl -n docs get deploy docs-1-docs -o jsonpath='{...image}'` 等于本次短 hash、`curl -H 'Host: docs1.minilab.uzibird.cn' http://192.168.2.203/health` 返回 200、首页 HTML 含内容标记
- [x] T034 [US4] 登记域名前置：在 `minilab/registry/dns.yaml` 与 `registry/services.yaml` 增加 `docs1.minilab.uzibird.cn` 条目，通知用户侧在阿里云与 OpenWrt 添加 A 记录；生效后按 quickstart S9 用真实域名复验

**Checkpoint**: 线上可访问，且域名与证书前置有明确责任与验证方式

---

## Phase 7: User Story 5 - 受控中文写作机械门禁 (Priority: P3)

**Goal**: `docs/**/*.md` 的中文检查可运行、可定位、进 CI，不通过必须红

**Independent Test**: 对一个合规文件与一个违规文件分别执行检查，比较退出码与输出清单

- [x] T035 [P] [US5] 对 `docs/**/*.md` 跑 `python3 scripts/ste-lint-zh.py docs --json`，修复可机械修复项，把剩余硬违规数写入 `scripts/ste-lint-zh.baseline`
- [x] T036 [US5] 负例验证：在 `docs/backend/learn/01-concurrency/01-thread-basics.md` 写一句含分号且超过 40 字的句子，断言检查退出码 1 且报出 `semicolon` 与 `long-sentence` 的文件行号；恢复后归零
- [x] T037 [US5] 一致性回归：核对 `AGENTS.md` 的规则条目、`scripts/ste-lint-zh.py` 实际检查项、CI 中的执行位置三者一一对应，无「文档写了但脚本没查」的条目

**Checkpoint**: 中文门禁可执行、可定位、可红灯

---

## Phase 8: User Story 6 - 按统一规范扩展到上千页面 (Priority: P2)

**Goal**: 规范可执行（schema + 校验 + 脚手架 + 技能），千页规模下导航与构建仍可用

**Independent Test**: 用脚手架生成一个知识域与一个知识点，校验通过、导航自动出现；合成 1000 页夹具测得构建与体积在预算内

- [x] T038 [US6] 新建 `scripts/check-budget.mjs`：在临时目录合成 N 页（默认 1000）夹具，测量解析时长、构建时长、`virtual:doc-tree` 载荷体积与静态资源总量，输出与预算的对比
- [x] T039 [US6] 把 `contracts/engine-contract.md` §9 的预算写成脚本判据（1000 页构建 ≤180s、站点资源 ≤20 MB、单图 ≤1.5 MB），超限时退出码 1 并打印超出指标与数值
- [x] T040 [US6] 脚手架端到端演练：`node scripts/new-content.mjs knowledge-domain …` 与 `… knowledge …` 生成内容，跑 `npm run check:content` 与 `npm run build` 全绿，随后删除夹具并在 `checklists/local-baseline.md` 记录
- [x] T041 [US6] 把创作规范上架 `dev/skill` 仓：技能正文只放「何时加载、目录落位、页面结构、常见错误、自检命令」，取值指向本仓 `contracts/content-contract.md`；断言两处无重复取值
- [x] T042 [US6] 跨领域契约夹具验证：构造临时 `docs/cross-domain/<fixture>.md`（`type: cross-component`，`depends_on` 含 `backend` 与 `frontend`），断言页面进入「跨领域组件」分组、顶部渲染依赖汇聚、双栏切分与组件页一致；验证后删除（示例内容不属本里程碑）

**Checkpoint**: 规范可执行、可扩展、可测量

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 收口、证据与一致性

- [x] T043 本地门禁总入口全绿：在 `package.json` 依次跑 `npm run check:content`、`npm run check:zh`、`npm run test:component`、`npm run build`，四者退出码均为 0
- [x] T044 按 `quickstart.md` 跑完 S1–S10，把每条的实际输出与结论追加到 `specs/001-docs-engine/checklists/local-baseline.md`
- [x] T045 [P] 清理临时夹具、截图与 `docs/.vitepress/dist`，确认 `.gitignore` 覆盖 `dist/`、`.tools/`、`*.delivery*.json`，并确认仓库无凭据（`git grep -nE 'token|password|secret' ci.env deploy/` 无明文）
- [x] T046 [P] 一致性回归：核对 `README.md`、`AGENTS.md`、`contracts/*`、`plan.md` 与实际实现无冲突（重点：门禁命令、目录约定、环境变量名）
- [x] T047 推送并在本仓 Actions 确认首个 Run 全绿；把 `spec.md` 的 `Status` 从 `Draft` 更新为 `Implemented`，并把 CI Run 链接写入 `checklists/local-baseline.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，立即开始
- **Foundational (Phase 2)**: 依赖 Setup，**阻塞全部用户故事**
- **User Stories (Phase 3–8)**: 均依赖 Foundational；彼此独立，可并行
- **Polish (Phase 9)**: 依赖所需用户故事完成

### User Story Dependencies

| 故事 | 依赖 | 说明 |
|---|---|---|
| US1 零配置扩展 | Foundational | 与其它故事无耦合 |
| US2 知识点学习页 | Foundational | 复用 US1 的模型，但不依赖 US1 的任务完成 |
| US3 组件查询 | Foundational | 与 US2 通过反向链接互相体现，但各自可独立验收 |
| US4 推送即部署 | Foundational（门禁脚本必须在镜像里可跑） | 不依赖 US1–US3 的内容完成 |
| US5 中文门禁 | Foundational（T011 基线） | 与 US4 的 CI 阶段接线相关（T032） |
| US6 规模与规范 | Foundational | 与 US1 的扩展断言共用夹具思路 |

### 关键顺序约束

1. T006 必须在 T007–T009 之前（骨架先于规则）。
2. T011 必须在 T035 之前（脚本先于基线）。
3. T029（Dockerfile）依赖 T006–T013（门禁脚本与组件测试必须已存在）。
4. T032 依赖 T028–T031（`ci.env` 与清单先于触发文件）。
5. T033 依赖 T032；T034 与 T033 可并行推进（后者需外部配合）。
6. T043 依赖全部实现类任务；T044 依赖 T043。

### Parallel Opportunities

- Phase 1：T003 与 T001/T002 可并行（不同文件）
- Phase 2：T004、T005、T010、T011、T012、T013 可并行；T007–T009 串行（同文件）
- Phase 6：T028–T031 四个文件互不冲突，可并行；T032 其后
- 跨故事：Phase 3–8 在 Foundational 完成后可按故事并行（不同文件为主）

---

## Parallel Example: 门禁与契约（Phase 2）

```bash
# 可同时开工的四条线：
Task: "落地 schemas/dir-meta.schema.json"
Task: "实现 scripts/new-content.mjs 脚手架"
Task: "vendored scripts/ste-lint-zh.py 与基线文件"
Task: "编写 AGENTS.md 写作规范"
```

## Parallel Example: 交付物（Phase 6）

```bash
# 四个文件互不冲突，可并行产出：
Task: "新建 ci.env"
Task: "新建 Dockerfile"
Task: "新建 Caddyfile"
Task: "新建 deploy/{deployment,service,ingress}.yaml"
```

---

## Implementation Strategy

### MVP First

1. 完成 Phase 1（基线固化）与 Phase 2（门禁与契约）
2. 完成 Phase 3（US1 零配置扩展）+ Phase 4（US2 学习页）
3. **停下来验收**：跑 quickstart 的 S1、S2、S4、S7
4. 此时已可对内演示「加目录即出站点，且结构机械可验」

### Incremental Delivery

1. US1 + US2 → 站点可读可验（MVP）
2. US3 → 组件可复用可测试
3. US4 → 推送到 `docs1.minilab.uzibird.cn`
4. US5 → 中文写作有门禁
5. US6 → 规范可扩展、千页可承受

### 与 plan.md 的差距项对应

| plan.md 待补项 | 本文件任务 |
|---|---|
| T01 schemas | T004、T005 |
| T02 check-content | T006–T009、T016、T023、T025 |
| T03 脚手架 | T010、T040 |
| T04 中文门禁 | T011、T012、T035–T037 |
| T05 组件自测 | T027 |
| T06 扩展断言 | T014、T017、T018 |
| T07 入口页一致性 | T015、T016 |
| T08 千页预算 | T038、T039 |
| T09 CI 接入 | T028–T034 |
| T10 README | T013 |
| T11 跨领域契约样例 | T042 |
| T12 实现入库与基线 | T001、T045、T047 |

---

## Notes

- [P] 任务指不同文件、无未完成依赖，可并行
- 每个任务完成后提交一次，提交信息带任务号（如 `feat(001): T006 check-content 骨架`）
- 每个 Checkpoint 都可停下来独立验收，不必等全部故事完成
- 门禁脚本必须只读；修复只能通过脚手架或人工改内容
- 涉及删除文件的清理任务（T045）必须先确认无被跟踪内容

## 宪法 1.2.0 落地（2026-10-12）

- [x] T048 按原则 IX 落地「官方依据与版本差异」：内容契约新增要素、门禁新增 V19、
  16 个知识点页补齐官方链接与版本差异、技能 v1.1.0 登记该要素、自测套件补 V19 负例。

## 宪法 1.3.0 落地（2026-10-12）

- [x] T049 按原则 X 落地导航层级与接口覆盖：顶栏与侧边栏加深为领域→知识域→讲→子主题（带编号与难度）、
  学习入口呈现层级与「待补」、模块接口清单 `scripts/data/module-api-index.json`、门禁 V20 与 V22、
  构建后导航门禁 `scripts/check-nav.mjs`（N1–N5）并入 CI。
- [x] T050 通信知识域 4 讲：队列与管道、共享状态、信号量与会话信号、套接字与流（task-9 完成，4 路由 200）
- [x] T051 其他领域仅目录结构：后端 03-network/04-database/05-os/06-system-design、前端 02-framework/03-browser、新领域 cloudnative（3 个 outline 域）
- [x] T052 导航层级与接口覆盖落地：顶栏与侧边栏四层、入口层级与「待补」、模块接口清单、V20/V22、check:nav（N1–N5）、技能 1.2.0
## 特性 003 落地（2026-10-12）

- [x] T053 任务服务与前端控制台：`service/`（下发/取消/监控/SSE）、`TaskConsole.vue` 与组件页、
  Caddy `/api` 反代、入口脚本同管两进程；用例 46 passed；经域名实测 `cp` 任务实时输出。
