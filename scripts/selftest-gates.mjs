#!/usr/bin/env node
/**
 * selftest-gates —— 内容门禁的自测套件（001 T023/T025，002 T052 的机械版）。
 *
 * 做法：在系统临时目录造一棵最小合规文档树，逐个「定向破坏」，
 * 运行 check-content.mjs 并断言它按预期规则判红；最后用未破坏的树做正例。
 * 目的是证明门禁真的会红，而不是只会绿。
 *
 * 用法：node scripts/selftest-gates.mjs [--json] [--keep]
 * 退出码：0 全部符合预期 / 1 有不符合 / 2 脚本异常。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const PAGE = `---
title: "夹具知识点"
type: knowledge
domain: zz
knowledge_domain: kd
order: 1
level: basic
tags: [fixture]
description: "夹具页"
source_module: "fixture"
api_methods: ["fixture.call"]
prerequisites: []
related_knowledge: []
related_components: []
---

# 夹具知识点

### 本讲要解决的问题

夹具页用于验证门禁。

## TL;DR

> 夹具。

## 概念定义

夹具。

## 原理图解

<DiagramFrame src="/diagrams/fixture.html" title="夹具图" />

## 关键对比

| 维度 | 值 |
|---|---|
| 夹具 | 是 |

### 官方依据与版本差异

- [threading 官方文档](https://docs.python.org/3/library/threading.html) — 3.8 及以后适用。
- [PEP 703](https://peps.python.org/pep-0703/) — 3.13 起实验性提供。

## API 手册：fixture

### 基础调用
<ApiTable :items='[{"name": "fixture.call", "rank": "必会", "params": [{"name": "a", "type": "int", "default": "1", "desc": "夹具"}], "returns": "无", "effect": "夹具", "scenario": "夹具", "example": "fixture.call(1)", "pitfall": "夹具误区"}]' />

### 扩展调用
<ApiTable :items='[{"name": "fixture.extend", "rank": "常用", "params": [], "returns": "无", "effect": "夹具扩展", "scenario": "夹具", "example": "fixture.extend()", "pitfall": "夹具误区"}]' />

## 组合用法：夹具功能

### 组合了哪些知识？

夹具。

### 数据流图解

<DiagramFrame src="/diagrams/fixture.html" title="夹具图" />

### 分步实现

1. 夹具。

### 对比表格

| 方案 | 说明 |
|---|---|
| 夹具 | 夹具 |

## 完整 Demo：夹具场景

### 场景描述

夹具。

### 完整代码

\`\`\`python
print("fixture")
\`\`\`

### 运行方式

\`\`\`bash
python3 fixture.py
\`\`\`

### 常见误区

- 误以为门禁是建议。门禁是闸门。

### 面试追问链

<details><summary>Q1：夹具？</summary>夹具。</details>
<details><summary>Q2：为什么？</summary>夹具。</details>
<details><summary>Q3：代价？</summary>夹具。</details>

### 下一讲衔接

夹具，回到 [学习入口](/zz/learn/)。

### 关联组件

夹具。
`

const COMPONENT = `---
title: "夹具组件"
type: component
domain: zz
component_type: library
order: 1
install_command: "pip install fixture"
depends_on_knowledge:
  - /zz/learn/kd/page
depends_on_components: []
tags_index: [fixture]
reusability: high
description: "夹具组件"
---

# 夹具组件

## 组件简介

夹具。

## 涉及的知识点

| 知识点 | 对应学习页面 | 在本组件中的作用 |
|---|---|---|
| 夹具 | [夹具知识点](/zz/learn/kd/page) | 夹具 |

## 组合方式图解

<DiagramFrame src="/diagrams/fixture.html" title="夹具图" />

## 核心源码

\`\`\`python
def fixture():
    return 1
\`\`\`

## 其他项目如何引用

### 方式一：pip 安装

夹具。

### 方式二：直接复制源码

夹具。

### 方式三：在框架中集成

夹具。
`

function write(root, relative, content) {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function buildFixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs1-selftest-'))
  write(root, '_meta.yml', 'name: "根"\n')
  write(root, 'index.md', '---\ntitle: 首页\nlayout: home\n---\n')
  write(root, 'zz/_meta.yml', 'name: "夹具域"\nicon: "🧪"\norder: 1\nentry_type: domain\n')
  write(root, 'zz/index.md', '---\ntitle: 夹具域\ntype: landing\ndomain: zz\nentry: domain\n---\n\n夹具域导语。索引区由引擎渲染。\n')
  write(root, 'zz/learn/_meta.yml', 'name: "学习"\n')
  write(root, 'zz/learn/index.md', '---\ntitle: 学习\ntype: landing\ndomain: zz\nentry: learn\n---\n\n学习导语。\n')
  write(root, 'zz/components/_meta.yml', 'name: "组件"\n')

  const teach = options.breakTeach
    ? 'description: "夹具知识域"\n'
    : `description: "夹具知识域"
teach:
  audience: "夹具读者，用于门禁自测"
  prerequisites:
    - "无"
  outcomes:
    - "验证门禁按预期判红"
  path:
    - from: "01-page"
      to: "01-page"
      label: "夹具路径"
  lessons:
    - slug: "01-page"
      goal: "验证知识点与登记双向一致"
`
  write(root, 'zz/learn/01-kd/_meta.yml', `name: "夹具知识域"\norder: 1\nicon: "📘"\n${teach}`)

  let page = PAGE
  if (options.breakSection) page = page.replace('## 关键对比', '## 关键对照')
  if (options.breakElement) page = page.replace('### 常见误区', '### 常见误解')
  if (options.breakLink) page = page.replace('related_knowledge: []', 'related_knowledge: ["/zz/learn/kd/not-exist"]')
  if (options.breakPayload) page = page.replace('"name": "fixture.call"', '"name": fixture.call')
  if (options.breakDiagram) page = page.replace('/diagrams/fixture.html', '/diagrams/not-exist.html')
  if (options.breakOfficialSources) page = page.replace('### 官方依据与版本差异', '### 参考资料')
  if (options.breakApiGroups) page = page.replace('### 扩展调用', '')
  write(root, 'zz/learn/01-kd/01-page.md', page)

  let component = COMPONENT
  if (options.breakComponent) {
    component = component.replace('install_command: "pip install fixture"\n', '')
    component = component.split('### 方式二')[0]
  }
  write(root, 'zz/components/01-cmp.md', component)

  const componentsIndex = options.handWrittenIndex
    ? '---\ntitle: 组件\ntype: landing\ndomain: zz\nentry: components\n---\n\n- [夹具组件](/zz/components/cmp)\n'
    : '---\ntitle: 组件\ntype: landing\ndomain: zz\nentry: components\n---\n\n组件导语。\n'
  write(root, 'zz/components/index.md', componentsIndex)

  write(root, 'public/diagrams/fixture.html', '<!doctype html><html lang="zh-CN"><body><svg width="10" height="10"></svg></body></html>')
  return root
}

function runChecker(root) {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', path.join(REPO_ROOT, 'scripts', 'check-content.mjs'), '--root', root, '--json'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )
  let payload = null
  try {
    payload = JSON.parse(result.stdout)
  } catch {
    payload = { ok: false, errors: [], parseError: result.stdout.slice(0, 200) + result.stderr.slice(0, 200) }
  }
  return { status: result.status, payload }
}


/* ------------------------------------------------- 004：组件页与体验门禁夹具 */

