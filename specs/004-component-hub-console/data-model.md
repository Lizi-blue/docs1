# Phase 1 数据模型：组件首发仓与前后端双端任务控制台

字段来源：`specs/004-component-hub-console/spec.md` 的 FR-001…FR-018；
约束口径与宪法 1.5.0 原则 I、VI、XI 对齐。所有清单类实体都是「可机械校验」的单一事实源。

## E1 Component（组件）

| 字段 | 类型 | 约束 |
|---|---|---|
| `name` | string | 必填，读者可见名称 |
| `slug` | string | 必填，来自文件名，全站唯一 |
| `domain` | string | 必填，组件所属领域（`backend` / `frontend` / `cross-domain`） |
| `direction` | enum | 必填：`backend` / `frontend` / `fullstack`；MUST 与 `domain` 映射一致 |
| `url` | string | 派生，不含 `NN-` 前缀 |
| `component_type` | enum | `library` / `framework` / `pattern` / `tool` |
| `install_command` | string | 必填，复制到项目后的安装命令或「无需安装」说明 |
| `knowledge_index` | KnowledgeDependency[] | 必填，≥3 条；每条含页面与作用 |
| `reuse_manifest` | string | 必填，指向 `reuse/<component>/manifest.json` |
| `cross_link` | string | 必填（`fullstack` 除外），指向同一功能另一端的组件页 |
| `contract_version` | semver | 必填，来自 manifest，用于迁移判定 |
| `status` | enum | 派生：`authored`（有页面+清单）→ `verified`（测试/门禁通过）→ `reused`（已在生产项目使用，人工标注） |

**校验规则**

- `direction` 与 `domain` 映射：`backend/*` → `backend`；`frontend/*` → `frontend`；
  `cross-domain/*` → `fullstack`。不一致即判错（FR-002）。
- 组件页 MUST NOT 出现另一方向的实现正文：后端页不得出现前端实现细节
  （组件后缀 `.vue`、浏览器专有 API），前端页不得出现后端实现细节
  （进程组、信号、服务端线程池）；仅允许出现在「对应另一端」链接段（FR-002）。
- 样式 MUST 限定作用域：组件样式选择器 MUST 带组件前缀或使用 `scoped`（FR-016）。

## E2 KnowledgeDependency（知识依赖）

| 字段 | 类型 | 约束 |
|---|---|---|
| `page` | string | 必填，知识点页面 URL 或知识域入口 URL |
| `role` | string | 必填，10–80 字，说明该知识点在本组件中承担什么（FR-003） |
| `knowledge_domain` | string | 派生，来自页面路径的第 2 段 |
| `is_outline` | boolean | 派生；为真时页面 MUST 渲染「待补」而不是普通链接（FR-004） |

**校验规则**：`page` MUST 命中链接表；未命中且对应知识域为 `outline` 时标「待补」，
否则判错（无死链）。同一组件内 `page` MUST 唯一。

## E3 ReuseManifest（复用清单，`reuse/<component>/manifest.json`）

| 字段 | 类型 | 约束 |
|---|---|---|
| `component` | string | 必填，与组件 slug 一致 |
| `contract_version` | semver | 必填 |
| `page` | string | 必填，对应组件页 URL（必须与清单互指） |
| `sides` | object | 必填，`backend` / `frontend` 各自一份（缺哪端就省略该键） |
| `sides[].files` | array | 必填，≥1；每项 `{ path, purpose, required }`，`path` MUST 存在于仓库 |
| `sides[].external_deps` | array | 必填（可为空）；每项 `{ name, version, install }`，MUST 为公开依赖 |
| `sides[].adaptation` | array | 必填，≥1；每项 `{ point, how }`，说明复制后要改什么 |
| `sides[].verify` | array | 必填，≥1；每项 `{ command, expect }`，命令 MUST 可在目标项目直接执行 |
| `notes` | string | 可选，限制与已知问题 |

**校验规则**：清单里出现的每个 `path` MUST 在仓库中存在；组件页 MUST 引用同一清单；
`contract_version` MUST 与页面渲染一致（FR-005/FR-006/FR-007）。

## E4 DesignToken（设计令牌，`docs/.vitepress/theme/styles/tokens.css`）

| 字段 | 类型 | 约束 |
|---|---|---|
| `name` | string | 必填，`--docs1-*` 前缀 |
| `category` | enum | `space` / `font` / `radius` / `shadow` / `color` / `focus` / `state` |
| `light` | string | 必填 |
| `dark` | string | 必填，深色模式同一令牌要有值 |
| `usage` | string | 可选，注释说明用途 |

**校验规则**：每个类别 ≥1 个令牌；组件与站点样式 MUST 通过令牌取值，
MUST NOT 出现原始色值（`#rgb` / `rgb()`）与魔法尺寸（裸 `px` 值 ≥ 8 除外白名单）（FR-010）。

## E5 ExperienceCheck（体验检查项）

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | string | 必填，`X1`…`Xn` |
| `category` | enum | `token` / `state` / `focus` / `contrast` / `responsive` / `keyboard` / `sr` |
| `type` | enum | `mechanical`（进 `check:experience`）或 `manual`（进 quickstart 清单） |
| `rule` | string | 必填，可判定的断言 |
| `evidence` | string | 必填，命令输出或人工记录位置 |

**校验规则**：每条 FR-010…FR-016 MUST 至少对应一条检查项；
`mechanical` 项 MUST 由门禁脚本产出证据，`manual` 项 MUST 在 quickstart 有可执行步骤。

## E6 DirectionIndex（组件索引的方向与知识域筛选）

| 字段 | 类型 | 约束 |
|---|---|---|
| `direction_filter` | enum | `all` / `backend` / `frontend` / `fullstack` |
| `knowledge_domain_filter` | string | 可选，来自组件的 `knowledge_index[].knowledge_domain` 去重集合 |
| `items` | Component[] | 按 `order` 与名称排序，受筛选影响 |

**校验规则**：筛选控件 MUST 存在且可键盘操作；筛选不改变组件页链接的有效性（FR-008/FR-009）。

## 状态与关系

```text
Domain 1 ── * Component
Component 1 ── * KnowledgeDependency ── 1 KnowledgePoint（或 outline 知识域）
Component 1 ── 1 ReuseManifest ── * ReuseFile
Component 1 ── 1 cross_link ── 1 Component（另一端，成对出现）
DesignToken * ── * ExperienceCheck（令牌与状态项为检查证据来源）
```

**状态迁移（Component）**

| 起 | 终 | 触发条件 |
|---|---|---|
| planned | authored | 页面 + manifest + 知识索引齐备且门禁通过 |
| authored | verified | 测试与体验门禁通过，quickstart 剧本可复现 |
| verified | reused | 已复制到某个生产项目（页面标注迁移记录，人工） |
| 任意 | planned | 契约破坏性变更且迁移步骤未写（回退，MUST 补迁移说明） |
