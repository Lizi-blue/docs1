#!/usr/bin/env node
/**
 * new-content.mjs —— 内容脚手架（六种 kind）。
 *
 * 用法：
 *   node scripts/new-content.mjs <kind> <name> [options]
 *
 *   kind ∈ domain | knowledge-domain | knowledge | component | cross-component | entry
 *
 * 选项：
 *   --domain <slug>            目标领域；除 domain / cross-component 外必填
 *   --knowledge-domain <slug>  knowledge 必填；可写带 NN- 前缀的目录名
 *   --order <n>                排序号；缺省取目标目录下一个可用序号
 *   --dry-run                  只打印将要创建或修改的文件，不写盘
 *   --force                    允许覆盖已存在的文件（默认拒绝）
 *   --help                     打印本帮助
 *
 * 退出码：0 成功 / 1 目标已存在或参数非法（打印冲突路径）/ 2 脚本自身异常。
 *
 * 命名前缀策略（数字前缀只用于排序，MUST NOT 进 URL）：
 *   knowledge-domain / knowledge / component / cross-component  文件名始终带 NN- 前缀
 *   domain                    目录名默认不带前缀，排序号写进 _meta.yml.order
 *   显式给 --order 时，domain 目录也加 NN- 前缀
 *
 * 同目录去前缀后同名即冲突：打印冲突路径并退出码 1。
 *
 * 目录副作用：knowledge-domain 生成含 teach 五字段的 _meta.yml。
 * knowledge 生成四要素标题齐全的页面，并把 { slug, goal } 追加进知识域 teach.lessons。
 * component 生成含三种引用方式标题的骨架。
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import yaml from 'js-yaml'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_ROOT = path.join(REPO_ROOT, 'docs')
const CROSS_DOMAIN_DIR = 'cross-domain'

const KINDS = ['domain', 'knowledge-domain', 'knowledge', 'component', 'cross-component', 'entry']
const ENTRY_KINDS = ['domain', 'learn', 'components']
const LESSON_GOAL_PLACEHOLDER = '<待填，10–60 字>'

/** 参数或前置条件不合法：退出码 1。 */
class CliError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CliError'
  }
}

/* ------------------------------------------------------------------ 工具 */

const rel = (file) => path.relative(REPO_ROOT, file).split(path.sep).join('/')

/** 与 docs/.vitepress/shared/links.ts 的 parseSegment 同规则。 */
function parseSegment(segment) {
  const matched = /^(\d+)[-_](.+)$/.exec(segment)
  if (matched) return { order: Number(matched[1]), slug: matched[2] }
  return { order: null, slug: segment }
}

const stripOrder = (segment) => parseSegment(segment).slug
const pad = (order) => String(order).padStart(2, '0')

const isKebabCase = (name) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
const hasHan = (name) => /\p{Script=Han}/u.test(name)

function isChineseTitle(name) {
  if (!hasHan(name)) return false
  return !/[\s/\\:*?"<>|]/.test(name) && !name.includes('..') && !name.startsWith('~')
}

function assertName(name) {
  if (!isKebabCase(name) && !isChineseTitle(name)) {
    throw new CliError(`name 非法：${name}（只允许 kebab-case 或中文标题）`)
  }
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
}

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, 'utf8')) ?? {}
}

function readFrontmatterOrder(file) {
  try {
    const data = matter(fs.readFileSync(file, 'utf8')).data ?? {}
    return typeof data.order === 'number' ? data.order : null
  } catch {
    return null
  }
}

/** 目标目录下一个可用序号：先看 NN- 前缀，再看 frontmatter.order。 */
function nextOrder(dir) {
  let max = 0
  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const { order } = parseSegment(entry.name)
      if (order !== null) max = Math.max(max, order)
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const pageOrder = readFrontmatterOrder(path.join(dir, entry.name))
        if (pageOrder !== null) max = Math.max(max, pageOrder)
      }
    }
  }
  return max + 1
}

/** 领域：接受目录名或去掉前缀的 slug。 */
function listDomainDirs() {
  return listDirs(DOCS_ROOT).filter(
    (name) => stripOrder(name) !== CROSS_DOMAIN_DIR && fs.existsSync(path.join(DOCS_ROOT, name, '_meta.yml')),
  )
}