/** 组件页夹具：16 节齐全，可按需破坏。 */
function componentPageFixture({ domain, direction, crossLink, omitCounterpart, injectFrontendWord }) {
  const blocks = []
  blocks.push('## 组件简介', '', '夹具组件，只讲本方向实现。', '')
  if (crossLink && !omitCounterpart) blocks.push('## 对应另一端', '', `对端：[另一端](${crossLink})`, '')
  blocks.push('## 依赖的知识域与知识点', '', '<KnowledgeIndex />', '')
  // 契约 §2 的对象三节（宪法 XII）：清单 + 逐对象成节 + 协作与流程。
  blocks.push('## 对象模型', '', '| 对象 | 职责 | 状态 | 生命周期 |', '|---|---|---|---|',
    '| `Fixture` | 夹具备注 | 无 | 随调用创建 |', '',
    '### Fixture', '', '| 项 | 内容 |', '|---|---|', '| 职责 | 夹具备注 |', '| 持有 | 无 |',
    '| 方法 | `fixture.call` |', '| 边界 | 夹具 |', '| 谁调用它 | 夹具 |', '| 它调用谁 | 夹具 |', '')
  blocks.push('## 对象层级', '', '源码没有继承，关系全是持有。', '')
  blocks.push('## 对象协作与流程', '', '### 流程一：夹具', '', '1. 夹具收到调用。', '2. 夹具校验入参。',
    '3. 夹具调用对象。', '4. 夹具落终态。', '5. 夹具回事件。', '')
  blocks.push('## 组合方式图解', '', '<DiagramFrame src="/diagrams/fixture.html" title="夹具图" />', '')
  blocks.push('## 核心源码', '', '```python', 'print("fixture")', '```', '')
  if (injectFrontendWord) blocks.push('界面部分见 TaskConsole.vue。', '')
  blocks.push('## 设计说明', '', '夹具。', '', '### 官方依据与版本差异', '',
    '- [Python 文档](https://docs.python.org/3/library/subprocess.html) — 3.8 起适用。',
    '- [PEP 8](https://peps.python.org/pep-0008/) — 长期有效。', '')
  blocks.push('## 使用文档', '', '夹具。', '')
  blocks.push('## 复用四件套', '', '夹具。', '')
  blocks.push('## 其他项目如何引用', '', '### 方式一：复制源码', '', '夹具。', '',
    '### 方式二：包管理器安装', '', '夹具。', '', '### 方式三：框架内集成', '', '夹具。', '')
  blocks.push('## 接口契约', '', '夹具。', '', '### 契约版本与迁移', '', '夹具。', '')
  blocks.push('## API 手册：夹具', '', '### 基础调用', '',
    "<ApiTable :items='[{\"name\": \"fixture.call\", \"rank\": \"必会\"}]' />", '',
    '### 扩展调用', '', "<ApiTable :items='[{\"name\": \"fixture.extend\", \"rank\": \"常用\"}]' />", '')
  blocks.push('## 常见误区', '', '夹具。', '')
  blocks.push('## 面试追问链', '', '夹具。', '')
  blocks.push('## 与其他组件的关系', '', '夹具。', '')
  blocks.push('## 下一讲衔接', '', '夹具。', '')

  const frontmatter = [
    '---',
    'title: "夹具组件"',
    'type: component',
    `domain: ${domain}`,
    `direction: ${direction}`,
    'component_type: library',
    'order: 1',
    'install_command: "无需安装，直接复制源码"',
    'knowledge_index:',
    '  - page: "/backend/learn/kd/p1"',
    '    role: "讲清夹具组件依赖的第一个核心概念"',
    '  - page: "/backend/learn/kd/p2"',
    '    role: "讲清夹具组件依赖的第二个核心概念"',
    '  - page: "/backend/learn/kd/p3"',
    '    role: "讲清夹具组件依赖的第三个核心概念"',
    'reuse_manifest: reuse/fixture/manifest.json',
    crossLink ? `cross_link: "${crossLink}"` : null,
    'tags_index: [fixture]',
    'reusability: high',
    'description: "夹具组件"',
    '---',
    '',
  ].filter((line) => line !== null)
  return `${frontmatter.join('\n')}\n# 夹具组件\n\n${blocks.join('\n')}`
}

