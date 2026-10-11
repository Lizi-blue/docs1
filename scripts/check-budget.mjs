#!/usr/bin/env node
/**
 * check-budget.mjs —— 千页规模性能预算检查（FR-040 / SC-009 / SC-013 / 宪法 VII）。
 *
 * 做法：
 *   1. 把 `docs/` 复制到系统临时目录（排除 dist/cache 与未跟踪的并行夹具）；
 *   2. 在临时树里合成 N 页（默认 1000）知识点页，按 D 个领域均分（默认 10，对齐「10+ 领域」目标）；
 *   3. 计时 `buildDocTree`（解析时长）并量出 `virtual:doc-tree` 载荷体积；
 *   4. 在临时树里跑一次 `vitepress build`（构建时长），再量静态资源体积；
 *   5. 与 `contracts/engine-contract.md` §9 的预算比对，超出判错项则退出码 1。
 *
 * 口径：`站点静态资源总量` 只算 js/css/字体/图片/图解等**非 HTML 资源**（§9 语境是资源体积），
 * HTML 文档量随页面数线性增长，单列在「补充指标」里报告，不参与判错。
 *
 * 用法：
 *   node scripts/check-budget.mjs [--pages 1000] [--domains 10] [--keep] [--json] [--skip-build] [--workdir <dir>]
 *
 * 退出码：0 通过 / 1 超预算 / 2 脚本异常。
 *
 * 临时目录默认位于系统 temp，跑完即删；--keep 保留以便排查。
 * 合成页与临时目录 MUST NOT 提交（本脚本不写入 `docs/`）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_ROOT = path.join(REPO_ROOT, 'docs')
const VITEPRESS_BIN = path.join(REPO_ROOT, 'node_modules', 'vitepress', 'bin', 'vitepress.js')

/** 预算取自 contracts/engine-contract.md §9；level=fail 判错，level=warn 只提示。 */
const BUDGETS = [
  { key: 'parseSeconds', label: '解析时长（合成页）', limit: 60, unit: 's', level: 'fail' },
  { key: 'buildSeconds', label: '构建时长（合成页）', limit: 180, unit: 's', level: 'fail' },
  { key: 'navPayloadBytes', label: '导航数据体积（virtual:doc-tree）', limit: 5 * 1024 * 1024, unit: 'B', level: 'fail' },
  { key: 'siteAssetsBytes', label: '站点静态资源总量（非 HTML）', limit: 20 * 1024 * 1024, unit: 'B', level: 'fail' },
  { key: 'maxDiagramBytes', label: '单张图解 HTML', limit: 1.5 * 1024 * 1024, unit: 'B', level: 'warn' },
]

const EXCLUDE_DIRS = new Set(['dist', 'cache', 'node_modules', '.git'])

function parseArgs(argv) {
  const options = { pages: 1000, domains: 10, keep: false, json: false, skipBuild: false, workdir: null }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--pages') options.pages = Number(argv[++index])
    else if (arg === '--domains') options.domains = Number(argv[++index])
    else if (arg === '--workdir') options.workdir = argv[++index]
    else if (arg === '--keep') options.keep = true
    else if (arg === '--json') options.json = true
    else if (arg === '--skip-build') options.skipBuild = true
    else if (arg === '--help' || arg === '-h') {
      console.log('用法：node scripts/check-budget.mjs [--pages 1000] [--domains 10] [--keep] [--json] [--skip-build] [--workdir <dir>]')
      process.exit(0)
    } else {
      console.error(`未知参数：${arg}`)
      process.exit(2)
    }
  }
  if (!Number.isInteger(options.pages) || options.pages < 1) {
    console.error('--pages 必须是正整数')
    process.exit(2)
  }
  if (!Number.isInteger(options.domains) || options.domains < 1) {
    console.error('--domains 必须是正整数')
    process.exit(2)
  }
  return options
}

/** 只纳入 git 跟踪的顶层内容目录，隔离未提交的并行夹具（如 zzfix）。 */
function trackedTopLevel() {
  try {
    const out = execFileSync('git', ['-C', REPO_ROOT, 'ls-files', '-z', '--', 'docs'], { encoding: 'utf8' })
    const roots = new Set()
    for (const file of out.split('\0')) {
      if (!file) continue
      const rel = file.replace(/^docs\//, '')
      const top = rel.includes('/') ? rel.split('/')[0] : rel
      roots.add(top)
    }
    return roots
  } catch {
    return null
  }
}

function copyDirs(from, to, roots) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue
    if (roots && !roots.has(entry.name)) continue
    const src = path.join(from, entry.name)
    const dest = path.join(to, entry.name)
    if (entry.isDirectory()) copyDirs(src, dest, null)
    else if (entry.isFile()) fs.copyFileSync(src, dest)
  }
}