function resolveDomain(value) {
  const dirs = listDomainDirs()
  return (
    dirs.find((name) => name === value) ??
    dirs.find((name) => stripOrder(name) === value) ??
    null
  )
}

function resolveKnowledgeDomain(domainDir, value) {
  const learnDir = path.join(domainDir, 'learn')
  const dirs = listDirs(learnDir)
  return (
    dirs.find((name) => name === value) ??
    dirs.find((name) => stripOrder(name) === value) ??
    null
  )
}

/** 同目录内去前缀后同名即重复（内容契约 §1 规则 4）。返回冲突路径或 null。 */
function findSlugCollision(dir, slug) {
  if (!fs.existsSync(dir)) return null
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const existing = stripOrder(entry.name).replace(/\.md$/, '')
    if (existing === slug) return path.join(dir, entry.name)
  }
  return null
}

function assertNoSlugCollision(dir, slug) {
  const file = findSlugCollision(dir, slug)
  if (file) {
    throw new CliError(`目标已存在：${rel(file)}（同目录同名 slug，改名或先删除）`)
  }
}

function requireDomain(value) {
  if (!value) throw new CliError('缺少 --domain <slug>')
  const name = resolveDomain(value)
  if (!name) {
    const available = listDomainDirs().map((dir) => stripOrder(dir))
    throw new CliError(`领域不存在：${value}（已有：${available.join('、') || '无'}）`)
  }
  return { name, dir: path.join(DOCS_ROOT, name) }
}

/* ------------------------------------------------------------------ 骨架 */

function landingPage({ title, domain, entry, description, body }) {
  return `---
title: "${title}"
type: landing
domain: ${domain}
entry: ${entry}
description: "${description}"
---

# ${title}

${body}

<EntryIndex kind="${entry}" />
`
}

function domainMeta({ name, order }) {
  return `name: "${name}"
icon: "📘"
order: ${order}
description: "待填：一句话说明这个领域讲什么"
entry_type: domain
`
}

function subEntryMeta({ name, order, icon, description }) {
  return `name: "${name}"
icon: "${icon}"
order: ${order}
description: "${description}"
`
}

function knowledgeDomainMeta({ name, order }) {
  return `name: "${name}"
order: ${order}
icon: "⚡"
description: "待填：一句话说明这个知识域讲什么"
prerequisites: []
teach:
  audience: "待填：目标读者是谁，至少 10 字"
  prerequisites:
    - "待填：先修知识，至少一条"
  outcomes:
    - "待填：学完能做什么，至少 10 字"
  path:
    - from: "待填-起点"
      to: "待填-终点"
      label: "待填：路径分段"
  # 每讲一条。knowledge 子命令会按页面自动追加。
  lessons: []
`
}

function knowledgePage({ title, domain, knowledgeDomain, order, slug }) {
  return `---
title: "${title}"
type: knowledge
domain: ${domain}
knowledge_domain: ${knowledgeDomain}
order: ${order}
level: basic
tags: [todo-tag]
description: "待填：一句话说明这一讲讲什么"
source_module: "待填模块名"
api_methods:
  - "待填.方法"
prerequisites: []
related_knowledge: []
related_components: []
---

# ${title}

### 本讲要解决的问题

待填：用两三句话说明这一讲回答什么问题。

## TL;DR

> 待填：三句话以内先给结论。

## 概念定义

待填：先给定义，再说它成立的前提。

## 原理图解

待填：说明这张图回答什么问题。

<DiagramFrame src="/diagrams/${slug}.html" title="待填：图解标题" :height="520" />

## 关键对比

| 维度 | 待填 A | 待填 B |
|---|---|---|
| 待填 | 待填 | 待填 |

## API 手册：待填模块

<ApiTable :items='[{"name": "待填.方法", "rank": "必会", "signature": "method()", "params": [], "returns": "待填", "methods": [], "effect": "待填", "scenario": "待填", "example": "pass", "exampleLang": "python"}]' />

## 组合用法：待填功能

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| 待填 | 待填 |

### 数据流图解

待填：说明数据从哪来、到哪去。

### 分步实现

1. 待填：写第一步做什么。
2. 待填：写第二步做什么。

### 对比表格

| 方案 | 优点 | 缺点 |
|---|---|---|
| 待填 | 待填 | 待填 |

## 完整 Demo：待填场景

### 场景描述

待填：说明场景、输入与输出。

### 完整代码

\`\`\`python
# 待填：贴完整可运行代码
\`\`\`

### 运行方式

\`\`\`bash
python3 demo.py
\`\`\`

### 常见误区

- 待填：写一条错误说法与纠正。
- 待填：写另一条错误说法与纠正。

### 面试追问链

<details>
<summary>Q1：待填问题？</summary>

待填：写答案。

</details>

<details>
<summary>Q2：待填问题？</summary>

待填：写答案。

</details>

<details>
<summary>Q3：待填问题？</summary>

待填：写答案。

</details>

### 下一讲衔接

待填：这一讲之后看 [待填下一讲](/待填-下一讲页面)。

### 关联组件

待填：写复用本讲知识的组件，没有就写「暂无」。
`
}

