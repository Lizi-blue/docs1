#!/usr/bin/env node
/**
 * assert-extensibility —— 零配置扩展的机械证明（FR-010 / SC-001 / 宪法 II）。
 *
 * 做法：在系统临时目录造一棵最小文档树（领域 + 知识域 + 知识点 + 子主题 + 组件），
 * 直接调用引擎的解析层，断言新领域与页面出现在模型里，URL 去掉数字前缀，
 * 并断言运行前后引擎代码与站点配置的指纹未变（新增领域不需要改任何配置）。
 *
 * 用法：node --experimental-strip-types scripts/assert-extensibility.mjs [--json]
 * 退出码：0 断言成立 / 1 有断言不成立 / 2 脚本异常。
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDocTree } from '../docs/.vitepress/plugins/doc-engine.ts'
import { normalizeLink } from '../docs/.vitepress/shared/links.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATHS = ['package.json', 'docs/.vitepress/config.mts', 'docs/.vitepress/plugins/doc-engine.ts', 'schemas/dir-meta.schema.json']

const results = []

function assert(id, ok, message, detail) {
  results.push({ id, ok, message, detail })
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function fingerprint() {
  const map = {}
  for (const relative of CONFIG_PATHS) {
    const file = path.join(REPO_ROOT, relative)
    map[relative] = fs.existsSync(file)
      ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16)
      : 'missing'
  }
  return map
}

function buildFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs1-ext-'))
  write(path.join(root, '_meta.yml'), 'name: "根"\n')
  write(path.join(root, 'index.md'), '---\ntitle: 首页\nlayout: home\n---\n')

  // 领域：名称、图标、顺序全部来自目录级元数据
  write(path.join(root, '03-临时领域', '_meta.yml'), 'name: "临时领域"\nicon: "🧪"\norder: 3\ndescription: "夹具领域"\nentry_type: domain\n')
  write(path.join(root, '03-临时领域', 'index.md'), '---\ntitle: 临时领域\ntype: landing\ndomain: 临时领域\nentry: domain\n---\n\n<EntryIndex kind="domain" />\n')
  write(path.join(root, '03-临时领域', 'learn', '_meta.yml'), 'name: "渐进式学习"\n')
  write(path.join(root, '03-临时领域', 'learn', 'index.md'), '---\ntitle: 学习\ntype: landing\ndomain: 临时领域\nentry: learn\n---\n\n<EntryIndex kind="learn" />\n')
  write(path.join(root, '03-临时领域', 'components', '_meta.yml'), 'name: "组件查询"\n')
  write(path.join(root, '03-临时领域', 'components', 'index.md'), '---\ntitle: 组件\ntype: landing\ndomain: 临时领域\nentry: components\n---\n\n<EntryIndex kind="components" />\n')

  // 知识域：路径写在 teach.path
  write(path.join(root, '03-临时领域', 'learn', '01-基础', '_meta.yml'), `name: "基础"
order: 1
icon: "📘"
description: "夹具知识域"
teach:
  audience: "夹具读者，用于验证零配置扩展"
  prerequisites:
    - "无"
  outcomes:
    - "验证新领域会自动出现在模型里"
  path:
    - from: "01-第一讲"
      to: "01-第一讲"
      label: "夹具路径"
  lessons:
    - slug: "01-第一讲"
      goal: "验证知识点被登记并进入模型"
`)
  write(path.join(root, '03-临时领域', 'learn', '01-基础', '01-第一讲.md'), `---
title: "第一讲"
type: knowledge
domain: 临时领域
knowledge_domain: 基础
order: 1
level: basic
tags: [fixture]
description: "夹具知识点"
---

### 本讲要解决的问题\n夹具用。\n\n## TL;DR\n> 夹具。\n`)
  // 子主题：目录四层
  write(path.join(root, '03-临时领域', 'learn', '01-基础', '02-子主题', '_meta.yml'), 'name: "子主题"\nicon: "📎"\norder: 2\n')
  write(path.join(root, '03-临时领域', 'learn', '01-基础', '02-子主题', '01-深入.md'), `---
title: "深入"
type: knowledge
domain: 临时领域
knowledge_domain: 基础
order: 1
level: advanced
description: "夹具子主题页"
---

### 本讲要解决的问题\n夹具用。\n`)
  // 组件
  write(path.join(root, '03-临时领域', 'components', '夹具组件.md'), `---
title: "夹具组件"
type: component
domain: 临时领域
component_type: library
install_command: "pip install fixture"
depends_on_knowledge:
  - /03-临时领域/learn/01-基础/01-第一讲
tags_index: [fixture]
reusability: high
description: "夹具组件"
---

## 组件简介\n夹具。\n`)
  return root
}

function main() {
  const before = fingerprint()
  const root = buildFixture()
  const tree = buildDocTree(root)

  const domain = tree.domains.find((item) => item.slug === '临时领域')
  assert('E1', Boolean(domain), '新领域出现在模型中', domain ? `name=${domain.name} icon=${domain.icon} order=${domain.order}` : '未找到')
  assert('E2', domain?.name === '临时领域' && domain?.icon === '🧪', '领域名称与图标来自目录级元数据')

  const kd = domain?.learn?.[0]
  const page = kd?.pages?.[0]
  assert('E3', page?.url === '/临时领域/learn/基础/第一讲', 'URL 逐段去掉数字前缀', page?.url)
  assert('E4', Array.isArray(kd?.path) && kd.path[0]?.label === '夹具路径', '学习路径从 teach.path 读出', JSON.stringify(kd?.path))

  const subtopic = kd?.subtopics?.[0]
  assert('E5', subtopic?.pages?.[0]?.url === '/临时领域/learn/基础/子主题/深入', '子主题（目录四层）页面进入模型', subtopic?.pages?.[0]?.url)

  const component = domain?.components?.[0]
  assert('E6', component?.url === '/临时领域/components/夹具组件', '组件页进入模型', component?.url)

  // 容错发生在查询时：作者写带前缀或带 .md 的链接，归一化后命中
  const tolerant = tree.linkMap[normalizeLink('/03-临时领域/learn/01-基础/01-第一讲.md')]
  assert('E7', tolerant === '/临时领域/learn/基础/第一讲', '链接容忍带数字前缀与 .md 的写法', tolerant)
  assert('E8', (tree.warnings ?? []).length === 0, '夹具无告警', JSON.stringify(tree.warnings))

  const after = fingerprint()
  const changed = Object.keys(after).filter((key) => after[key] !== before[key])
  assert('E9', changed.length === 0, '新增领域不改引擎与配置', changed.length ? `变化：${changed.join('、')}` : '引擎与配置指纹未变')

  const repaired = tree.domains.filter((item) => item.entry?.learn && item.entry?.components).length
  assert('E10', repaired === tree.domains.length, '每个领域都有两个入口', `${repaired}/${tree.domains.length}`)

  fs.rmSync(root, { recursive: true, force: true })

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ ok: results.every((item) => item.ok), results }, null, 2))
  } else {
    for (const item of results) {
      console.log(`${item.ok ? '✅' : '❌'} [${item.id}] ${item.message}${item.detail ? ` — ${item.detail}` : ''}`)
    }
    console.log(`零配置扩展断言：${results.every((item) => item.ok) ? '通过' : '不通过'}`)
  }
  process.exit(results.every((item) => item.ok) ? 0 : 1)
}

try {
  main()
} catch (error) {
  console.error('[assert-extensibility] 脚本异常：', error)
  process.exit(2)
}