const KNOWLEDGE_LITE = (title) => `---
title: "${title}"
type: knowledge
domain: backend
knowledge_domain: kd
---

# ${title}

夹具知识点，仅用于链接表。
`

const MANIFEST = {
  component: 'fixture',
  contract_version: '1.0.0',
  page: '/backend/components/cmp',
  sides: {
    backend: {
      files: [{ path: 'docs/backend/components/01-cmp.md', purpose: '后端组件页与源码', required: true }],
      external_deps: [],
      adaptation: [{ point: '工作目录', how: '按项目改工作目录常量' }],
      verify: [{ command: 'node scripts/check-component.mjs', expect: '退出码 0' }],
    },
    frontend: {
      files: [{ path: 'docs/frontend/components/01-cmp.md', purpose: '前端组件页与源码', required: true }],
      external_deps: [],
      adaptation: [{ point: '接口地址', how: '改成项目自己的接口前缀' }],
      verify: [{ command: 'node scripts/check-component.mjs', expect: '退出码 0' }],
    },
  },
}

/** 组件门禁夹具： workspace = <root>，文档根 = <root>/docs。 */
function buildComponentFixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs1-cmp-'))
  const docs = path.join(root, 'docs')
  write(docs, '_meta.yml', 'name: "根"\n')
  for (const domain of ['backend', 'frontend']) {
    write(docs, `${domain}/_meta.yml`, `name: "${domain}"\nicon: "🧪"\norder: 1\nentry_type: domain\n`)
    write(docs, `${domain}/index.md`, `---\ntitle: ${domain}\ntype: landing\ndomain: ${domain}\nentry: domain\n---\n\n导语。\n`)
    write(docs, `${domain}/learn/_meta.yml`, 'name: "学习"\n')
    write(docs, `${domain}/learn/index.md`, `---\ntitle: 学习\ntype: landing\ndomain: ${domain}\nentry: learn\n---\n\n导语。\n`)
    write(docs, `${domain}/components/_meta.yml`, 'name: "组件"\n')
    write(docs, `${domain}/components/index.md`, `---\ntitle: 组件\ntype: landing\ndomain: ${domain}\nentry: components\n---\n\n导语。\n`)
  }
  write(docs, 'backend/learn/01-kd/_meta.yml', 'name: "夹具知识域"\n')
  for (const slug of ['p1', 'p2', 'p3']) write(docs, `backend/learn/01-kd/01-${slug}.md`, KNOWLEDGE_LITE(`夹具${slug}`))
  write(docs, 'backend/components/01-cmp.md', componentPageFixture({
    domain: 'backend', direction: 'backend', crossLink: '/frontend/components/cmp',
    omitCounterpart: options.omitCounterpart, injectFrontendWord: options.breakPurity,
  }))
  write(docs, 'frontend/components/01-cmp.md', componentPageFixture({
    domain: 'frontend', direction: 'frontend', crossLink: '/backend/components/cmp',
  }))
  write(root, 'reuse/fixture/manifest.json', JSON.stringify(MANIFEST, null, 2))
  write(docs, '.vitepress/theme/styles/custom.css', '.fixture { color: var(--docs1-color-text); }\n')
  const style = options.breakScoped
    ? '<template><div class="fx">x</div></template>\n<style>\nbutton { color: var(--docs1-color-text); }\n</style>\n'
    : '<template><div class="fx">x</div></template>\n<style scoped>\n.fx { color: var(--docs1-color-text); }\n</style>\n'
  write(docs, '.vitepress/theme/components/Fixture.vue', style)
  write(docs, 'public/diagrams/fixture.html', '<!doctype html><html lang="zh-CN"><body><svg width="10" height="10"></svg></body></html>')
  return docs
}

