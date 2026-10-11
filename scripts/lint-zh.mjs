#!/usr/bin/env node
/**
 * lint-zh —— 受控中文门禁的仓内入口。
 *
 * 为什么要这层封装：`<ApiTable :items='…' />` 与 `<CodeTabs :tabs='…' />` 把代码放在
 * HTML 属性里。上游脚本只认围栏代码块，于是把载荷里的分号与长行当成散文违规。
 * 本脚本把载荷当代码剔除后再交给上游脚本，行号不变，路径映射回仓库相对路径。
 *
 * 用法：node scripts/lint-zh.mjs [--baseline N] [--json] [--check-only]
 * 退出码沿用上游：0 通过 / 1 硬违规超过基线。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LINT = path.join(REPO_ROOT, 'scripts', 'ste-lint-zh.py')
const BASELINE_FILE = path.join(REPO_ROOT, 'scripts', 'ste-lint-zh.baseline')
const SCAN_ROOTS = ['docs', path.join('.dsh', 'skills', 'docs-authoring')]

function listMarkdown(root) {
  const absolute = path.join(REPO_ROOT, root)
  if (!fs.existsSync(absolute)) return []
  const found = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', 'public', '.vitepress'].includes(entry.name)) continue
        walk(path.join(dir, entry.name))
      } else if (entry.name.endsWith('.md')) {
        found.push(path.relative(REPO_ROOT, path.join(dir, entry.name)).replace(/\\/g, '/'))
      }
    }
  }
  walk(absolute)
  return found.sort()
}

/**
 * 三类等长遮蔽，均为「代码与标记不算散文」的落地方式：
 *   1. 结构化载荷（ApiTable / CodeTabs 的属性值）→ 代码
 *   2. TL;DR → 必需小节标题里的缩写，其中分号不是分句符
 *   3. HTML 实体结尾分号（&quot; &#39; &amp;）→ 标记语法，不是分句符
 */
/** 契约强制的标题文本不是作者的用词选择，遮蔽后再判定同义词轮换 */
const MANDATED_HEADINGS = [
  'TL;DR', '概念定义', '原理图解', '关键对比', '场景描述', '完整代码', '运行方式',
  '面试追问链', '关联组件', '数据流图解', '分步实现', '对比表格', '组合了哪些知识？',
  '组件简介', '涉及的知识点', '组合方式图解', '核心源码', '设计说明', '使用文档',
  '其他项目如何引用', '与其他组件的关系', '本讲要解决的问题', '常见误区', '下一讲衔接',
]

function maskHeadings(content) {
  return content
    .split('\n')
    .map((line) => {
      const matched = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
      if (!matched) return line
      const body = matched[2]
      const isMandated = MANDATED_HEADINGS.some((title) => body === title || body.startsWith(`${title}：`))
      if (!isMandated) return line
      return `${matched[1]} ${' '.repeat([...body].length)}`
    })
    .join('\n')
}

function stripPayloads(content) {
  return maskHeadings(content)
    .replace(/(<ApiTable\s+:items=)('[^']*'|"[^"]*")/g, (matched, head) => `${head}'…'`)
    .replace(/(<CodeTabs\s+:tabs=)('[^']*'|"[^"]*")/g, (matched, head) => `${head}'…'`)
    .replace(/TL;DR/g, 'TL_DR')
    .replace(/&([a-zA-Z]+|#\d+);/g, (matched) => `${matched.slice(0, -1)} `)
}

function main() {
  const args = process.argv.slice(2)
  const baselineIndex = args.indexOf('--baseline')
  const baseline = baselineIndex >= 0
    ? args[baselineIndex + 1]
    : (fs.existsSync(BASELINE_FILE) ? fs.readFileSync(BASELINE_FILE, 'utf8').trim() : '0')

  const files = SCAN_ROOTS.flatMap((root) => listMarkdown(root))
  if (files.length === 0) {
    console.log('没有找到待检查的 Markdown 文件')
    process.exit(2)
  }

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-zh-'))
  const mapping = new Map()
  for (const file of files) {
    const target = path.join(staging, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const stripped = stripPayloads(fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'))
    fs.writeFileSync(target, stripped)
    mapping.set(target, file)
  }

  const passthrough = args.filter((_, index) => index !== baselineIndex && index !== baselineIndex + 1)
  const staged = [...mapping.keys()]
  const result = spawnSync('python3', [LINT, ...staged, '--baseline', baseline, ...passthrough], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })

  let output = (result.stdout ?? '') + (result.stderr ?? '')
  for (const [target, file] of mapping) output = output.split(target).join(file)
  output = output.split(staging).join('')
  process.stdout.write(output)
  fs.rmSync(staging, { recursive: true, force: true })
  process.exit(result.status ?? 2)
}

main()
