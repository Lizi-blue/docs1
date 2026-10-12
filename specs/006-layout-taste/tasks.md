---
description: "Task list for 布局/目录/内容布局优化（layout-taste）"
---

# Tasks: 参照 taste-skill 优化布局、目录与内容布局（layout-taste）

**Input**: Design documents from `/specs/006-layout-taste/`

**Prerequisites**: [spec.md](./spec.md)、[plan.md](./plan.md)、[reference/taste-skill-digest.md](./reference/taste-skill-digest.md)、[contracts/layout-switch-contract.md](./contracts/layout-switch-contract.md)、`.specify/memory/constitution.md`（1.5.0）

**Tests**: 本特性包含验证类任务（机械断言 + 双档构建 + 线上抽查）。测试形态为「新增门禁脚本 + 本地可复现剧本」，不引入浏览器测试框架。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、不依赖未完成任务）
- **[Story]**: 仅用户故事阶段使用（`[US1]`…`[US5]`）
- 每个任务给出确切文件路径，并在末尾标注覆盖的需求

## Path Conventions

- 样式：`docs/.vitepress/theme/styles/`（`classic.css` 冻结、`taste.css` 优化层、`custom.css` 入口）
- 组件与布局：`docs/.vitepress/theme/components/`、`docs/.vitepress/theme/Layout.vue`
- 站点配置：`docs/.vitepress/config.mts`
- 门禁：`scripts/check-layout.mjs`；规格与证据：`specs/006-layout-taste/`

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 在 `package.json` 增脚本别名 `check:layout`（`node scripts/check-layout.mjs`）（覆盖 FR-024）
- [x] T002 [P] 新建 `specs/006-layout-taste/checklists/local-baseline.md` 证据文件骨架（覆盖 SC-001…SC-009）

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T003 把当前 `docs/.vitepress/theme/styles/custom.css` **逐字**搬到 `docs/.vitepress/theme/styles/classic.css`（冻结）；`custom.css` 改为入口（引入 classic + 档位基础规则）（覆盖 FR-005）
- [x] T004 在 `docs/.vitepress/config.mts` 读 `DOCS1_LAYOUT`（默认 `taste`，非法值报错终止）并注入首屏根类名脚本（含 localStorage 回退）（覆盖 FR-003、FR-004）
- [x] T005 新建 `docs/.vitepress/theme/components/LayoutSwitch.vue`（键盘可达、令牌取色、`scoped`）并在 `docs/.vitepress/theme/Layout.vue` 挂载（覆盖 FR-004、FR-012）
- [x] T006 实现 `scripts/check-layout.mjs` 的 L1–L6 断言（经典冻结逐字一致、断点标准、顶栏高度上限与无 `100vh`、优化层作用域、切换机制齐备、无 flex 百分比栅格）（覆盖 FR-024）

## Phase 3: User Story 1 - 改造随时可回滚（Priority: P1）

**Goal**: 双档并存，构建期与运行期都能回到经典布局；经典样式逐字冻结。

**Independent Test**: `DOCS1_LAYOUT=classic npm run build` 与默认构建都成功；产物分别带 `layout-classic` / `layout-taste`；`check:layout` 断言经典样式与基线标签逐字一致。

- [x] T007 [US1] 校验回滚链路仍在位：基线标签存在、`scripts/restore-layout.mjs --dry-run` 可运行且不改工作区（覆盖 FR-001、FR-002）
- [x] T008 [US1] 双档构建实测并记录：默认（taste）与 `DOCS1_LAYOUT=classic` 两次构建成功，产物根类名正确（覆盖 FR-003、SC-002）
- [x] T009 [US1] 运行时切换实测并记录：产物含切换控件与 localStorage 逻辑；首屏脚本先于样式设置类名（覆盖 FR-004、SC-002）

## Phase 4: User Story 2 - 布局更专业（Priority: P1）

**Goal**: 断点标准化、容器限宽居中、顶栏单行且不侵占阅读区、首屏能看到主要入口、折叠逐段声明。

**Independent Test**: 量取产物 CSS 中的断点与顶栏高度；三档宽度无横向溢出（`check:responsive` + 本地静态服务抽查）。

- [x] T010 [P] [US2] 在 `docs/.vitepress/theme/styles/taste.css` 标准化断点为 640 / 768 / 1024 / 1280 / 1536（覆盖 FR-006、L2）
- [x] T011 [US2] 在 `taste.css` 实现顶栏：单行不换行、高度 ≤64px、细描边与背景层（覆盖 FR-008、L3）
- [x] T012 [US2] 在 `taste.css` 实现整页容器限宽居中与栅格骨架（覆盖 FR-007）
- [x] T013 [US2] 在 `taste.css` 收紧入口页与领域首页的首屏留白，使标题与主要入口首屏可见（覆盖 FR-009）
- [x] T014 [US2] 在 `taste.css` 为每个多列区块声明 640 / 768 折叠形态（覆盖 FR-010、L2）

