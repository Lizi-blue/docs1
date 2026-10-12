# Phase 1 Data Model: 技术面试备考文档引擎（001-docs-engine）

数据模型分三层：**源层**（作者写的文件与元数据）、**模型层**（解析层产出的对象）、
**消费层**（主题与脚本读到的数据结构）。三层之间是单向派生：源 → 模型 → 消费。
没有运行时存储，构建过程本身就是唯一的状态机。

## 源层实体

### E1 DirMeta（目录级 `_meta.yml`）

| 字段 | 类型 | 必填 | 取值 / 约束 | 说明 |
|---|---|---|---|---|
| `name` | string | 是（领域、知识域） | 非空 | 导航显示名 |
| `icon` | string | 否 | 单个 emoji | 导航前缀 |
| `order` | number | 否 | 整数 | 覆盖目录名前缀顺序 |
| `description` | string | 否 | ≤80 字 | 入口页摘要 |
| `entry_type` | enum | 否 | `root` / `domain` | 站点根与领域的区分 |
| `prerequisites` | string[] | 否 | 领域 slug 或 URL | 知识域的先修领域 |
| `path` | PathStep[] | 否 | 见 E2 | 学习路径的分段标签 |

**约束**：同一目录内 `_meta.yml` 至多一份；解析失败 MUST 中止构建并给出文件路径与 YAML 错误行。

### E2 PathStep（学习路径分段）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `from` | string | 是 | 起点页面 slug（带 `NN-` 前缀或不带均可） |
| `to` | string | 是 | 终点页面 slug |
| `label` | string | 否 | 分段显示文案，缺省显示 `from → to` |

### E3 PageFrontmatter（页面 frontmatter）

**所有页面共有**：`title`（string，必填）、`type`（enum，必填）、`description`（string，可选）。

`type` 取值与必填字段：

| 字段 | knowledge | component | cross-component | landing |
|---|---|---|---|---|
| `domain` | 必填（领域 slug） | 必填 | 固定 `cross-domain` | 必填 |
| `knowledge_domain` | 必填（知识域 slug） | — | — | — |
| `order` | 建议（缺省取文件名前缀） | 建议 | 建议 | — |
| `level` | `basic` / `intermediate` / `advanced` | — | — | — |
| `tags` | string[] | — | — | — |
| `source_module` | 模块名（如 `threading`） | — | — | — |
| `api_methods` | string[]（如 `threading.Thread`） | — | — | — |
| `prerequisites` | string[]（页面 URL） | — | — | — |
| `related_knowledge` | string[]（页面 URL） | — | — | — |
| `related_components` | string[]（页面 URL） | — | — | — |
| `component_type` | — | `library` / `framework` / `pattern` / `tool` | 同左 | — |
| `install_command` | — | 必填（字符串） | 必填 | — |
| `depends_on_knowledge` | — | string[]（页面 URL） | — | — |
| `depends_on` | — | — | `{ <domain>: string[] }`（必填，≥1 个领域） | — |
| `depends_on_components` | — | string[] | string[] | — |
| `tags_index` | — | 必填（≥1） | 必填（≥1） | — |
| `reusability` | — | `high` / `medium` / `low` | 同左 | — |
| `entry` | — | — | — | 必填：`domain` / `learn` / `components` |

**约束**：

- `type: knowledge` 的页面正文 MUST 含四段式必需小节（见 `contracts/content-contract.md`）。
- 链接类字段 MUST 指向已存在页面；解析层对链接做前缀归一化（带 `NN-` 或带 `.md` 也能命中）。
- 未知字段 MUST 被判为错误（防止拼写错误静默生效）。

### E4 DiagramSource（图解可编辑源）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `schema_version` | number | 是 | 固定 `1` |
| `diagram_type` | enum | 是 | `architecture` / `workflow` / `sequence` / `dataflow` / `lifecycle` |
| `meta.title` | string | 是 | 图标题 |
| `meta.output` | string | 是 | **可移植相对路径**（绝对路径判错），如 `docs/public/diagrams/x.html` |
| `meta.locale` | string | 否 | `zh-CN` 时 Viewer 界面中文化 |

## 模型层实体（解析层产出）

### E5 PageNode

| 字段 | 类型 | 来源 | 说明 |
|---|---|---|---|
| `file` | string | 扫描 | `docs/` 相对路径，保留 `NN-` 前缀 |
| `url` | string | 规则推导 | 去前缀的站点路径，唯一 |
| `slug` | string | 文件名 | 去前缀后的末段 |
| `order` | number | frontmatter 或前缀 | 排序键 |
| `type` | enum | frontmatter（缺省按目录推断并告警） | 页面类型 |
| `title` | string | frontmatter 或一级标题 | 显示名 |
| `domain` / `domainName` / `domainIcon` | string | 目录 `_meta.yml` | 领域信息快照 |
| `knowledgeDomain` / `knowledgeDomainName` / `knowledgeDomainIcon` / `knowledgeDomainUrl` | string | 知识域目录 `_meta.yml` | 知识域信息快照 |
| `subtopic` | string? | 子主题目录 | 所属子主题 slug |
| `level` / `tags` / `description` | — | frontmatter | 展示与筛选 |
| `prerequisites` / `relatedKnowledge` / `relatedComponents` | string[] | frontmatter | 关联关系原始值 |
| `sourceModule` / `apiMethods` | — | frontmatter | API 手册元信息 |
| `componentType` / `installCommand` / `reusability` / `tagsIndex` | — | frontmatter | 组件页字段 |
| `dependsOnKnowledge` / `dependsOnComponents` | string[] | frontmatter（含 `depends_on` 展开） | 依赖关系 |

