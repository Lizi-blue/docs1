#!/usr/bin/env node
/**
 * 一条命令把布局相关文件恢复到基线快照（006 FR-002）。
 *
 *   node scripts/restore-layout.mjs --list            只列清单
 *   node scripts/restore-layout.mjs --dry-run         预演：打印将恢复的文件与差异摘要，不改工作区
 *   node scripts/restore-layout.mjs                   实做：从基线标签检出这些文件
 *   node scripts/restore-layout.mjs --tag <标签>      指定其它基线标签（默认 layout-baseline-pre-taste）
 *
 * 只恢复「样式与布局」文件；内容、URL、引擎与门禁不在范围内（FR-005）。
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_TAG = 'layout-baseline-pre-taste'

/** 布局面清单：配置、主题（布局、样式、组件、取数）。 */
const LAYOUT_PATHS = [
  'docs/.vitepress/config.mts',
  'docs/.vitepress/theme/Layout.vue',
  'docs/.vitepress/theme/index.ts',
  'docs/.vitepress/theme/styles',
  'docs/.vitepress/theme/components',
  'docs/.vitepress/theme/lib',
]

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trimEnd()
  } catch (error) {
    if (allowFail) return null
    throw error
  }
}

function parseArgs(argv) {
  const tagIndex = argv.indexOf('--tag')
  return {
    list: argv.includes('--list'),
    dryRun: argv.includes('--dry-run'),
    tag: tagIndex >= 0 ? argv[tagIndex + 1] : DEFAULT_TAG,
  }
}

/** 接受标签或提交：都能解析为一次提交即视为合法基线。 */
function resolveBaseline(rev) {
  const commit = git(['rev-parse', '--verify', `${rev}^{commit}`], { allowFail: true })
  if (!commit) {
    console.error(`[restore-layout] 找不到基线 ${rev}。先拉取标签：git fetch --tags`)
    process.exit(2)
  }
  return commit
}

function main() {
  const { list, dryRun, tag } = parseArgs(process.argv.slice(2))

  if (list) {
    console.log(`[restore-layout] 基线标签：${tag}`)
    for (const item of LAYOUT_PATHS) console.log(`  ${item}`)
    console.log(`[restore-layout] 共 ${LAYOUT_PATHS.length} 项（内容与 URL 不在范围内）`)
    return
  }

  const commit = resolveBaseline(tag)
  const changed = git(['diff', '--name-only', `${tag}`, '--', ...LAYOUT_PATHS]) ?? ''
  const files = changed ? changed.split('\n').filter(Boolean) : []

  console.log(`[restore-layout] 基线 ${tag}（${commit.slice(0, 7)}）`)
  console.log(`[restore-layout] 与当前工作区有差异的布局文件：${files.length} 个`)
  for (const file of files.slice(0, 30)) console.log(`  M ${file}`)
  if (files.length > 30) console.log(`  … 其余 ${files.length - 30} 个`)

  if (dryRun) {
    console.log('[restore-layout] 预演结束：未修改任何文件。去掉 --dry-run 即可实做。')
    return
  }

  git(['checkout', tag, '--', ...LAYOUT_PATHS])
  console.log('[restore-layout] 已恢复。接着跑：npm run check:content && npm run check:experience && npm run build')
}

main()
