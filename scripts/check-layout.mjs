#!/usr/bin/env node
/**
 * 布局门禁（006 T006）：L1–L6。
 *
 *   node scripts/check-layout.mjs [--json]
 *
 * L1 经典样式冻结未被破坏（与 scripts/data/classic-css.sha256 一致）
 * L2 断点标准（640 / 768 / 1024 / 1280）
 * L3 顶栏高度上限 ≤ 80px；禁止 100vh（用 100dvh）
 * L4 优化层规则全部限定在 html.layout-taste 之下
 * L5 档位切换机制齐备（构建期变量、根类名、localStorage 键、控件组件、脚本别名）
 * L6 禁止 flex 百分比栅格写法
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const STYLE_DIR = 'docs/.vitepress/theme/styles'
const TASTE = `${STYLE_DIR}/taste.css`
const CLASSIC = `${STYLE_DIR}/classic.css`
const HASH_FILE = 'scripts/data/classic-css.sha256'
const BREAKPOINTS = [640, 768, 1024, 1280]
const NAV_HEIGHT_MAX = 80

const errors = []

function fail(code, file, message, fix) {
  errors.push({ code, file, message, fix })
}

function read(rel) {
  const abs = path.join(REPO_ROOT, rel)
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function ruleL1() {
  const classic = read(CLASSIC)
  if (classic === null) return fail('L1', CLASSIC, '经典样式文件缺失', '从基线恢复：node scripts/restore-layout.mjs')
  const recorded = read(HASH_FILE)
  if (recorded === null) return fail('L1', HASH_FILE, '缺少冻结指纹文件', '生成指纹并提交：sha256sum 写入该文件')
  const expected = recorded.trim().split(/\s+/)[0]
  const actual = sha256(classic)
  if (expected !== actual) {
    fail('L1', CLASSIC, `经典样式被改动（指纹 ${actual.slice(0, 12)} ≠ 记录 ${expected.slice(0, 12)}）`, '撤销改动，或更新指纹文件并在提交信息说明理由')
  }
}

function ruleL2() {
  const taste = read(TASTE)
  if (taste === null) return fail('L2', TASTE, '优化层文件缺失', '新建 docs/.vitepress/theme/styles/taste.css')
  const missing = BREAKPOINTS.filter((px) => !new RegExp(`max-width:\\s*${px}px|min-width:\\s*${px}px`).test(taste))
  if (missing.length) {
    fail('L2', TASTE, `断点缺失：${missing.join(' / ')}px`, '按标准断点补齐 640 / 768 / 1024 / 1280')
  }
}

function ruleL3() {
  const files = [TASTE, CLASSIC, `${STYLE_DIR}/tokens.css`]
  for (const rel of files) {
    const text = read(rel)
    if (text === null) continue
    const vh = text.match(/(?<!d)100vh/g)
    if (vh) fail('L3', rel, `出现 ${vh.length} 处 100vh`, '改用 100dvh，避免移动端地址栏导致的跳动')
  }
  const taste = read(TASTE) ?? ''
  const nav = /--docs1-nav-height:\s*(\d+)px/.exec(taste)
  if (!nav) {
    fail('L3', TASTE, '未声明顶栏高度上限变量 --docs1-nav-height', `在 html.layout-taste 下声明 --docs1-nav-height（≤ ${NAV_HEIGHT_MAX}px）`)
  } else if (Number(nav[1]) > NAV_HEIGHT_MAX) {
    fail('L3', TASTE, `顶栏高度 ${nav[1]}px 超过上限 ${NAV_HEIGHT_MAX}px`, '压到 64px 左右并保证单行')
  }
}

function ruleL4() {
  const taste = read(TASTE)
  if (taste === null) return
  const stripped = taste
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@media[^{]*\{/g, '')
    .replace(/@keyframes[^{]*\{/g, '')
  const selectors = stripped
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('{') && !line.startsWith('@') && !line.startsWith('html.layout-taste'))
  const offenders = selectors.filter((line) => !line.includes('html.layout-taste'))
  if (offenders.length) {
    fail('L4', TASTE, `有 ${offenders.length} 条规则未限定在 html.layout-taste 之下（首条：${offenders[0]}）`, '在优化层里给每条规则加上 html.layout-taste 前缀')
  }
}

function ruleL5() {
  const config = read('docs/.vitepress/config.mts') ?? ''
  if (!/DOCS1_LAYOUT/.test(config)) fail('L5', 'docs/.vitepress/config.mts', '未读取构建期档位变量', '读 DOCS1_LAYOUT 并校验取值')
  if (!/layout-\$\{layout\}|layout-taste/.test(config)) fail('L5', 'docs/.vitepress/config.mts', '未注入根类名', '用 transformHtml 或 head 脚本写入 layout-taste / layout-classic')
  const switcher = read('docs/.vitepress/theme/components/LayoutSwitch.vue')
  if (switcher === null) fail('L5', 'docs/.vitepress/theme/components/LayoutSwitch.vue', '缺少切换控件', '新建控件并挂载到 Layout.vue')
  else if (!/localStorage/.test(switcher)) fail('L5', 'docs/.vitepress/theme/components/LayoutSwitch.vue', '切换未持久化', '把选择写入 localStorage')
  const layoutVue = read('docs/.vitepress/theme/Layout.vue') ?? ''
  if (!/LayoutSwitch/.test(layoutVue)) fail('L5', 'docs/.vitepress/theme/Layout.vue', '切换控件未挂载', '在顶栏插槽挂载 LayoutSwitch')
  const pkg = JSON.parse(read('package.json') ?? '{}')
  if (!pkg.scripts?.['check:layout']) fail('L5', 'package.json', '缺少 check:layout 脚本别名', '添加 node scripts/check-layout.mjs')
}

function ruleL6() {
  for (const rel of [TASTE, CLASSIC]) {
    const text = read(rel)
    if (text === null) continue
    const hits = text.match(/width:\s*calc\([^)]*%/g)
    if (hits) fail('L6', rel, `出现 ${hits.length} 处 flex 百分比栅格写法`, '改用 CSS Grid：repeat(auto-fit, minmax(…, 1fr))')
  }
}

function main() {
  const asJson = process.argv.includes('--json')
  ruleL1()
  ruleL2()
  ruleL3()
  ruleL4()
  ruleL5()
  ruleL6()

  if (asJson) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors }, null, 2))
  } else {
    for (const item of errors) {
      console.log(`❌ [${item.code}] ${item.file} ${item.message} → 修法：${item.fix}`)
    }
    console.log(`布局门禁：错误 ${errors.length} 项`)
  }
  process.exit(errors.length === 0 ? 0 : 1)
}

main()
