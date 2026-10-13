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
 * L7 宽内容外扩（代码、表格、图框）且窄屏归零
 * L8 组件页单栏：display: block、引用栏不吸顶且卡片化
 * L9 入口主卡与知识域卡分级
 * L10 右栏目录不得为空（页面数据 headers 判空）
 * L11 宽内容外扩必须与右栏复位成对出现
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

function ruleL7() {
  const taste = read(TASTE) ?? ''
  if (!/--docs1-bleed:\s*\d/.test(taste)) {
    fail('L7', TASTE, '未声明宽内容外扩令牌 --docs1-bleed', '声明外扩量，并让代码块、表格与图框使用它')
  }
  if (!/margin-inline:\s*calc\(-1 \* var\(--docs1-bleed\)/.test(taste)) {
    fail('L7', TASTE, '宽内容没有使用外扩令牌', '给代码块、表格、图框加 margin-inline: calc(-1 * var(--docs1-bleed) / 2)')
  }
  if (!/--docs1-bleed:\s*0rem/.test(taste)) {
    fail('L7', TASTE, '窄屏没有关闭外扩', '在 ≤1024px 把 --docs1-bleed 归零，避免横向溢出')
  }
}

function ruleL8() {
  const taste = read(TASTE) ?? ''
  // 007 方案 A：组件页单栏，正文与「其他项目如何引用」上下排列。
  if (!/html\.layout-taste \.cmp-grid\s*\{[^}]*display:\s*block/.test(taste)) {
    fail('L8', TASTE, '组件页不是单栏布局', '在优化层把 .cmp-grid 设为 display: block（正文与引用方式上下排列）')
  }
  if (!/html\.layout-taste \.cmp-aside\s*\{[^}]*position:\s*static/.test(taste)) {
    fail('L8', TASTE, '引用栏仍为吸顶定位，会与正文重叠', '把 .cmp-aside 改为 position: static')
  }
  if (!/html\.layout-taste \.cmp-aside\s*\{[^}]*border-radius:\s*var\(--docs1-radius/.test(taste)) {
    fail('L8', TASTE, '引用栏未卡片化', '给 .cmp-aside 圆角与描边，减少分隔线堆叠')
  }
}

function ruleL9() {
  const taste = read(TASTE) ?? ''
  const hasEntry = /html\.layout-taste \.entry-card-title\s*\{/.test(taste)
  const hasKd = /html\.layout-taste \.kd-card\s*\{/.test(taste)
  if (!hasEntry || !hasKd) {
    fail('L9', TASTE, '入口主卡与知识域卡未分级', '分别声明 .entry-card-title 与 .kd-card，形成主次层次')
  }
}

/**
 * L6 只拦「纯百分比算术凑栅格」（摘要里点名的 calc(33% - 1rem) 写法）。
 * 引用 --docs1-* 令牌的百分比算式属于有意为之的外扩，不判错。
 */
/**
 * L10 右栏目录不得「渲染了容器但页面数据里没有任何标题」。
 *
 * 背景：VitePress 只在 markdown.headers 显式开启时才注册 headersPlugin；
 * 未开启时页面数据 headers 恒为 []，右栏目录全站为空（曾长期如此）。
 * 只关 outline 不关 aside 也会留下空容器。这里对「有右栏容器的页面」判空。
 */
function ruleL10() {
  const dist = path.join(REPO_ROOT, 'docs/.vitepress/dist')
  const assets = path.join(dist, 'assets')
  if (!fs.existsSync(assets)) return

  const htmlFiles = []
  const walkHtml = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walkHtml(full)
      else if (entry.name.endsWith('.html')) htmlFiles.push(full)
    }
  }
  walkHtml(dist)

  const offenders = []
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8')
    if (!html.includes('VPDocAside')) continue
    // 由相对路径推出页面数据 chunk：backend/learn/x.md → backend_learn_x.md.<hash>.js
    const rel = path.relative(dist, file)
    const key = rel.replace(/index\.html$/, 'index.md').replace(/\.html$/, '.md').replace(/[/\\]/g, '_')
    const chunk = fs.readdirSync(assets).find((name) => name.startsWith(`${key}.`) && !name.includes('.lean.'))
    if (!chunk) continue
    const data = fs.readFileSync(path.join(assets, chunk), 'utf8')
    const matched = /"headers":\s*\[([^\]]*)\]/.exec(data)
    if (matched && matched[1].trim() === '') offenders.push(rel)
  }
  for (const file of offenders.slice(0, 5)) {
    fail('L10', `docs/.vitepress/dist/${file}`, '右栏目录容器存在但页面标题数据为空（空列白占宽度）', '开启 markdown.headers；或对该页类型设置 aside: false')
  }
  if (offenders.length > 5) fail('L10', TASTE, `另有 ${offenders.length - 5} 个页面右栏为空`, '同类页面统一处理')
}

/** L11 外扩必须与「右栏复位」成对出现，否则右栏内容会压住主栏。 */
function ruleL11() {
  const taste = read(TASTE) ?? ''
  const bleed = /\.vp-doc table\s*\{[^}]*width:\s*calc\(100% \+ var\(--docs1-bleed\)\)/.test(taste)
  if (!bleed) return
  const reset = /\.cmp-aside\s+(div\[class\*='language-'\]|pre|table)/.test(taste)
  if (!reset) {
    fail('L11', TASTE, '宽内容外扩没有配套的右栏复位规则', '给 .cmp-aside 内的代码块与表格加 margin-inline: 0; width: 100%')
  }
}

function ruleL6() {
  for (const rel of [TASTE, CLASSIC]) {
    const text = read(rel)
    if (text === null) continue
    // 捕获整条声明（到 ; 或 } 之前），再判断是否含 % 且未引用令牌。
    const decls = text.match(/width:\s*calc\([^;}]*/g) ?? []
    const offenders = decls.filter((hit) => hit.includes('%') && !/var\(--docs1-/.test(hit))
    if (offenders.length) {
      fail('L6', rel, `出现 ${offenders.length} 处纯百分比栅格写法（首处：${offenders[0].trim()}）`, '改用 CSS Grid：repeat(auto-fit, minmax(…, 1fr))，或引用令牌说明外扩意图')
    }
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
  ruleL7()
  ruleL8()
  ruleL9()
  ruleL10()
  ruleL11()

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
