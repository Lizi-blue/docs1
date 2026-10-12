# 契约：组件页（component-page-contract）

适用对象：`docs/<domain>/components/<NN-name>.md`（`type: component`）与
`docs/cross-domain/<NN-name>.md`（`type: cross-component`）。取值口径与
`specs/001-docs-engine/contracts/content-contract.md` 互补，冲突时以本契约的组件条款为准。

## 1. 元数据

| 字段 | 必填 | 约束 |
|---|---|---|
| `title` / `type` / `domain` | 是 | `type: component` |
| `direction` | 是 | `backend` / `frontend` / `fullstack`，MUST 与 `domain` 映射一致 |
| `component_type` | 是 | `library` / `framework` / `pattern` / `tool` |
| `install_command` | 是 | 复制后如何引入；无需安装时写「无需安装」并给出引入方式 |
| `knowledge_index` | 是 | ≥3 条 `{ page, role }`，`role` 10–80 字 |
| `reuse_manifest` | 是 | 指向 `reuse/<component>/manifest.json` |
| `cross_link` | 当同一功能存在另一端时必填 | 另一端组件页 URL；仅后端或仅前端时省略 |
| `tags_index` / `reusability` | 是 | 沿用既有取值 |
| `depends_on_knowledge` | 由 `knowledge_index` 派生 | 允许同时手写，但 MUST 与派生结果一致 |

## 2. 必需章节与顺序

共 16 节。其中「核心源码」与「其他项目如何引用（三种方式）」是 001 内容门禁 V8 的既有要求，
MUST 保留，MUST NOT 因本次重构改名或删除。

1. `## 组件简介` — 一句话说清它解决什么；标明方向（后端实现 / 前端实现）。
2. `## 对应另一端` — 链接到同一功能另一方向的组件页（有对端时必写；仅单方向可省）。
3. `## 依赖的知识域与知识点` — 由 `<KnowledgeIndex />` 渲染，作者不手写表格。
4. `## 涉及的知识点` — 沿用既有表格（知识点 | 对应学习页面 | 在本组件中的作用）。
5. `## 组合方式图解` — 至少一张 `<DiagramFrame>`。
6. `## 核心源码` — 完整可复制的源码（V8 要求）；整文件很长时给出文件清单并在复用四件套里指向。
7. `## 设计说明` — 关键取舍与边界；含 `### 官方依据与版本差异`（≥2 条官方链接且带版本）。
8. `## 使用文档` — 复制到项目后怎么用；含最小示例。
9. `## 复用四件套` — 由 `reuse/<component>/manifest.json` 渲染：文件清单、外部依赖、适配点、验收命令。
10. `## 其他项目如何引用` — 三种方式：`### 方式一` / `### 方式二` / `### 方式三`（V8 要求）。
11. `## 接口契约` — 需要外部提供的接口/事件与失败、降级约定；含 `### 契约版本与迁移`。
12. `## API 手册：<组件名>` — 按方法组分层，≥2 组，每组紧跟一张 `<ApiTable>`；必会/常用条目给全七字段（含 `pitfall`）。
13. `## 常见误区` — ≥2 条。
14. `## 面试追问链` — 3–5 条递进。
15. `## 与其他组件的关系` — 引用或被引用。
16. `## 下一讲衔接` — 指向相关知识点或组件。

## 3. 方向纯净

- 后端组件页 MUST NOT 出现前端实现细节：组件文件名后缀 `.vue`、浏览器专有 API
  （`EventSource`、`document`、`window`、`fetch`）、CSS 令牌取值表。
- 前端组件页 MUST NOT 出现后端实现细节：进程组与信号（`killpg`、`SIGTERM`）、
  服务端线程池、白名单校验实现、`/proc` 采样。
- 例外：`## 对应另一端` 一节允许出现对方方向的名词，用于指路。
- 违反以上任一条即判错（对应 FR-002 / SC-002）。

## 4. 复用要求

- 页面 MUST 渲染 `reuse/<component>/manifest.json` 的全部四件套字段，MUST NOT 手写清单。
- 组件 MUST 能在不依赖本仓其余部分时运行：清单里 `files[]` 覆盖全部必需文件，
  `external_deps[]` 只含公开依赖。
- 破坏性变更 MUST 递增 `contract_version` 并在 `### 契约版本与迁移` 写明迁移步骤。

## 5. 样式作用域

- 组件样式 MUST `scoped` 或用组件自有类前缀（如 `.task-*`），MUST NOT 使用全局元素选择器。
- 组件 MUST 通过设计令牌取值（见 `design-tokens-contract.md`），MUST NOT 写原始色值。
- 门禁校验：`scripts/check-component.mjs` MUST 断言组件样式的 `<style>` 带 `scoped` 或选择器带组件类前缀，
  MUST NOT 出现全局元素选择器（如裸 `button`、`div`）；违规即判错。
- 门禁校验：声明了 `cross_link` 的组件页 MUST 双向互链，任一端缺失 `## 对应另一端` 即判错；
  只有单一方向的组件（如进程安全队列）无对端，可不写该字段。
