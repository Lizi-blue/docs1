#!/usr/bin/env node
/**
 * 主题覆盖门禁：防止「整类主题被漏掉」。
 *
 * 背景：讲次清单容易按模块与 API 组织，结果漏掉主题级内容。例如线程间通信、
 * await 的挂起与恢复顺序。本门禁按 scripts/data/topic-coverage.json 的主题表，
 * 要求每个主题都能在所属知识域里找到覆盖页与关键词。
 *
 * 退出码：0 全通过 / 1 有主题未被覆盖 / 2 脚本异常。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DOCS = path.join(ROOT, 'docs')
const MATRIX = path.join(ROOT, 'scripts/data/topic-coverage.json')

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

if (!fs.existsSync(MATRIX)) fail(`缺少覆盖矩阵：${path.relative(ROOT, MATRIX)}`)
const matrix = JSON.parse(fs.readFileSync(MATRIX, 'utf8'))

let missing = 0
let checked = 0
for (const [domainPath, spec] of Object.entries(matrix.domains ?? {})) {
  const dir = path.join(DOCS, domainPath)
  if (!fs.existsSync(dir)) {
    fail(`覆盖矩阵登记的知识域不存在：docs/${domainPath}`)
  }
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'index.md')
    .map((name) => ({ name, text: fs.readFileSync(path.join(dir, name), 'utf8') }))
  if (files.length === 0) fail(`知识域没有正文页：docs/${domainPath}`)

  for (const topic of spec.topics ?? []) {
    checked += 1
    const hits = files.filter((file) => topic.must.every((word) => file.text.includes(word)))
    if (hits.length === 0) {
      missing += 1
      console.error(`❌ [覆盖] ${spec.name} 缺主题「${topic.name}」→ 要求同时出现：${topic.must.join(' + ')}`)
      if (topic.hint) console.error(`   修法：${topic.hint}`)
    }
  }
}

if (missing > 0) {
  console.error(`\n主题覆盖门禁：${missing}/${checked} 个主题未覆盖。请补写内容，或更新 scripts/data/topic-coverage.json。`)
  process.exit(1)
}
console.log(`✅ 主题覆盖门禁通过（${Object.keys(matrix.domains).length} 个知识域，${checked} 个主题）。`)
