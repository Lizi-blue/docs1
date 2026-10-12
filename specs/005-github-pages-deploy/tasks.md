---
description: "Task list for GitHub Actions 双远端发布与 GitHub Pages 站点"
---

# Tasks: GitHub Actions 双远端发布与 GitHub Pages 站点（github-pages-deploy）

**Input**: Design documents from `/specs/005-github-pages-deploy/`

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/](./contracts/)、[quickstart.md](./quickstart.md)、`.specify/memory/constitution.md`（1.5.0）

**Tests**: 本特性**包含验证类任务**（数据模型与契约要求机械校验：产物断言、深链兜底、双链路一致、门禁同源）。
测试形态为「产物门禁脚本 + 本地可复现剧本 + 线上抽查」，不新增单元测试框架。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、不依赖未完成任务）
- **[Story]**: 仅用户故事阶段使用（`[US1]`…`[US5]`）
- 每个任务给出确切文件路径，并在末尾标注覆盖的需求（`（覆盖 FR-0xx、SC-00y）`）

## Path Conventions

- 平台流水线：`.github/workflows/pages.yml`（新增）；`.gitea/workflows/ci.yaml`（**不改**）
- 站点配置与主题：`docs/.vitepress/`（`config.mts`、`theme/components/`）
- 新增脚本：`scripts/check-pages-artifact.mjs`、`scripts/pages-extra.mjs`
- 规格与证据：`specs/005-github-pages-deploy/`

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 建立 `.github/workflows/` 目录并在 `package.json` 增脚本别名 `check:pages`（`node scripts/check-pages-artifact.mjs`）（覆盖 FR-006）
- [x] T002 [P] 新建 `scripts/pages-extra.mjs` 骨架：向产物写入 `.nojekyll` 与深链兜底页 `404.html`（自包含，不引用外部资源）（覆盖 FR-002、FR-012）
- [x] T003 [P] 新建 `scripts/check-pages-artifact.mjs` 骨架：输出格式与退出码对齐既有门禁（`❌ [P<n>] 路径 问题 → 修法`，退出码 0/1/2，支持 `--json`）（覆盖 FR-006）
- [x] T004 [P] 在 `ledger/orchestration-decisions.tsv` 追加本轮迭代行（scope=`005-github-pages-deploy`）（覆盖 Governance）

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T005 在 `docs/.vitepress/config.mts` 让基础路径读环境变量 `DOCS1_BASE`（默认 `/`），并校验取值必须 `/` 开头且 `/` 结尾（`base-path-contract.md` §1）（覆盖 FR-002、FR-010）
- [x] T006 把主题 7 个组件的 **15 处动态链接**统一改为带基础路径前缀：`docs/.vitepress/theme/components/{EntryIndex,KnowledgeIndex,RelatedLinks,TagIndex,Prerequisite,PageHeader,DiagramFrame}.vue`（`base-path-contract.md` §2）（覆盖 FR-003）
- [x] T007 实现 `scripts/check-pages-artifact.mjs` 的五条断言：站内链接均带前缀、`internalAddressHits=0`、`externalResourceHits=0`、`hasNoJekyll=true`、`has404Fallback=true`（`data-model.md` E6）（覆盖 FR-002、FR-012）
- [x] T008 在 `scripts/pages-extra.mjs` 实现兜底页算法：先试 `<path>.html`，再试 `<path>/index.html`，都不存在回首页（带前缀），保留查询串与锚点（`base-path-contract.md` §4）（覆盖 FR-003）
- [x] T009 内网产物回归守卫：`npm run build`（默认 base）后确认产物形态、十一条门禁与产物链接前缀与改动前一致（`dual-deploy-contract.md` §5）（覆盖 FR-011）

## Phase 3: User Story 1 - 在 GitHub Pages 直接访问站点（Priority: P1）🎯 MVP

**Goal**: 推送到主分支后 GitHub 侧自动构建、跑门禁、发布 Pages；子路径下页面、资源、导航、搜索与深链全部可用。

