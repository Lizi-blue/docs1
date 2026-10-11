# Implementation Plan: 技术面试备考文档引擎（docs-1）

**Branch**: `001-docs-engine` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-docs-engine/spec.md`

**Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)（v1.0.0，2026-10-11 批准）

**Note**: 本文件由 `/speckit-plan` 生成。仓库中已存在可运行的引擎骨架（见「当前实现状态」），
本计划以「目标设计 + 现状差异 + 待补任务」三段组织，差异部分直接交给 `/speckit-tasks`。

## Summary

建设一个声明式文档引擎：内容作者按约定在 `docs/` 下放 Markdown 与 `_meta.yml`，解析层在构建期
扫描目录、合并目录元数据与页面 frontmatter，产出页面模型与虚拟模块，驱动三层导航、作用域侧边栏、
领域双入口（渐进式学习 / 组件查询）、学习进度与双向链接。站点由 VitePress + Vue 3 渲染，
图解由 Archify 从 JSON IR 生成自包含交互 HTML，中文质量由 ste-lint-zh 机械判定，
交付走 `ci` 中心仓流水线部署到 `docs1.minilab.uzibird.cn`。

示例内容覆盖两个方向：Python 后端（多线程 → 多进程 → Queue 通信 → 异步 I/O，另有一个组件页）
与前端工程化（单页 index.html 入口 → npm 与模块 → Vite 开发与构建 → 工程化项目结构）。

## Technical Context

**Language/Version**: Node.js 22.23.2（解析层、主题、构建、脚本）；Python 3.13（中文门禁与图解编排）；
浏览器端 Vue 3.5（组件层）；YAML 1.2（元数据）

**Primary Dependencies**: VitePress 1.6.4；Vue 3.5；js-yaml 4.1；gray-matter 4.0；
Archify 3.0.1（离线 CLI，本地检出，仅创作期使用）；ste-lint-zh（Python 标准库，vendored）

**Storage**: 文件系统（Markdown + YAML 是唯一事实源）。无数据库、无后端进程、无持久卷。

**Testing**: `npm run build`（构建门禁）；`scripts/check-content.mjs`（元数据、结构、命名、链接）；
`scripts/ste-lint-zh.py`（中文）；组件自测（pytest，针对组件页源码）；浏览器端验证
（`npm run preview` + 逐页检查 + 截图取证）；扩展性断言（隔离夹具上验证零配置扩展）。

**Target Platform**: 构建在 Linux 容器（ci runner）；运行在 Kubernetes（静态产物 + Caddy）；
读者侧为现代桌面浏览器（内网 HTTPS）。

**Project Type**: 静态站点生成器插件 + 内容引擎（单仓，Node 工具链为主，Python 门禁脚本为辅）。

**Performance Goals**: 构建 ≤30 秒（当前 2 个领域规模）；千页规模下构建 ≤180 秒且告警可比对；
读者首屏 ≤3 秒（内网）；站点静态资源总量 ≤20 MB。

**Constraints**: 构建可离线完成（依赖已锁 `package-lock.json`，registry 走镜像）；
图解不在 CI 联网生成；站点无后端依赖；`docs/**` 的 URL 空间由解析层决定（非 VitePress 默认映射）；
内容规模目标为 10+ 领域、1000+ 页面，所有设计必须在该规模下成立。

**Scale/Scope**: 本里程碑交付 2 个领域、2 个知识域、8 个知识点页、1 个组件页、3 个入口页、7 张图解。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 宪法条款 | 门禁问题 | 结论 | 判据 / 落点 |
|---|---|---|---|
| I 内容即事实源 | 导航、索引、关联链接是否全部派生？是否存在第二份人工清单？ | PASS | 页面模型由 `doc-engine.ts` 扫描产出；侧边栏与入口索引消费同一模型；`contracts/engine-contract.md` |
| II 零配置扩展 | 新增领域是否只建目录与文件？有无自动化证明？ | PASS（证明待补） | 扩展性断言脚本在隔离夹具上断言导航出现且配置改动为 0（差异清单 T-E1） |
| III 内容契约可执行 | schema、校验、脚手架是否同源且进了 CI？ | PASS（待补 T01–T03） | `schemas/` + `scripts/check-content.mjs` + `scripts/new-content.mjs`，CI fail-closed |
| IV 受控中文与机械门禁 | 中文检查是否显式执行且不静默跳过？ | PASS（待补 T04） | vendored `scripts/ste-lint-zh.py`，CI 独立阶段，基线只减不增 |
| V 图解自包含且可重建 | 图解是否离线可交互？源与生成命令是否入库？ | PASS | `diagrams/src/*.json` + `scripts/gen-diagrams.sh` + `docs/public/diagrams/*.html`（7 张，已生成） |
| VI 组件按生产级交付 | 组件是否有源码、文档与自动化测试，且测试进 CI？ | PASS（待补 T05） | `safe-queue` 源码与三层引用方式已就位；自测脚本与 CI 执行待补 |
| VII 规模优先 | 千页时导航是否仍可用？作者新增页面是否 ≤3 步？ | PASS | 三层可见 + 知识域作用域侧边栏 + 搜索 + 面包屑；重写表由页面模型生成 |

**结论**：无违反项，无需 Complexity Tracking 例外；两处**技术取舍**记入下表并按宪法 III 的
「同源」要求补偿。

| 取舍 | 为何需要 | 更简单的替代方案为何不够 |
|---|---|---|
| VitePress 关闭自带断链检查（`ignoreDeadLinks: true`），改由 `check-content.mjs` 判定 | URL 由解析层生成（去掉数字前缀），VitePress 无法把干净 URL 映射回源文件 | 保留 VitePress 检查就必须让文件名等于 URL，直接违反宪法 II 的排序前缀约定 |
| 用 markdown-it 插件自动切分组件页为双栏 | FR-014 要求双栏是页面契约，不是作者手写布局 | 作者手写 `<div>` 分栏会随页面增多而漂移，且无法机械校验 |
| 组件载荷用单引号属性 + HTML 实体转义（`&#39;`）承载结构化数据 | 组件的 props 需要携带含引号的代码示例，而 HTML 属性与 JS 字符串的引号会互相破坏 | 外置 JSON 文件会增加作者负担（每个组件多一个文件），且不利于页面自包含阅读 |

## Project Structure

### Documentation (this feature)

```text
specs/001-docs-engine/
├── plan.md              # 本文件
├── research.md          # Phase 0：选型与取舍（含备选方案）
├── data-model.md        # Phase 1：实体、字段、校验规则、关系
├── quickstart.md        # Phase 1：端到端验证剧本
├── contracts/           # Phase 1：内容契约、引擎契约、工具契约、交付契约
│   ├── content-contract.md
│   ├── engine-contract.md
│   ├── tooling-contract.md
│   ├── deploy-contract.md
│   └── schemas/
│       ├── dir-meta.schema.json
│       └── page-frontmatter.schema.json
├── checklists/
│   └── requirements.md  # /speckit-specify 产出
└── tasks.md             # /speckit-tasks 产出（本命令不创建）
```

### Source Code (repository root)

```text
docs/                                   # 内容源 + 站点根（VitePress 的 srcDir）
├── .vitepress/
│   ├── config.mts                      # 站点配置：导航/侧边栏/重写表由页面模型生成
│   ├── plugins/
│   │   ├── doc-engine.ts               # 解析层：扫描、建模、虚拟模块、HMR
│   │   └── cmp-split.ts                # 组件页双栏切分（markdown-it 插件）
│   ├── shared/links.ts                 # 命名与链接规则（Node 与浏览器唯一实现）
│   ├── data/pages.data.ts              # createContentLoader：扁平页面索引
│   └── theme/
│       ├── index.ts                    # 主题入口与全局组件注册
│       ├── Layout.vue                  # 按 frontmatter.type / entry 切换布局
│       ├── lib/tree.ts                 # 主题侧取数（虚拟模块封装）
│       ├── components/                 # ProgressBar / Prerequisite / ApiTable / InstallBox /
│       │                               # CodeTabs / DiagramFrame / EntryIndex / TagIndex / RelatedLinks
│       └── styles/custom.css           # 卡片、徽标、API 表、双栏、入口索引样式
├── public/diagrams/*.html              # Archify 产物（自包含交互 HTML，入库）
├── _meta.yml  index.md                 # 站点根
├── backend/                            # 领域示例一
│   ├── _meta.yml  index.md             # 领域首页（双入口）
│   ├── learn/{_meta.yml,index.md}      # 渐进式学习入口
│   ├── learn/01-concurrency/           # 知识域：并发编程
│   │   ├── _meta.yml
│   │   └── 01-thread-basics.md 02-process-basics.md 03-queue-pipe.md 04-async-io.md
│   └── components/{_meta.yml,index.md,safe-queue.md}
└── frontend/                           # 领域示例二
    ├── _meta.yml  index.md
    ├── learn/{_meta.yml,index.md}
    ├── learn/01-engineering/           # 知识域：工程化基础
    │   ├── _meta.yml
    │   └── 01-single-html-entry.md 02-npm-and-modules.md 03-vite-dev-and-build.md 04-project-structure.md
    └── components/{_meta.yml,index.md}

diagrams/src/*.json                     # 图解可编辑源（Archify JSON IR）
docs/public/diagrams/*.html             # 图解产物（生成物，入库）

schemas/                                # 内容契约（机器可读）
├── dir-meta.schema.json
└── page-frontmatter.schema.json

scripts/
├── check-content.mjs                   # 机械校验：元数据、结构、命名、链接、图解存在性
├── new-content.mjs                     # 脚手架：新增领域/知识域/知识点/组件
├── gen-diagrams.sh                     # 图解生成（ARCHIFY_DIR 指向本地检出）
└── ste-lint-zh.py                      # 受控中文门禁（vendored）

deploy/                                 # 业务自带 K8s 清单（由 ci 渲染后 apply）
├── deployment.yaml  service.yaml  ingress.yaml
.gitea/workflows/ci.yaml                # 薄触发（一行 uses: dev/ci 模板）
ci.env                                  # 仓内能力开关（无 DB/conf/IAM）
Dockerfile  Caddyfile                   # 多阶段：Node 构建 → Caddy 托管
package.json  package-lock.json  .npmrc
AGENTS.md                               # 写作规范与门禁命令
README.md                               # 如何新增领域/知识域/知识点/组件
```

**Structure Decision**: 单仓单项目。`docs/` 既是内容源又是 VitePress 的 `srcDir`，
解析层与主题全部收在 `docs/.vitepress/` 下，随站点一起构建；`diagrams/src` 与 `schemas/`、
`scripts/` 在仓根，属于创作期与门禁期工具，不进镜像。选择该结构的理由：
内容与引擎同仓便于「零配置扩展」的断言；工具与内容分离便于 CI 只装构建所需依赖。

## 当前实现状态（截至 2026-10-11，未提交）

已实现并通过本地构建（`npx vitepress build docs` 成功，产物 24 个页面/资源）：

- 解析层：`doc-engine.ts`（目录扫描、`_meta.yml` 合并、页面建模、`virtual:doc-tree`、HMR）
- 路由重写：由页面模型生成 `rewrites`，源文件保留 `NN-` 前缀，URL 去前缀
- 主题：`Layout.vue` 按 `type`/`entry` 切换；9 个渲染组件；组件页双栏由 markdown-it 插件自动切分
- 数据加载器：`pages.data.ts`（`createContentLoader`）供标签索引用
- 图解：7 张 Archify 产物（Python 4 张 + 前端 2 张 + 跨页复用 1 张），源 JSON 与生成脚本齐备
- 内容骨架：2 个领域、2 个知识域、8 个知识点页、1 个组件页、3 个入口页
- 预览：`vitepress preview` 可跑，关键路由全部 200

待补（将进入 `tasks.md`）：

| 编号 | 待补项 | 对应需求 |
|---|---|---|
| T01 | `schemas/*.json` 落库并与校验脚本同源 | FR-032 / III |
| T02 | `scripts/check-content.mjs`：元数据、四段式小节、命名、链接、图解存在性 | FR-034 / FR-017 |
| T03 | `scripts/new-content.mjs` 脚手架（领域/知识域/知识点/组件） | FR-035 |
| T04 | vendored `ste-lint-zh.py` + 基线文件 + `AGENTS.md` 写作规范 | FR-022 / FR-023 / FR-024 |
| T05 | `safe-queue` 组件自测脚本与 CI 执行 | FR-041 / VI |
| T06 | 零配置扩展断言（隔离夹具上验证） | FR-010 / II |
| T07 | 入口页一致性校验（条目数 = 实际页面数） | FR-037 / SC-012 |
| T08 | 千页构建预算检查（生成器 + 体积/时长断言） | FR-040 / SC-009 / VII |
| T09 | CI 接入：`ci.env`、`Dockerfile`、`Caddyfile`、`deploy/`、`.gitea/workflows/ci.yaml` | FR-026…FR-031 |
| T10 | `README.md`（新增领域/知识点/组件的最少步骤） | FR-025 |
| T11 | 跨领域组件类型的契约样例（引擎已支持，示例内容延后） | FR-015（契约） |
| T12 | 把现有实现与产物提交入库，并补 `docs/**` 的中文基线 | II / IV |

## Complexity Tracking

无宪法违反项。上表「技术取舍」三行已按宪法 III 的同源要求给出补偿措施（校验落在
`check-content.mjs`；双栏由插件统一实现；结构化载荷统一转义由脚手架与校验共同保证）。
