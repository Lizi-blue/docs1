# Contract: 内容契约（作者视角）

适用对象：任何新增或修改 `docs/**` 内容的人（含 AI Agent）。违反本契约必须由
`scripts/check-content.mjs` 判红。

## 1. 目录布局

```text
docs/
├── _meta.yml
├── index.md
└── <domain>/                        # 领域：目录名可带 NN- 前缀
    ├── _meta.yml                    # 必填：name / icon / order / description / entry_type
    ├── index.md                     # 领域首页：frontmatter.entry = domain
    ├── learn/
    │   ├── _meta.yml
    │   ├── index.md                 # 学习入口：frontmatter.entry = learn
    │   └── <NN-knowledge-domain>/   # 知识域
    │       ├── _meta.yml            # 必填：name / order / icon / description / path
    │       ├── <NN-page>.md         # 知识点（四段式）
    │       └── <NN-subtopic>/       # 可选：子主题（目录层级最多四层）
    │           └── <NN-page>.md
    └── components/
        ├── _meta.yml
        ├── index.md                 # 组件入口：frontmatter.entry = components
        └── <name>.md                # 组件页

docs/cross-domain/<name>.md          # 跨领域组件（frontmatter.type = cross-component）
```

**规则**

1. 领域根目录 MUST 同时有 `learn/` 与 `components/` 及各自的 `index.md`。缺一个即判错。
2. 目录层级最多四层（`learn` → 知识域 → 子主题 → 页面）。超过即判错。
3. 数字前缀 `NN-` 只用于排序。它 MUST NOT 出现在 URL 中。
4. 未使用 `NN-` 前缀时按名称排序并给提示；同一目录内去前缀后同名即判错。

## 2. 目录级 `_meta.yml`

```yaml
name: "并发编程"          # 必填
order: 1                 # 建议
icon: "⚡"                # 建议
description: "线程、进程、队列与异步 I/O"   # ≤80 字
prerequisites: []        # 领域 slug 或页面 URL
path:                    # 学习路径分段，用于入口页展示
  - from: "01-thread-basics"
    to: "02-process-basics"
    label: "线程基础 → 进程基础"
```

字段白名单与类型见 `schemas/dir-meta.schema.json`。未知字段判错。

## 3. 页面 frontmatter

### 3.1 知识点页

```yaml
---
title: "多线程基础"
type: knowledge
domain: backend
knowledge_domain: concurrency
order: 1
level: basic                  # basic | intermediate | advanced
tags: [threading, gil, sync]
description: "Python 多线程的创建、同步与通信"
source_module: "threading"
api_methods: ["threading.Thread", "threading.Lock"]
prerequisites: []             # 页面 URL，可带或不带 NN- 前缀
related_knowledge: []
related_components: []
---
```

### 3.2 组件页

```yaml
---
title: "进程安全队列"
type: component
domain: backend
component_type: library       # library | framework | pattern | tool
order: 1
install_command: "pip install py-safe-queue"
depends_on_knowledge: ["/backend/learn/concurrency/queue-pipe"]
depends_on_components: []
tags_index: [multiprocessing, queue, sentinel]   # 非空，小写短标签
reusability: high             # high | medium | low
description: "把队列、哨兵与异常回传封成可复用的进程池执行器"
---
```

### 3.3 跨领域组件页

```yaml
---
title: "任务调度下发 + 实时日志查询"
type: cross-component
domain: cross-domain
depends_on:
  backend: ["/backend/learn/concurrency/queue-pipe"]
  frontend: ["/frontend/learn/engineering/vite-dev-and-build"]
install_command: "pip install task-scheduler && npm install @task/log-viewer"
tags_index: [websocket, multiprocessing, vue3]
description: "后端队列加前端实时日志的双向组件"
---
```

### 3.4 入口页

```yaml
---
title: "Python 后端"
type: landing
domain: backend
entry: domain                 # domain | learn | components
description: "先按路径学，再按组件查"
---
```

入口页正文 MUST 含 `<EntryIndex kind="..." />`（`kind` 与 `entry` 一致）。索引条目由引擎生成，
作者只写导语。作者 MUST NOT 手写条目清单。

## 4. 知识点页四段式（必需小节）

标题 MUST 逐字如下（冒号后可接功能名）：

| 段 | 必需标题 |
|---|---|
| 一 原理讲解 | `## TL;DR`、`## 概念定义`、`## 原理图解`、`## 关键对比` |
| 二 API 手册 | `## API 手册：<模块名>`，内部用 `<ApiTable>`；每个方法 MUST 带重要性分档 |
| 三 组合用法 | `## 组合用法：<功能名>`，含 `### 组合了哪些知识？`、`### 数据流图解`、`### 分步实现`、`### 对比表格` |
| 四 完整 Demo | `## 完整 Demo：<场景名>`，含 `### 场景描述`、`### 完整代码`、`### 运行方式`、`### 面试追问链`、`### 关联组件` |

`## 原理图解` MUST 含至少一个 `<DiagramFrame src="/diagrams/<name>.html" ... />`。

## 5. 组件页结构

1. `## 组件简介`
2. `## 涉及的知识点`（表格：知识点 | 对应学习页面 | 在本组件中的作用）
3. `## 组合方式图解`（`<DiagramFrame>`）
4. `## 组合方式图解` 之后为 `## 核心源码`（完整可复制代码）
5. `## 设计说明`（结构与取舍）
6. `## 使用文档`（接口与最小用法）
7. `## 其他项目如何引用`（触发双栏切分；至少三种方式：包管理器安装、直接复制源码、框架内集成）
8. `## 与其他组件的关系`

顶部 MUST 有可复制安装命令：由 `frontmatter.install_command` 自动渲染 `<InstallBox>`。

## 6. 结构化组件载荷

`<ApiTable>` 与 `<CodeTabs>` 的载荷 MUST 由脚手架或校验器生成，形式为**单引号属性 + HTML 实体转义**：

```markdown
<ApiTable :items='[{ "name": "threading.Thread", "rank": "必会", ... }]' />
```

- 属性 MUST 用单引号包裹。载荷内的 `&`、`'`、`<`、`>` MUST 转成 HTML 实体。
- 校验器 MUST 能解析该载荷；解析失败即判错（V13）。
- 禁止在载荷里直接写裸 `'`（会终止属性）。

## 7. 受控中文

- 说明句 ≤40 字，指令句 ≤25 字。一句一动作。主动语态。
- 禁分号连动作、虚动词、套话、营销形容词、含糊词。
- 代码块、命令、专有名词与 API 名称不参与判定。
- 提交前 MUST 跑 `npm run check:zh`。

## 8. 提交前自检

```bash
npm run check:content   # 元数据、结构、命名、链接、图解存在性
npm run check:zh        # 受控中文
npm run build           # 站点可构建
```