**Independent Test**: 打开 Pages 地址抽查 10 项（首页、两个领域入口、知识点页、两个组件页、两张图解、搜索、任一深链），全部成功且无资源加载失败。

- [x] T010 [US1] 新建 `.github/workflows/pages.yml`：触发（推送主分支 + 手动）、权限（`contents: read`、`pages: write`、`id-token: write`）、环境 `github-pages`、并发（按分支分组并取消进行中的旧运行）、超时上限（`pages-workflow-contract.md` §1/§2）（覆盖 FR-001、FR-005、FR-013）
- [x] T011 [US1] 在 `pages.yml` 实现步骤 1–5：检出 → 安装站点依赖（锁定文件 + 缓存）→ 安装 Python 与测试框架 → 执行**与内网同一套十一条门禁**（`pages-workflow-contract.md` §3）（覆盖 FR-006、FR-010）
- [x] T012 [US1] 在 `pages.yml` 实现步骤 6–8：以 `DOCS1_BASE=/docs1/` 构建 → 运行 `scripts/pages-extra.mjs` → 运行产物门禁 → 配置 Pages、上传产物、部署（`pages-workflow-contract.md` §3）（覆盖 FR-001、FR-002）
- [x] T013 [US1] 本地子路径构建与产物门禁实测并记录：`DOCS1_BASE=/docs1/ npm run build && npm run check:pages`（quickstart S0/S1）（覆盖 FR-002、SC-002）
- [x] T014 [P] [US1] 本地深链与兜底页实测：用 `scripts/pages-extra.mjs` 产出兜底页后，在静态服务下请求无扩展名深链（quickstart S3），结论写入 `specs/005-github-pages-deploy/checklists/local-baseline.md`（覆盖 FR-003、SC-002）
- [ ] T015 [US1] 手动触发一次发布，按 quickstart S5 抽查 10 项，页面地址与状态码写入 `specs/005-github-pages-deploy/checklists/local-baseline.md`（覆盖 FR-001、FR-004、SC-001、SC-002、SC-003）

## Phase 4: User Story 2 - 一次推送，两条部署链路各自独立（Priority: P1）

**Goal**: 同一次推送驱动内网 k3s 与公网 Pages，两条链路互不阻塞，产物对应同一提交。

**Independent Test**: 同一次推送产生两条成功运行且提交短哈希一致；人为让公网失败，内网仍成功且域名内容不变。

- [ ] T016 [US2] 出具内网链路零改动证据：`git diff --stat` 显示 `.gitea/workflows/ci.yaml`、`Caddyfile`、`deploy/`、`Dockerfile` 未被本特性修改（`dual-deploy-contract.md` §1）（覆盖 FR-011）
- [ ] T017 [US2] 比对两条运行记录的提交短哈希一致，内网镜像标签与 Pages 运行记录写入 `specs/005-github-pages-deploy/checklists/local-baseline.md`（覆盖 FR-005、SC-004）
- [ ] T018 [P] [US2] 失败隔离演练：在 `.github/workflows/pages.yml` 内人为让门禁失败一次，确认内网侧不受影响（quickstart S7-1），记录写入 `specs/005-github-pages-deploy/checklists/local-baseline.md`（覆盖 FR-005、SC-005）
- [ ] T019 [US2] 并发规则实测：连续两次推送 `.github/workflows/pages.yml`，确认旧运行被取消、最终发布对应最新提交，记录写入 `specs/005-github-pages-deploy/checklists/local-baseline.md`（覆盖 FR-013）

## Phase 5: User Story 3 - 静态托管下的能力降级（Priority: P1）

**Goal**: 公网没有后端服务时，受影响的组件显示明确降级提示，文档正文完整可读，产物不泄漏内网信息。

**Independent Test**: Pages 上打开任务控制台组件页，断言出现降级提示、正文与知识索引完整、控制台无未捕获错误；产物中无内网地址。