function componentBody({ title, slug, cross }) {
  const head = cross
    ? `## 依赖汇聚

待填：按领域列出依赖页面。

| 领域 | 依赖页面 |
|---|---|
| 待填 | [待填页面](/待填-页面) |
`
    : ''
  const deps = cross
    ? `## 涉及的知识点

| 领域 | 知识点 | 在本组件中的作用 |
|---|---|---|
| 待填 | [待填页面](/待填-页面) | 待填 |
`
    : `## 涉及的知识点

| 知识点 | 对应学习页面 | 在本组件中的作用 |
|---|---|---|
| 待填 | [待填页面](/待填-页面) | 待填 |
`
  return `# ${title}

## 组件简介

待填：用两三句话说明组件做什么。

${deps}
${head}
## 组合方式图解

待填：说明这张图回答什么问题。

<DiagramFrame src="/diagrams/${slug}.html" title="待填：图解标题" :height="520" />

## 核心源码

\`\`\`python
# 待填：贴完整可复制源码
\`\`\`

## 设计说明

待填：说明结构与取舍。

## 使用文档

待填：写接口与最小用法。

## 其他项目如何引用

### 方式一：包管理器安装

待填：写安装命令与最小用法。

### 方式二：直接复制源码

待填：写源文件路径与复制步骤。

### 方式三：框架内集成

待填：写在既有框架里的接入点。

## 与其他组件的关系

待填：写依赖关系与替代关系。
`
}

function renderComponentTemplate({ title, domain, order, slug, kind, cross }) {
  const templateUrl = path.join(REPO_ROOT, 'templates', 'component', 'page.md.tmpl')
  const template = fs.readFileSync(templateUrl, 'utf8')
  const direction = kind === 'cross-component' ? 'fullstack' : domain === 'frontend' ? 'frontend' : 'backend'
  const directionLabel = direction === 'frontend' ? '前端实现' : direction === 'backend' ? '后端实现' : '跨端'
  const knowledgeByDirection = {
    backend: ['/backend/learn/concurrency/executor-pools', '/backend/learn/concurrency/subprocess-signals', '/backend/learn/concurrency/sync-primitives'],
    frontend: ['/frontend/learn/engineering/vite-dev-and-build', '/frontend/learn/engineering/npm-and-modules', '/frontend/learn/engineering/project-structure'],
    fullstack: ['/backend/learn/communication/socket-and-streams', '/frontend/learn/engineering/vite-dev-and-build', '/backend/learn/concurrency/async-advanced'],
  }
  const links = knowledgeByDirection[direction]
  const replacement = {
    '{{title}}': title,
    '{{kind}}': kind,
    '{{domain}}': domain,
    '{{direction}}': direction,
    '{{direction_label}}': directionLabel,
    '{{order}}': String(order),
    '{{slug}}': slug,
    '{{install_command}}': direction === 'frontend' ? 'npm install vue' : '无需安装（复制源码）',
    '{{knowledge_link_1}}': links[0],
    '{{knowledge_link_2}}': links[1],
    '{{knowledge_link_3}}': links[2],
    '{{role_1}}': '待填：该知识点在本组件中承担什么（10–80 字）',
    '{{role_2}}': '待填：该知识点在本组件中承担什么（10–80 字）',
    '{{role_3}}': '待填：该知识点在本组件中承担什么（10–80 字）',
  }
  let rendered = template
  for (const [key, value] of Object.entries(replacement)) rendered = rendered.split(key).join(value)
  return rendered
}

function componentPage({ title, domain, order, slug }) {
  return renderComponentTemplate({ title, domain, order, slug, kind: 'component' })
}