## Phase 5: User Story 3 - 目录更好用（Priority: P1）

**Goal**: 三级层级靠缩进与密度表达，当前项有明确选中态与可见焦点，窄桌面压缩标签不换行。

**Independent Test**: 产物 CSS 含侧栏层级与选中态规则；顶栏在 1024 宽度声明收纳规则；键盘焦点规则存在。

- [x] T015 [US3] 在 `taste.css` 实现侧栏三级层级的缩进与密度（去掉多余分隔线）（覆盖 FR-011）
- [x] T016 [US3] 在 `taste.css` 实现侧栏与页内目录的选中态、悬停态与 `:focus-visible`（覆盖 FR-012、FR-021）
- [x] T017 [US3] 在 `taste.css` 实现窄桌面的标签压缩与次级项收纳（不换行）（覆盖 FR-013）

## Phase 6: User Story 4 - 内容布局更好读（Priority: P1）

**Goal**: 正文行宽落在可读区间，标题阶梯走令牌，卡片/图框/代码/表格统一语言，密度分级，动效克制。

**Independent Test**: 产物 CSS 含正文最大宽度与标题阶梯规则；卡片列表使用网格；`prefers-reduced-motion` 规则存在。

- [x] T018 [P] [US4] 在 `taste.css` 设定正文列宽（约 65–75 字符）与标题阶梯（令牌取值）（覆盖 FR-017）
- [x] T019 [US4] 在 `taste.css` 统一卡片、图框、代码块与表格的圆角、描边与阴影，并把卡片列表改为网格（覆盖 FR-018、L6）
- [x] T020 [US4] 在 `taste.css` 做密度分级：长文留白、API 手册与表格加密并吸顶表头（覆盖 FR-019）
- [x] T021 [US4] 在 `taste.css` 让动效只走 `transform` 与 `opacity`，并尊重 `prefers-reduced-motion`（覆盖 FR-022）

## Phase 7: User Story 5 - 门禁与既有约定不退化（Priority: P2）

**Goal**: 新规则可机械判定并进 CI；破坏经典冻结会被判红。

**Independent Test**: `npm run check:layout` 通过；人为改动 `classic.css` 后判红并给出位置。

- [x] T022 [US5] 在 `.github/workflows/pages.yml` 增 `npm run check:layout` 步骤（覆盖 FR-023、FR-024）
- [x] T023 [US5] 在 `AGENTS.md` §2/§5 与 `README.md` 增档位说明与 `check:layout` 命令（覆盖 FR-014、FR-024）
- [x] T024 [P] [US5] 在 `scripts/selftest-gates.mjs` 增负例：破坏经典冻结或作用域时 `check:layout` 判红（覆盖 FR-024、SC-008）

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T025 跑全量十三条门禁（十二条 + `check:layout`）并修复残留（覆盖 FR-023、SC-008）
- [x] T026 把双档构建、切换实测、门禁结果写入 `specs/006-layout-taste/checklists/local-baseline.md`（覆盖 SC-001…SC-009）
- [x] T027 部署验收：内网与公网两条链路成功，线上抽查首页/知识点/组件页与切换控件（覆盖 SC-003、SC-004、SC-009）

---

## Dependencies

```text
Phase 1 (T001–T002)
      ↓
Phase 2 (T003–T006)   ← 阻塞全部故事：样式分档、构建期开关、切换控件、布局门禁
      ↓
US1 (T007–T009)  ← 双档与回滚（T008/T009 依赖 T003/T004/T005）
      ↓
US2 (T010–T014)  → US3 (T015–T017)  → US4 (T018–T021)   ← 均只写 taste.css，共享文件需顺序写
      ↓
US5 (T022–T024)  ← 门禁进 CI 与文档
      ↓
Phase 8 (T025–T027)
```

**说明**：US2/US3/US4 的落点集中在 `taste.css` 同一文件，标 [P] 的仅是可在不同时间片写入的独立分段；同一时间只允许一个写者。

## Implementation Strategy

**MVP**：Phase 1 + Phase 2 + US1（T001–T009）——此时双档与切换已可用，且回滚随时可做。
随后按 US2（骨架）→ US3（目录）→ US4（内容）→ US5（门禁与文档）顺序推进，最后 Polish 与部署验收。