- [x] T020 [US3] 核对 `docs/.vitepress/theme/components/TaskConsole.vue` 的降级路径在子路径与跨源下仍生效（`api-base` 属性、离线态判定），必要时补「公网静态托管无后端」文案（`degrade-contract.md` §2/§3）（覆盖 FR-007）
- [x] T021 [P] [US3] 在 `docs/frontend/components/01-task-console.md` 的「使用文档」补公网降级说明（MUST NOT 破坏 16 节契约顺序）（覆盖 FR-007、FR-014）
- [ ] T022 [US3] Pages 上执行降级验证（quickstart S6）：降级提示、正文完整、无未捕获错误，证据写入 `specs/005-github-pages-deploy/checklists/local-baseline.md`（覆盖 FR-007、SC-006）
- [x] T023 [P] [US3] 在 `scripts/check-pages-artifact.mjs` 增断言：产物中不得出现指向内网服务的绝对接口地址组合（内网域名 + `/api`）（覆盖 FR-007、FR-012）

## Phase 6: User Story 4 - 发布前门禁与现有部署保持不变（Priority: P2）

**Goal**: 发布以门禁通过为前提；门禁失败不发布；内网域名、健康检查与镜像规则不变。

**Independent Test**: 破坏必需小节后运行，断言 Pages 不发布且上一版本可用；内网域名与 `/health` 与改动前一致。

- [x] T024 [US4] 核对 `pages.yml` 的门禁步骤与 `AGENTS.md` §2 的命令清单逐条一致（十一条 + `check:pages`）（覆盖 FR-006）
- [ ] T025 [US4] 失败演练：临时删除一个必需小节后运行 `.github/workflows/pages.yml`，断言门禁步骤失败、**未上传部署**、Pages 保持上一版本，日志片段写入 `specs/005-github-pages-deploy/checklists/local-baseline.md`（覆盖 FR-006、SC-005）
- [ ] T026 [P] [US4] 内网回归验收（quickstart S8）：内网首页、`/health` 与抽查页状态码记录（覆盖 FR-011、SC-008）
- [x] T027 [US4] 确认内网产物不受公网附加件影响：`Dockerfile` 打包的产物不含 `.nojekyll`/`404.html` 副作用，且内网路由与 cleanUrls 行为不变（`dual-deploy-contract.md` §5）（覆盖 FR-011）

## Phase 7: User Story 5 - 发布可追溯、失败可定位（Priority: P2）

**Goal**: 每次发布对应提交并可定位失败步骤；平台配置未就绪时给出可操作提示。

**Independent Test**: 查看运行记录能看到提交与产物地址；制造平台配置未就绪，断言失败信息指出需要开启的配置项。

- [x] T028 [US5] 在 `pages.yml` 输出可读的步骤名与运行摘要（提交短哈希 + 页面地址），失败时明确到具体步骤（`pages-workflow-contract.md` §5）（覆盖 FR-009）
- [x] T029 [US5] 在 `pages.yml` 启用 Pages 自动开启能力并对未就绪场景给出可操作失败提示（`pages-workflow-contract.md` §4）（覆盖 FR-008、SC-007）
- [ ] T030 [P] [US5] 三类失败定位演练（门禁失败、产物门禁失败、平台配置未就绪）的日志定位点写入 `specs/005-github-pages-deploy/checklists/local-baseline.md`（覆盖 FR-009、SC-007）

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T031 在 `AGENTS.md` §2 与 `README.md` 补 `check:pages` 命令、两端访问地址、发布触发条件与 Pages 降级边界（覆盖 FR-014、SC-008）
- [ ] T032 [P] 新建 `specs/005-github-pages-deploy/checklists/local-baseline.md` 并记录 S0–S8 全量证据（命令与真实输出）（覆盖 SC-001…SC-008）
- [x] T033 跑 `package.json` 中全量十二条门禁（十一条 + `check:pages`）并修复残留，结论写入 `specs/005-github-pages-deploy/checklists/local-baseline.md`（覆盖 FR-006、SC-008）
- [ ] T034 部署验收：确认两条链路运行成功、Pages 页面可访问、内网页面与健康检查正常，URL 与状态码写入 `specs/005-github-pages-deploy/checklists/local-baseline.md`（覆盖 SC-001、SC-004、SC-008）
- [ ] T035 [P] 一致性回归：核对 `specs/005-github-pages-deploy/contracts/`、`.github/workflows/pages.yml`、`scripts/*.mjs`、`README.md`/`AGENTS.md` 四处口径一致（命令清单、基础路径取值、产物断言项、降级范围）（覆盖 FR-014、SC-008）

