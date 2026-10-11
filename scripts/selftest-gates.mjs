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

## API 手册：fixture

<ApiTable :items='[{"name": "fixture.call", "rank": "必会", "params": [{"name": "a", "type": "int", "default": "1", "desc": "夹具"}], "returns": "无", "effect": "夹具", "scenario": "夹具", "example": "fixture.call(1)"}]' />

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
]

function main() {
  const keep = process.argv.includes('--keep')
  const results = []
  for (const testCase of CASES) {
    const root = buildFixture(testCase.options)
    const { status, payload } = runChecker(root)
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
