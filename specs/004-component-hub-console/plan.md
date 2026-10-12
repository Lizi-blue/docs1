# Implementation Plan: 组件首发仓与前后端双端任务控制台（component-hub-console）

**Branch**: `004-component-hub-console` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-component-hub-console/spec.md`

## Summary

把本仓从「学习站」升级为「学习站 + 组件首发仓」：组件先在本仓成型（复用四件套 + 依赖知识索引 + 可复现验收），
再复制到生产项目。为此做四件事：

1. **方向归属**：组件页新增 `direction` 元数据；后端组件页只讲后端实现（Python 任务服务），
   前端组件页只讲前端实现（Vue 控制台组件）；两端互相链接。
2. **依赖知识索引**：组件页声明结构化知识依赖（页面 + 在本组件中的作用），由组件渲染成表，
   门禁校验链接有效、role 非空、待补知识域标「待补」而非死链。
3. **复用四件套**：新增 `reuse/<component>/manifest.json` 作为单一事实源（文件清单、外部依赖、
   适配点、验收命令），页面渲染它，门禁校验 manifest 与实际文件一致。
4. **专业前端体验**：新增设计令牌层（`tokens.css`）与体验门禁（`check:experience`），
   把令牌、状态矩阵、焦点可见、对比度、响应式与横向溢出做成机械断言；不可机械化的部分进人工清单。

## Technical Context

**Language/Version**: Python 3.13（标准库，后端组件）；Node 22 + Vue 3.5 + VitePress 1.6（前端组件与站点）
**Primary Dependencies**: 运行时零第三方依赖（不引入 UI 组件库）；构建期仅有 VitePress 与其既有依赖
**Storage**: 无数据库；任务状态在内存（既有 003 约束），组件复用资产以文件形式入库
**Testing**: `pytest`（服务端组件）+ 内容/导航/体验门禁（Node 脚本）+ 人工键盘与视口清单
**Target Platform**: k3s 单容器（Caddy 静态站 + Python 服务）；组件被复制到任意内网项目
**Project Type**: web（静态站点 + 同源服务 + 可复用前端组件库）
**Performance Goals**: 组件页首屏可见 < 1s（静态站既有水平）；控制台交互反馈 ≤ 100ms；
  实时日志端到端延迟 ≤ 1s（沿用 003 实测口径）
**Constraints**: 离线可构建（私有索引）、无浏览器沙箱（体验验证靠静态断言 + 人工清单）、
  单容器单 Ingress、不新增端口与数据库
**Scale/Scope**: 组件先覆盖「任务控制台」两端；模板与门禁一次成型，后续组件按同一模板增长

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 本计划的落实 | 结论 |
|---|---|---|
| I 内容即事实源，导航是派生视图 | 组件页正文写职责与用法，文件清单与依赖由 `reuse/manifest.json` 与 frontmatter 渲染；作者不手写清单 | PASS |
| II 零配置扩展 | 新增组件只需落目录 + 元数据 + manifest；配置层不改（方向与筛选由元数据驱动） | PASS |
| III 内容契约可执行 | 组件页契约扩展为「必需章节 + direction + 知识索引 + 复用四件套」，由门禁判错 | PASS |
| IV 受控中文与机械门禁 | 新增 `check:experience` 与组件契约门禁，进 CI；中文门禁基线不放开 | PASS |
| V 图解自包含且可重建 | 组件页沿用既有图解与 Archify 流程，不新增外部资源 | PASS |
| VI 组件按生产级交付 | 组件具备源码、设计说明、使用文档、接口契约与测试；服务端组件已有 pytest，前端组件补静态检查与人工清单 | PASS |
| VII 规模优先 | 门禁为 Node 脚本 + 静态断言，不引入浏览器运行时；组件资产按目录增长 | PASS |
| VIII 教学编排持续改进 | 组件页登记依赖知识域与知识点，回写技能（组件骨架与复用判据）；台账记录本次迭代 | PASS |
| IX 内容深度与广度基线 | 组件页给官方依据与版本差异；接口按方法组分层 | PASS |
| X 导航层级与接口覆盖 | 组件区进入导航；组件索引支持方向与知识域筛选；组件页内方法组继续分层 | PASS |
| **XI 组件首发仓与按方向归属** | 本计划核心：`direction` 元数据 + 两端互链 + 复用四件套 + 依赖索引 + 独立可运行 + 迁移步骤 + 样式作用域 | PASS |

**Phase 0 无 NEEDS CLARIFICATION**：规格 18 条 FR 均可落地方案，未知项在 `research.md` 逐条给出决策与理由。

## Project Structure

### Documentation (this feature)

```text
specs/004-component-hub-console/
├── spec.md              # 需求（已完成）
├── plan.md              # 本文件
├── research.md          # Phase 0：七个设计决策与取舍
├── data-model.md        # Phase 1：组件、知识依赖、复用清单、设计令牌、体验检查
├── quickstart.md        # Phase 1：S0–S8 可执行验收剧本
├── contracts/
│   ├── component-page-contract.md      # 组件页契约（章节 + direction + 索引 + 四件套）
│   ├── reuse-manifest.schema.json      # 复用清单 schema
│   ├── design-tokens-contract.md       # 设计令牌与状态矩阵 + 可访问性
│   └── task-console-api.md             # 两端各自消费的接口与事件契约
├── checklists/requirements.md          # 规格质量清单（已完成）
├── checklists/local-baseline.md        # S0–S8 执行证据（机械断言输出 + 人工项记录）
└── tasks.md             # 由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
docs/
├── backend/components/
│   ├── 03-task-console.md      # 改为「后端任务服务组件」：调度/进程组/取消/监控
│   └── 04-safe-queue.md?       # 既有 01-safe-queue.md 保持
├── frontend/components/
│   ├── 01-task-console.md      # 新增：前端控制台组件（交互/状态/实时日志/降级）
│   └── index.md                # 组件索引（引擎渲染 + 方向与知识域筛选）
└── .vitepress/theme/
    ├── styles/tokens.css       # 新增：设计令牌（间距/字号/圆角/阴影/状态/焦点环）
    ├── styles/custom.css       # 只引用令牌，不写魔法值
    └── components/
        ├── TaskConsole.vue     # 前端组件本体（补 aria/键盘/状态）
        └── KnowledgeIndex.vue  # 新增：渲染组件页的知识依赖表