const EXPERIENCE_TOKENS = `:root {
  --docs1-space-1: 4px;
  --docs1-space-2: 8px;
  --docs1-space-3: 12px;
  --docs1-space-4: 16px;
  --docs1-space-5: 24px;
  --docs1-font-xs: 12px;
  --docs1-font-sm: 13px;
  --docs1-font-md: 15px;
  --docs1-font-lg: 18px;
  --docs1-radius-sm: 4px;
  --docs1-radius-md: 8px;
  --docs1-radius-lg: 12px;
  --docs1-shadow-1: 0 1px 2px rgba(0, 0, 0, 0.06);
  --docs1-shadow-2: 0 4px 12px rgba(0, 0, 0, 0.10);
  --docs1-color-text: #1f2328;
  --docs1-color-muted: #57606a;
  --docs1-color-surface: #ffffff;
  --docs1-color-accent: #1a56db;
  --docs1-color-danger: #b42318;
  --docs1-color-warn: #b45309;
  --docs1-color-on-accent: #ffffff;
  --docs1-focus-ring: 2px solid #1a56db;
  --docs1-focus-offset: 2px;
  --docs1-state-hover: #f3f4f6;
  --docs1-state-active: #e5e7eb;
  --docs1-state-disabled: #9ca3af;
  --docs1-state-loading: #93c5fd;
  --docs1-state-selected: #1a56db;
}

html.dark {
  --docs1-shadow-1: 0 1px 2px rgba(0, 0, 0, 0.4);
  --docs1-shadow-2: 0 4px 12px rgba(0, 0, 0, 0.5);
  --docs1-color-text: #e6edf3;
  --docs1-color-muted: #9198a1;
  --docs1-color-surface: #0d1117;
  --docs1-color-accent: #2f81f7;
  --docs1-color-danger: #f87171;
  --docs1-color-warn: #fbbf24;
  --docs1-color-on-accent: #ffffff;
  --docs1-focus-ring: 2px solid #2f81f7;
  --docs1-state-hover: #161b22;
  --docs1-state-active: #21262d;
  --docs1-state-disabled: #6e7681;
  --docs1-state-loading: #1f6feb;
  --docs1-state-selected: #2f81f7;
}
`