const MIN_BODY = `## 原理图解

合成页只用于预算测量。

## 关键对比

| 项 | 值 |
|---|---|
| 合成 | 是 |
`

/** 合成 pages 页：按 domains 个领域均分，每个领域一个知识域（对齐「10+ 领域」）。 */
function synthesizePages(docsDir, pages, domains) {
  const perDomain = Math.ceil(pages / domains)
  let written = 0
  for (let domainIndex = 1; domainIndex <= domains && written < pages; domainIndex += 1) {
    const domainSlug = `synth-${String(domainIndex).padStart(2, '0')}`
    const domainDir = path.join(docsDir, domainSlug)
    const kdDir = path.join(domainDir, 'learn', 'bulk')
    fs.mkdirSync(kdDir, { recursive: true })
    fs.writeFileSync(path.join(domainDir, '_meta.yml'), `name: 预算合成领域 ${domainIndex}\nicon: 🧪\norder: ${900 + domainIndex}\n`)
    fs.writeFileSync(path.join(domainDir, 'index.md'), `---\ntitle: 预算合成领域 ${domainIndex}\n---\n\n# 预算合成领域 ${domainIndex}\n`)
    fs.writeFileSync(path.join(kdDir, '_meta.yml'), `name: 合成知识域 ${domainIndex}\nicon: ⚡\norder: 1\n`)
    for (let index = 1; index <= perDomain && written < pages; index += 1) {
      const id = String(written + 1).padStart(4, '0')
      const front = [
        '---',
        `title: 合成知识点 ${id}`,
        'type: knowledge',
        `domain: ${domainSlug}`,
        'knowledge_domain: bulk',
        `order: ${index}`,
        'level: basic',
        'description: 预算夹具合成页',
        'tags: [budget-synth]',
        '---',
        '',
        `# 合成知识点 ${id}`,
        '',
      ].join('\n')
      fs.writeFileSync(path.join(kdDir, `${String(index).padStart(3, '0')}-page-${id}.md`), front + MIN_BODY)
      written += 1
    }
  }
  return written
}

/** 列出 dist 下所有文件（相对路径 + 字节数） */
function listFiles(dir, prefix = '') {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    const target = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(target, rel))
    else if (entry.isFile()) out.push({ rel, size: fs.statSync(target).size })
  }
  return out
}

function megabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function printTable(rows, options) {
  if (options.json) {
    console.log(JSON.stringify({ pages: options.pages, metrics: rows }, null, 2))
    return
  }
  console.log('')
  console.log(`指标                                 实测         预算         结论`)
  for (const row of rows) {
    const measured = row.unit === 'B' ? megabytes(row.value) : `${row.value.toFixed(2)} s`
    const limit = row.unit === 'B' ? megabytes(row.limit) : `${row.limit} s`
    const verdict = row.value <= row.limit ? 'PASS' : row.level === 'fail' ? 'FAIL' : 'WARN'
    console.log(`${row.label.padEnd(34)} ${measured.padStart(11)}  ${limit.padStart(11)}  ${verdict}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!fs.existsSync(DOCS_ROOT)) {
    console.error(`缺少内容目录：${DOCS_ROOT}`)
    process.exit(2)
  }

  const tempRoot = options.workdir
    ? path.resolve(options.workdir)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'docs1-budget-'))
  const docsDir = path.join(tempRoot, 'docs')
  let failed = false

  try {
    fs.rmSync(docsDir, { recursive: true, force: true })
    const roots = trackedTopLevel()
    copyDirs(DOCS_ROOT, docsDir, roots)
    if (!roots) console.log('[warn] git 不可用，已复制全部顶层目录（含未跟踪夹具）')
    fs.writeFileSync(path.join(tempRoot, 'package.json'), '{"name":"docs1-budget","private":true,"type":"module"}\n')
    const link = path.join(tempRoot, 'node_modules')
    if (!fs.existsSync(link) && fs.existsSync(path.join(REPO_ROOT, 'node_modules'))) {
      fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), link, 'dir')
    }

    const synthesized = synthesizePages(docsDir, options.pages, options.domains)
    console.log(`临时目录：${tempRoot}`)
    console.log(`合成页：${synthesized}（${options.domains} 个领域）`)

    const { buildDocTree } = await import(path.join(DOCS_ROOT, '.vitepress', 'plugins', 'doc-engine.ts'))
    const parseStart = process.hrtime.bigint()
    const tree = buildDocTree(docsDir)
    const parseSeconds = Number(process.hrtime.bigint() - parseStart) / 1e9
    const navPayloadBytes = Buffer.byteLength(JSON.stringify(tree))
    console.log(`页面模型：${tree.pages.length} 页 / ${tree.domains.length} 个顶层分组；解析 ${parseSeconds.toFixed(2)} s`)

    let buildSeconds = 0
    if (!options.skipBuild) {
      if (!fs.existsSync(VITEPRESS_BIN)) {
        console.error(`缺少 vitepress：${VITEPRESS_BIN}`)
        process.exit(2)
      }
      const buildStart = process.hrtime.bigint()
      const result = spawnSync(process.execPath, [VITEPRESS_BIN, 'build', 'docs'], {
        cwd: tempRoot,
        env: { ...process.env, NODE_ENV: 'production' },
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      })
      buildSeconds = Number(process.hrtime.bigint() - buildStart) / 1e9
      if (result.status !== 0) {
        console.error(result.stdout ?? '')
        console.error(result.stderr ?? '')
        console.error(`构建失败（退出码 ${result.status}）`)
        process.exit(2)
      }
    }

    const distDir = path.join(docsDir, '.vitepress', 'dist')
    const files = listFiles(distDir)
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    // 图解产物是自包含 HTML 资源，归入静态资源（§9「含图解」）；其余 .html 才是页面文档。
    const diagramFiles = files.filter((file) => file.rel.startsWith('diagrams/'))
    const pageHtmlFiles = files.filter((file) => file.rel.endsWith('.html') && !file.rel.startsWith('diagrams/'))
    const pageHtmlTotalBytes = pageHtmlFiles.reduce((sum, file) => sum + file.size, 0)
    const siteAssetsBytes = totalBytes - pageHtmlTotalBytes
    const avgPageHtmlBytes = pageHtmlFiles.length ? Math.round(pageHtmlTotalBytes / pageHtmlFiles.length) : 0
    const maxDiagramBytes = diagramFiles.reduce((max, file) => Math.max(max, file.size), 0)

    const values = { parseSeconds, buildSeconds, navPayloadBytes, siteAssetsBytes, maxDiagramBytes }
    const rows = BUDGETS.map((budget) => ({ ...budget, value: values[budget.key] }))
    printTable(rows, options)

    const info = {
      totalPages: tree.pages.length,
      distTotalBytes: totalBytes,
      pageHtmlTotalBytes,
      avgPageHtmlBytes,
      htmlFiles: pageHtmlFiles.length,
      diagramFiles: diagramFiles.length,
    }
    if (options.json) {
      console.log(JSON.stringify({ pages: options.pages, synthesized, info }, null, 2))
    } else {
      console.log('')
      console.log('补充指标（不参与判错）：')
      console.log(`  dist 总量              ${megabytes(totalBytes)}（${files.length} 个文件）`)
      console.log(`  HTML 页面文档总量       ${megabytes(pageHtmlTotalBytes)}（${pageHtmlFiles.length} 页，均值 ${(avgPageHtmlBytes / 1024).toFixed(1)} KB）`)
      console.log(`  图解产物                ${diagramFiles.length} 张，合计 ${megabytes(diagramFiles.reduce((sum, file) => sum + file.size, 0))}`)
      console.log(`  导航载荷人均            ${(navPayloadBytes / Math.max(tree.pages.length, 1) / 1024).toFixed(1)} KB/页`)
    }

    const over = rows.filter((row) => row.value > row.limit)
    for (const row of over) {
      const measured = row.unit === 'B' ? megabytes(row.value) : `${row.value.toFixed(2)} s`
      const limit = row.unit === 'B' ? megabytes(row.limit) : `${row.limit} s`
      console.log(`超预算：${row.label} 实测 ${measured} > 上限 ${limit}（${row.level}）`)
    }
    failed = over.some((row) => row.level === 'fail')
    if (!failed) console.log(`预算检查通过（${tree.pages.length} 页）`)
  } finally {
    if (!options.keep && !options.workdir) fs.rmSync(tempRoot, { recursive: true, force: true })
    else console.log(`保留临时目录：${tempRoot}`)
  }

  process.exit(failed ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