function crossComponentPage({ title, order, domainKey, slug }) {
  const page = renderComponentTemplate({ title, domain: 'cross-domain', order, slug, kind: 'cross-component' })
  return page.replace('depends_on_components: []', `depends_on:\n  ${domainKey}: []\ndepends_on_components: []`)
}

/* ---------------------------------------------------- teach.lessons 追加 */

/** 在 _meta.yml 的 teach.lessons 追加一条；已登记则返回 null。 */
function withLessonAppended(metaFile, slug, goal) {
  const text = fs.readFileSync(metaFile, 'utf8')
  const meta = yaml.load(text)
  if (!meta || typeof meta !== 'object' || !meta.teach) {
    throw new CliError(`${rel(metaFile)} 没有 teach 块。先跑 knowledge-domain 生成知识域。`)
  }
  const lessons = Array.isArray(meta.teach.lessons) ? meta.teach.lessons : []
  const wanted = stripOrder(slug)
  if (lessons.some((lesson) => stripOrder(String(lesson?.slug ?? '')) === wanted)) return null

  const lines = text.split('\n')
  const teachIndex = lines.findIndex((line) => /^teach:\s*$/.test(line))
  if (teachIndex < 0) throw new CliError(`${rel(metaFile)} 的 teach 块不可解析。请手工修正 YAML。`)

  let end = lines.length
  for (let index = teachIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() && !/^\s/.test(lines[index])) {
      end = index
      break
    }
  }

  const item = [`    - slug: "${slug}"`, `      goal: "${goal}"`]
  let lessonsIndex = -1
  for (let index = teachIndex + 1; index < end; index += 1) {
    if (/^\s+lessons:\s*(\[\])?\s*$/.test(lines[index])) {
      lessonsIndex = index
      break
    }
  }

  let next
  if (lessonsIndex < 0) {
    next = [...lines.slice(0, end), '  lessons:', ...item, ...lines.slice(end)]
  } else if (/\[\]\s*$/.test(lines[lessonsIndex])) {
    next = [...lines.slice(0, lessonsIndex), '  lessons:', ...item, ...lines.slice(lessonsIndex + 1)]
  } else {
    const listIndent = lines[lessonsIndex].search(/\S/)
    let last = lessonsIndex
    for (let index = lessonsIndex + 1; index < end; index += 1) {
      if (!lines[index].trim()) continue
      if (lines[index].search(/\S/) <= listIndent) break
      last = index
    }
    next = [...lines.slice(0, last + 1), ...item, ...lines.slice(last + 1)]
  }

  const output = `${next.join('\n')}`
  const parsed = yaml.load(output)
  const registered = (parsed?.teach?.lessons ?? []).map((lesson) => stripOrder(String(lesson.slug)))
  if (!registered.includes(wanted)) {
    throw new Error(`追加 lesson 后自检失败：${rel(metaFile)}`)
  }
  return output
}

/* -------------------------------------------------------------- 计划构造 */

function create(file, content, note) {
  return { action: 'create', file, content, note }
}

function update(file, content, note) {
  return { action: 'update', file, content, note }
}

function buildDomain(args) {
  assertName(args.name)
  const order = args.order ?? nextOrder(DOCS_ROOT)
  assertNoSlugCollision(DOCS_ROOT, stripOrder(args.name))
  const dirName = args.order === null ? args.name : `${pad(args.order)}-${args.name}`
  const slug = stripOrder(dirName)
  const dir = path.join(DOCS_ROOT, dirName)
  return {
    files: [
      create(path.join(dir, '_meta.yml'), domainMeta({ name: args.name, order }), '填领域名称、图标与描述'),
      create(
        path.join(dir, 'index.md'),
        landingPage({
          title: args.name,
          domain: slug,
          entry: 'domain',
          description: '待填：一句话说明这个领域怎么组织',
          body: '待填：说明这个领域的两条线怎么走。',
        }),
        '填领域导语',
      ),
      create(
        path.join(dir, 'learn', '_meta.yml'),
        subEntryMeta({ name: '渐进式学习', order: 1, icon: '📚', description: '按知识域组织，域内按顺序推进' }),
        '通常不用改',
      ),
      create(
        path.join(dir, 'learn', 'index.md'),
        landingPage({
          title: `${args.name} · 渐进式学习`,
          domain: slug,
          entry: 'learn',
          description: '选一个知识域，按推荐起点逐讲推进',
          body: '待填：说明学习入口怎么用。',
        }),
        '填学习入口导语',
      ),
      create(
        path.join(dir, 'components', '_meta.yml'),
        subEntryMeta({ name: '组件查询', order: 2, icon: '🧩', description: '可复用组件：由哪些知识点组合、完整源码、如何引入' }),
        '通常不用改',
      ),
      create(
        path.join(dir, 'components', 'index.md'),
        landingPage({
          title: `${args.name} · 组件查询`,
          domain: slug,
          entry: 'components',
          description: '看依赖、看源码、复制引用方式',
          body: '待填：说明组件入口怎么用。',
        }),
        '填组件入口导语',
      ),
    ],
    next: [
      `跑 node scripts/new-content.mjs knowledge-domain <名字> --domain ${slug} 建知识域`,
      '跑 npm run check:content 与 npm run check:zh 校验',
    ],
  }
}