const EXPERIENCE_CUSTOM = `.fx { color: var(--docs1-color-text); }
.fx:hover { background: var(--docs1-state-hover); }
.fx:active { background: var(--docs1-state-active); }
.fx:disabled { color: var(--docs1-state-disabled); }
.fx-loading { color: var(--docs1-state-loading); }
.fx-empty { color: var(--docs1-color-muted); }
.fx-error { color: var(--docs1-color-danger); }
.fx-degraded { color: var(--docs1-color-warn); }
.fx:focus-visible { outline: var(--docs1-focus-ring); outline-offset: var(--docs1-focus-offset); }
.fx-scroll { overflow-x: auto; }
@media (max-width: 640px) { .fx { padding: var(--docs1-space-1); } }
@media (max-width: 1024px) { .fx { padding: var(--docs1-space-2); } }
`

function buildExperienceFixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs1-exp-'))
  const docs = path.join(root, 'docs')
  write(docs, '.vitepress/theme/styles/tokens.css', EXPERIENCE_TOKENS)
  let custom = EXPERIENCE_CUSTOM
  if (options.breakFocusRing) custom = custom.replace('var(--docs1-focus-ring)', 'none')
  if (options.breakRawColor) custom += '.fx-bad { color: #ff0000; }\n'
  write(docs, '.vitepress/theme/styles/custom.css', custom)
  return docs
}