**唯一性**：`url` 全局唯一。同目录内两个文件去前缀后同名 MUST 判错（slug 冲突）。

### E6 KnowledgeDomainNode

`slug, name, icon, order, description, prerequisites[], path[], url, pages[PageNode], subtopics[Subtopic]`

**约束**：`pages` 按 `order` 升序，`order` 相同时按 `slug` 字典序（稳定排序）。

### E7 DomainNode

`slug, name, icon, order, description, url, entry{learn?, components?}, learn[KnowledgeDomainNode], components[PageNode], crossComponents[PageNode]`

**约束**：`entry.learn` 与 `entry.components` 分别在 `learn/index.md` 与 `components/index.md`
存在时才有值；两者都缺时构建 MUST 告警（FR-037 / SC-012）。

### E8 DocTree（虚拟模块载荷）

| 字段 | 类型 | 说明 |
|---|---|---|
| `domains` | DomainNode[] | 已按 `order` 排序 |
| `pages` | PageNode[] | 扁平索引（不含入口页） |
| `linkMap` | Record<string, string> | 归一化链接 → 实际 URL，容错匹配用 |
| `backlinks` | Record<string, BacklinkEntry> | 反向链接 |
| `warnings` | string[] | 构建期诊断（缺 type、缺标题、链接未命中等） |

### E9 BacklinkEntry

`reusedByComponents[]`（该知识点被哪些组件依赖）、`usedKnowledge[]`（组件依赖的知识点）、
`componentsOf[]`（跨领域组件依赖的组件）。

### E10 PageIndexEntry（数据加载器产出）

`url, title, type, domain, knowledgeDomain, level, tags[], tagsIndex[], componentType,
reusability, description`。仅包含有 `type` 的页面，按 `url` 排序。

### E11 DiagramArtifact

`source`（`diagrams/src/*.json`）、`output`（`docs/public/diagrams/*.html`）、`diagram_type`、
`referenced_by`（哪些页面用 `<DiagramFrame>` 引用了它）。

**约束**：被引用的产物 MUST 存在；产物 MUST 自包含（无外部 http(s) 资源引用）。

## 关系

```text
Domain 1 ── n KnowledgeDomain 1 ── n PageNode(knowledge)
Domain 1 ── n PageNode(component)          PageNode(knowledge) n ── n PageNode(component)
Domain 1 ── n PageNode(cross-component)    （经 depends_on_knowledge / depends_on）
KnowledgeDomain 1 ── n Subtopic 1 ── n PageNode
PageNode ── n DiagramArtifact（经 DiagramFrame 引用）
DocTree ── 派生 ── 侧边栏 / 导航 / 入口索引 / 反向链接 / 标签索引
```

## 派生视图（不得手工维护）

| 视图 | 派生来源 | 消费者 |
|---|---|---|
| 顶部导航 | `domains[]` | `config.mts` |
| 侧边栏（领域级 / 知识域作用域） | `domains[].learn[]`、`components[]` | `config.mts` |
| 路由重写表 | `pages[].file` → `pages[].url` | `config.mts` |
| 入口页索引 | `domains[]` + `PageIndexEntry[]` | `<EntryIndex>` / `<TagIndex>` |
| 学习进度 | `pages[]` 在所属知识域内的位置 | `<ProgressBar>` |
| 前置知识与关联链接 | `prerequisites` / `related_*` / `backlinks` | `<Prerequisite>` / `<RelatedLinks>` |

## 校验规则汇总（由 `check-content.mjs` 执行）

| 编号 | 规则 | 违反后果 |
|---|---|---|
| V1 | 每级目录至多一份 `_meta.yml`，YAML 可解析 | 判错，给文件与行号 |
| V2 | 页面 MUST 有 `type`，且取值在白名单内 | 判错 |
| V3 | 字段名 MUST 在白名单内（禁未知字段） | 判错 |
| V4 | 必填字段按 E3 表逐类型检查 | 判错 |
| V5 | `url` 全局唯一；同目录 slug 不重复 | 判错，列出冲突文件 |
| V6 | 命名规则：`NN-` 前缀为可选的两位以上数字 | 判错（缺前缀另给提示） |
| V7 | `knowledge` 页四段式小节齐全 | 判错，列出缺失小节 |
| V8 | `component` 页含安装命令、核心源码、≥3 种引用方式 | 判错 |
| V9 | 所有链接字段可在 `linkMap` 命中 | 判错，给来源文件与目标 |
| V10 | 被引用的图解产物存在 | 判错 |
| V11 | 入口页条目数与实际页面数一致 | 判错，给出差额 |
| V12 | `tags_index` 非空且为小写短标签 | 判错 |
| V13 | 结构化载荷（`<ApiTable>` / `<CodeTabs>` 的属性值）可解析 | 判错 |
| V14 | 枚举字段取值合法（`level` / `component_type` / `reusability` / `entry`） | 判错 |
| V19 | 知识点页有「官方依据与版本差异」，≥2 条官方链接且每条带版本标注 | 判错 |
| V20 | 模块接口覆盖（must 全覆盖、common ≥80%）与必会/常用条目字段完整（含 `pitfall`） | 判错 |
| V22 | 未开写知识域只落目录与登记（`teach.status: outline`，无正文、无 lessons） | 判错 |
| V23 | 知识点页 API 手册按方法组 H3 分层（≥2 组，每组紧跟一张 `ApiTable`） | 判错 |