function buildKnowledgeDomain(args) {
  assertName(args.name)
  const domain = requireDomain(args.domain)
  const order = args.order ?? nextOrder(path.join(domain.dir, 'learn'))
  assertNoSlugCollision(path.join(domain.dir, 'learn'), stripOrder(args.name))
  const dirName = `${pad(order)}-${args.name}`
  return {
    files: [
      create(
        path.join(domain.dir, 'learn', dirName, '_meta.yml'),
        knowledgeDomainMeta({ name: args.name, order }),
        '填 teach 五字段：audience / prerequisites / outcomes / path / lessons',
      ),
    ],
    next: [
      `跑 node scripts/new-content.mjs knowledge <名字> --domain ${stripOrder(domain.name)} --knowledge-domain ${dirName} 建第一讲`,
      'lessons 由 knowledge 子命令自动追加，不用手写',
      '跑 npm run check:content 与 npm run check:zh 校验',
    ],
  }
}

function buildKnowledge(args) {
  assertName(args.name)
  const domain = requireDomain(args.domain)
  if (!args.knowledgeDomain) throw new CliError('knowledge 需要 --knowledge-domain <slug>')
  const kdName = resolveKnowledgeDomain(domain.dir, args.knowledgeDomain)
  if (!kdName) {
    const available = listDirs(path.join(domain.dir, 'learn')).map((dir) => stripOrder(dir))
    throw new CliError(
      `知识域不存在：${args.knowledgeDomain}（已有：${available.join('、') || '无'}）`,
    )
  }
  const kdDir = path.join(domain.dir, 'learn', kdName)
  const metaFile = path.join(kdDir, '_meta.yml')
  if (!fs.existsSync(metaFile)) {
    throw new CliError(`${rel(metaFile)} 不存在。先跑 knowledge-domain 生成知识域。`)
  }
  const order = args.order ?? nextOrder(kdDir)
  assertNoSlugCollision(kdDir, stripOrder(args.name))
  const fileName = `${pad(order)}-${args.name}.md`
  const pageFile = path.join(kdDir, fileName)
  const slug = stripOrder(fileName.replace(/\.md$/, ''))

  const files = [
    create(
      pageFile,
      knowledgePage({
        title: args.name,
        domain: stripOrder(domain.name),
        knowledgeDomain: stripOrder(kdName),
        order,
        slug,
      }),
      '填正文，并把 DiagramFrame 指向已生成的图解产物',
    ),
  ]

  const lessonSlug = fileName.replace(/\.md$/, '')
  const updated = withLessonAppended(metaFile, lessonSlug, LESSON_GOAL_PLACEHOLDER)
  if (updated === null) {
    files.push({
      action: 'skip',
      file: metaFile,
      content: null,
      note: `teach.lessons 已登记 ${lessonSlug}，跳过追加`,
    })
  } else {
    files.push(update(metaFile, updated, `追加 teach.lessons：{ slug: "${lessonSlug}", goal: "${LESSON_GOAL_PLACEHOLDER}" }`))
  }

  return {
    files,
    next: [
      `把 ${rel(pageFile)} 的 title 换成读者可见的中文标题`,
      '补 3 条以上面试追问链，保持 3 到 5 条',
      `在 diagrams/src/${slug}.json 写图源，跑 bash scripts/gen-diagrams.sh 生成图解`,
      `把 teach.lessons 里 ${lessonSlug} 的 goal 填成 10 到 60 字`,
      '跑 npm run check:content 与 npm run check:zh 校验',
    ],
  }
}