---

## Dependencies

```text
Phase 1 (T001–T004)
      ↓
Phase 2 (T005–T009)   ← 阻塞全部故事：基础路径注入、组件链接适配、两条脚本、内网回归守卫
      ↓
US1 (T010–T015)  ← MVP：Pages 自动发布与线上可访问
      ↓
US2 (T016–T019)  ← 双链路独立与提交一致（依赖 T010/T012 的工作流存在）
      ↓
US3 (T020–T023)  ← 降级与内网信息零泄漏（T023 依赖 T007 的脚本骨架）
      ↓
US4 (T024–T027)  ← 门禁前置与内网不变（T025 依赖 T011）
      ↓
US5 (T028–T030)  ← 可追溯与失败提示（依赖 T010 的权限与环境配置）
      ↓
Phase 8 (T031–T035)
```

**故事间依赖说明**

- US2/US4/US5 都在验证或补强 US1 建立的流水线，故排在 US1 之后。
- US3 与 US4/US5 无文件冲突：US3 只动主题组件与前端组件页；US4 只做核对与演练记录；US5 只动工作流。

## Parallel Execution Examples

**Phase 2**（不同文件，可同时开工）：

```text
T005 docs/.vitepress/config.mts
T006 docs/.vitepress/theme/components/*.vue（7 个文件，同一适配模式）
T007 scripts/check-pages-artifact.mjs
T008 scripts/pages-extra.mjs
```

**US1**：

```text
T010 .github/workflows/pages.yml（骨架与权限）
T013 本地构建与产物门禁证据
T014 scripts/pages-extra.mjs 兜底页实测
```

**US3 + US5**（写域不重叠）：

```text
T020 docs/.vitepress/theme/components/TaskConsole.vue
T021 docs/frontend/components/01-task-console.md
T023 scripts/check-pages-artifact.mjs
T028 .github/workflows/pages.yml
```

## Implementation Strategy

**MVP 优先**：先交付 Phase 1 + Phase 2 + US1（T001–T015）。此增量完成后，
推送即可在 Pages 上访问站点，且产物门禁与深链兜底已生效。

**增量交付顺序**

1. Phase 1 + Phase 2 → 本地可用 `DOCS1_BASE=/docs1/ npm run build && npm run check:pages` 自检。
2. US1 → 公网可访问；SC-001/SC-002/SC-003 可测。
3. US2 → 双链路一致与隔离；SC-004 可测。
4. US3 → 降级与零泄漏；SC-006 可测。
5. US4 → 门禁前置与内网回归；SC-005/SC-008 可测。
6. US5 → 可追溯与失败提示；SC-007 可测。
7. Phase 8 → 文档、证据归档与部署验收。

**风险与缓解**

- 子路径链接（T006）：改动面覆盖 7 个组件，先做 T005（base 注入）再逐个替换，每步跑 `npm run build` 与 `check:pages`。
- 平台深链行为（T008/T014/T015）：用兜底页把不确定性收敛到「本地可复现」；线上首次发布按 T015 抽查确认。
- 首次发布污染（T015/T019）：先用手动触发验证，再用连续推送验证并发规则。
- 内网回归（T009/T016/T026/T027）：每个阶段结束都跑一次内网构建与域名抽查，避免公网改动影响内网。