function runGate(script, root) {
  const result = spawnSync(
    process.execPath,
    [path.join(REPO_ROOT, 'scripts', script), '--root', root, '--json'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  )
  let payload = null
  try {
    payload = JSON.parse(result.stdout)
  } catch {
    payload = { ok: false, errors: [], parseError: result.stdout.slice(0, 200) + result.stderr.slice(0, 200) }
  }
  return { status: result.status, payload }
}

const CASES = [
  { id: 'G0', label: '正例：合规夹具应通过', options: {}, expectOk: true },
  { id: 'G1', label: 'V7：缺四段式小节', options: { breakSection: true }, expectCode: 'V7' },
  { id: 'G2', label: 'V8：组件页缺安装命令与引用方式', options: { breakComponent: true }, expectCode: 'V8' },
  { id: 'G3', label: 'V9：关联链接未命中', options: { breakLink: true }, expectCode: 'V9' },
  { id: 'G4', label: 'V10：图解产物缺失', options: { breakDiagram: true }, expectCode: 'V10' },
  { id: 'G5', label: 'V11：入口页手写条目清单', options: { handWrittenIndex: true }, expectCode: 'V11' },
  { id: 'G6', label: 'V13：结构化载荷不可解析', options: { breakPayload: true }, expectCode: 'V13' },
  { id: 'G7', label: 'V15：知识域缺 teach 块', options: { breakTeach: true }, expectCode: 'V15' },
  { id: 'G8', label: 'V16：缺教学要素', options: { breakElement: true }, expectCode: 'V16' },
  { id: 'G9', label: 'V19：缺官方依据与版本差异', options: { breakOfficialSources: true }, expectCode: 'V19' },
  { id: 'G10', label: 'V23：API 手册只有一个方法组', options: { breakApiGroups: true }, expectCode: 'V23' },
  { id: 'G11', label: 'C3：后端组件页出现前端实现词（.vue）', gate: 'component', options: { breakPurity: true }, expectCode: 'C3' },
  { id: 'G12', label: 'C6：组件 <style> 去掉 scoped 且用裸标签选择器', gate: 'component', options: { breakScoped: true }, expectCode: 'C6' },
  { id: 'G13', label: 'C2：有对端但缺「## 对应另一端」', gate: 'component', options: { omitCounterpart: true }, expectCode: 'C2' },
  { id: 'G14', label: 'X4：去掉 --docs1-focus-ring 引用', gate: 'experience', options: { breakFocusRing: true }, expectCode: 'X4' },
  { id: 'G15', label: 'X3：注入原始色值', gate: 'experience', options: { breakRawColor: true }, expectCode: 'X3' },
  { id: 'G16', label: '正例：组件页与体验夹具都应通过', gate: 'component', options: {}, expectOk: true },
  { id: 'G17', label: '正例：体验夹具应通过', gate: 'experience', options: {}, expectOk: true },
]

const BUILDERS = {
  content: buildFixture,
  component: buildComponentFixture,
  experience: buildExperienceFixture,
}

const GATES = {
  content: 'check-content.mjs',
  component: 'check-component.mjs',
  experience: 'check-experience.mjs',
}

function main() {
  const keep = process.argv.includes('--keep')
  const results = []
  for (const testCase of CASES) {
    const gate = testCase.gate ?? 'content'
    const root = BUILDERS[gate](testCase.options)
    const { status, payload } = gate === 'content' ? runChecker(root) : runGate(GATES[gate], root)
    const codes = (payload.errors ?? []).map((item) => item.code)
    const ok = testCase.expectOk
      ? status === 0 && payload.ok === true
      : status === 1 && codes.includes(testCase.expectCode)
    results.push({
      id: testCase.id,
      label: testCase.label,
      ok,
      status,
      codes: [...new Set(codes)],
      detail: ok ? '' : `退出码=${status} 命中规则=${[...new Set(codes)].join('、') || '无'}${payload.parseError ? ` 解析失败：${payload.parseError}` : ''}`,
    })
    if (!keep) fs.rmSync(root, { recursive: true, force: true })
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ok: results.every((item) => item.ok), results }, null, 2))
  } else {
    for (const item of results) {
      console.log(`${item.ok ? '✅' : '❌'} [${item.id}] ${item.label}${item.detail ? ` — ${item.detail}` : ''}`)
    }
    console.log(`门禁自测：${results.every((item) => item.ok) ? '全部符合预期' : '存在不符合项'}`)
  }
  process.exit(results.every((item) => item.ok) ? 0 : 1)
}

try {
  main()
} catch (error) {
  console.error('[selftest-gates] 脚本异常：', error)
  process.exit(2)
}