function buildComponent(args) {
  assertName(args.name)
  const domain = requireDomain(args.domain)
  const dir = path.join(domain.dir, 'components')
  const order = args.order ?? nextOrder(dir)
  assertNoSlugCollision(dir, stripOrder(args.name))
  const fileName = `${pad(order)}-${args.name}.md`
  const slug = stripOrder(fileName.replace(/\.md$/, ''))
  return {
    files: [
      create(
        path.join(dir, fileName),
        componentPage({
          title: args.name,
          domain: stripOrder(domain.name),
          order,
          slug,
        }),
        '填安装命令、核心源码与三种引用方式',
      ),
    ],
    next: [
      '补「## 核心源码」的完整可复制代码',
      '补三种引用方式：包管理器安装、直接复制源码、框架内集成',
      `在 diagrams/src/${slug}.json 写图源，跑 bash scripts/gen-diagrams.sh 生成图解`,
      '跑 npm run check:content 校验',
    ],
  }
}

function buildCrossComponent(args) {
  assertName(args.name)
  const dir = path.join(DOCS_ROOT, CROSS_DOMAIN_DIR)
  const order = args.order ?? nextOrder(dir)
  assertNoSlugCollision(dir, stripOrder(args.name))
  const fileName = `${pad(order)}-${args.name}.md`
  const slug = stripOrder(fileName.replace(/\.md$/, ''))
  const domainKey = args.domain ? stripOrder(resolveDomain(args.domain) ?? args.domain) : '待填领域'
  return {
    files: [
      create(
        path.join(dir, fileName),
        crossComponentPage({ title: args.name, order, domainKey, slug }),
        '按领域补 depends_on 依赖页面',
      ),
    ],
    next: [
      '把 depends_on 的键换成真实领域 slug',
      '补三种引用方式与核心源码',
      `在 diagrams/src/${slug}.json 写图源，跑 bash scripts/gen-diagrams.sh 生成图解`,
      '跑 npm run check:content 校验',
    ],
  }
}

function buildEntry(args) {
  const entry = args.name
  if (!ENTRY_KINDS.includes(entry)) {
    throw new CliError(`entry 的 name 只允许：${ENTRY_KINDS.join(' / ')}（收到 ${entry}）`)
  }
  const domain = requireDomain(args.domain)
  const slug = stripOrder(domain.name)
  const files = []
  const titleMap = { domain: domain.name, learn: `${domain.name} · 渐进式学习`, components: `${domain.name} · 组件查询` }
  const bodyMap = {
    domain: '待填：说明这个领域的两条线怎么走。',
    learn: '待填：说明学习入口怎么用。',
    components: '待填：说明组件入口怎么用。',
  }
  const descriptionMap = {
    domain: '待填：一句话说明这个领域怎么组织',
    learn: '选一个知识域，按推荐起点逐讲推进',
    components: '看依赖、看源码、复制引用方式',
  }

  if (entry === 'domain') {
    files.push(
      create(
        path.join(domain.dir, 'index.md'),
        landingPage({ title: titleMap.domain, domain: slug, entry, description: descriptionMap.domain, body: bodyMap.domain }),
        '填领域导语',
      ),
    )
  } else {
    const subDir = path.join(domain.dir, entry)
    const metaFile = path.join(subDir, '_meta.yml')
    if (!fs.existsSync(metaFile)) {
      const meta =
        entry === 'learn'
          ? subEntryMeta({ name: '渐进式学习', order: 1, icon: '📚', description: '按知识域组织，域内按顺序推进' })
          : subEntryMeta({ name: '组件查询', order: 2, icon: '🧩', description: '可复用组件：由哪些知识点组合、完整源码、如何引入' })
      files.push(create(metaFile, meta, '通常不用改'))
    }
    files.push(
      create(
        path.join(subDir, 'index.md'),
        landingPage({ title: titleMap[entry], domain: slug, entry, description: descriptionMap[entry], body: bodyMap[entry] }),
        '填入口导语',
      ),
    )
  }
  return { files, next: [`跑 npm run check:content 校验 ${entry} 入口`] }
}