reuse/
├── README.md                   # 复用约定（怎么拿、怎么改、怎么验）
└── task-console/
    ├── manifest.json           # 复用四件套事实源
    ├── backend/                # 后端组件文件清单（指向 service/ 的稳定子集）
    └── frontend/               # 前端组件文件清单（TaskConsole.vue + 令牌子集）

templates/component/            # 组件模板骨架（供 new-content 生成）
scripts/
├── check-experience.mjs        # 新增门禁：令牌/状态/焦点/对比度/响应式静态断言
└── check-component.mjs         # 新增门禁：direction 纯净、知识索引有效、manifest 一致
tests/
└── test_reuse_manifest.py      # 复用清单与实际文件一致性（服务端视角）
```

**Structure Decision**: 站点侧沿用现有 `docs/<domain>/components/` 分区承载两个方向的组件页；
可复用资产新增顶层 `reuse/`（事实源）与 `templates/component/`（骨架），
门禁新增两个 Node 脚本并进 CI——这样「组件先在本仓成型」有固定入口、固定结构与机械判据。

## Complexity Tracking

| 复杂度来源 | 为什么需要 | 更简单的替代方案为何不够 |
|---|---|---|
| 新增 `direction` 元数据 + 纯净度门禁 | 直接修复「后端页记前端内容」的方向错配，并防止回退 | 只靠人工评审：历史上已经错配过一次，无机械判据必然复发 |
| 新增 `reuse/manifest.json` | 复用清单要可校验、可复制，且不能与页面漂移 | 只在页面写清单：无法机械校验与实际文件一致，复制时容易缺文件 |
| 新增设计令牌层 + 体验门禁 | 「专业前端」需要可验收的客观判据 | 只靠主观评审：无法回归，改样式后体验会悄悄退化 |
| 新增 `KnowledgeIndex.vue` | 依赖索引要细到「在本组件中的作用」，手写会漂移 | 手写表格：与 frontmatter 重复，改一处漏一处（违反原则 I） |

## Post-Design Constitution Re-Check（Phase 1 之后）

设计产物（research / data-model / contracts / quickstart）落地后逐条复核，结论仍为全 PASS：

| 原则 | 设计阶段的落点 | 结论 |
|---|---|---|
| I 内容即事实源 | 复用清单与知识依赖都是结构化事实源，页面渲染而非手写；`depends_on_knowledge` 由 `knowledge_index` 派生 | PASS |
| III 契约可执行 | 新增 `component-page-contract.md` 与 `reuse-manifest.schema.json`；门禁 `check:component` 按契约判错 | PASS |
| VI 组件生产级 | 组件页必需章节含设计说明、使用文档、接口契约与测试；后端组件沿用 pytest，前端补静态检查 + 人工清单 | PASS |
| VII 规模优先 | 新增两条 Node 静态门禁，无浏览器依赖、无新服务与端口 | PASS |
| X 导航与接口覆盖 | 组件页 API 手册继续按方法组分层；组件索引支持方向与知识域筛选 | PASS |
| XI 组件首发仓 | `direction` + 两端互链 + 四件套 + 依赖索引 + 独立可运行 + 迁移步骤 + 样式作用域，逐条有契约与门禁承接 | PASS |

**设计阶段新增的两条门禁（实现阶段落地）**

- `npm run check:component`：组件页必填元数据与章节、方向纯净、知识索引有效、
  清单与实际文件一致、`page` 互指。
- `npm run check:experience`：令牌类别与深色覆盖、无原始色值、焦点环、状态类、对比度、
  响应式与滚动（X1–X7）。

**留给实现阶段的边界**

- X8–X10（真实键盘、真实视口、朗读顺序）无法在本沙箱机械化，已写入 `quickstart.md` 的 S6/S7，
  由人工执行并记录证据。