const BUILDERS = {
  domain: buildDomain,
  'knowledge-domain': buildKnowledgeDomain,
  knowledge: buildKnowledge,
  component: buildComponent,
  'cross-component': buildCrossComponent,
  entry: buildEntry,
}

/* -------------------------------------------------------------- 参数解析 */

function parseArgs(argv) {
  const args = {
    kind: null,
    name: null,
    domain: '',
    knowledgeDomain: '',
    order: null,
    dryRun: false,
    force: false,
    help: false,
  }
  const positionals = []
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--dry-run') args.dryRun = true
    else if (token === '--force') args.force = true
    else if (token === '--help' || token === '-h') args.help = true
    else if (token === '--domain' || token === '--knowledge-domain' || token === '--order') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) throw new CliError(`${token} 缺少取值`)
      index += 1
      if (token === '--domain') args.domain = value
      else if (token === '--knowledge-domain') args.knowledgeDomain = value
      else {
        const order = Number.parseInt(value, 10)
        if (!Number.isInteger(order) || order < 0 || order > 999) {
          throw new CliError(`--order 只接受 0 到 999 的整数（收到 ${value}）`)
        }
        args.order = order
      }
    } else if (token.startsWith('--')) {
      throw new CliError(`未知选项：${token}（跑 --help 看全部选项）`)
    } else {
      positionals.push(token)
    }
  }
  ;[args.kind, args.name] = positionals
  return args
}

function usage() {
  return `用法：node scripts/new-content.mjs <kind> <name> [options]

kind：
  domain             领域；同时建 learn/、components/ 与两个 index.md
  knowledge-domain   知识域；生成含 teach 五字段的 _meta.yml
  knowledge          知识点；生成四段式页面并登记 teach.lessons
  component          组件；生成含三种引用方式的骨架
  cross-component    跨领域组件；落在 docs/cross-domain/
  entry              入口页；name ∈ domain | learn | components

options：
  --domain <slug>            目标领域；除 domain / cross-component 外必填
  --knowledge-domain <slug>  knowledge 必填
  --order <n>                排序号；缺省取下一个可用序号
  --dry-run                  只打印将要写入的文件
  --force                    允许覆盖已存在文件（默认拒绝）
  --help                     打印本帮助

退出码：0 成功 / 1 目标已存在或参数非法 / 2 脚本异常。
`
}

/* ------------------------------------------------------------------ 主流程 */

function renderPlan(plan, dryRun) {
  console.log(dryRun ? '将执行（dry-run，不写盘）：' : '执行结果：')
  for (const item of plan.files) {
    if (item.action === 'create') console.log(`  新建  ${rel(item.file)}`)
    else if (item.action === 'update') console.log(`  修改  ${rel(item.file)}`)
    else console.log(`  跳过  ${rel(item.file)}`)
    if (item.note) console.log(`        ${item.note}`)
  }
  if (plan.next.length) {
    console.log('下一步：')
    for (const line of plan.next) console.log(`  - ${line}`)
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(usage())
    return 0
  }
  if (!args.kind || !args.name) {
    console.log(usage())
    return 1
  }
  if (!KINDS.includes(args.kind)) {
    console.log(usage())
    console.error(`未知 kind：${args.kind}`)
    return 1
  }

  const plan = BUILDERS[args.kind](args)
  const conflicts = plan.files
    .filter((item) => item.action === 'create' && fs.existsSync(item.file))
    .map((item) => item.file)
  if (conflicts.length && !args.force) {
    for (const file of conflicts) console.error(`冲突：${rel(file)} 已存在（加 --force 才覆盖）`)
    return 1
  }

  if (args.dryRun) {
    renderPlan(plan, true)
    if (conflicts.length) {
      for (const file of conflicts) console.error(`冲突：${rel(file)} 已存在（加 --force 才覆盖，故本次不会创建）`)
      return 1
    }
    return 0
  }

  for (const item of plan.files) {
    if (item.action === 'skip') continue
    fs.mkdirSync(path.dirname(item.file), { recursive: true })
    fs.writeFileSync(item.file, item.content, 'utf8')
  }
  renderPlan(plan, false)
  return 0
}

try {
  process.exit(main())
} catch (error) {
  if (error instanceof CliError) {
    console.error(`[new-content] ${error.message}`)
    process.exit(1)
  }
  console.error('[new-content] 脚本异常：', error)
  process.exit(2)
}
