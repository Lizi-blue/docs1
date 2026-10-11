#!/usr/bin/env node
/**
 * check-responsive —— 响应式布局机械门禁（FR-046 / FR-047 / SC-017）。
 *
 * 为什么需要它：本沙箱禁止启动浏览器，也拿不到 dpkg 锁，
 * 真实视口验证只能在浏览器或 CI 里做。这里守住可机械判定的部分：
 *   1. 每个页面有 viewport meta
 *   2. 产物 CSS 含手机 / 平板 / 桌面三档断点
 *   3. 图解高度受视口约束
 *   4. 宽内容（Markdown 表格、API 参数表）在窄屏自滚动
 *   5. 自定义样式里没有固定大宽度
 *   6. 关键布局容器都有窄屏分支
 *
 * 用法：node scripts/check-responsive.mjs [--dist docs/.vitepress/dist] [--json]
 * 退出码：0 通过 / 1 有问题 / 2 脚本异常。
 * 前置：先跑 npm run build。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const checks = []

function record(id, ok, message, fix) {
  checks.push({ id, ok, message })
  if (!ok) errors.push({ id, message, fix })
}

function listFiles(dir, extension) {
  if (!fs.existsSync(dir)) return []
  const found = []
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(extension)) found.push(full)
    }
  }
  walk(dir)
  return found
}

function main() {
  const args = process.argv.slice(2)
  const distIndex = args.indexOf('--dist')
  const dist = path.join(REPO_ROOT, distIndex >= 0 ? args[distIndex + 1] : path.join('docs', '.vitepress', 'dist'))

  if (!fs.existsSync(dist)) {
    console.error(`[check-responsive] 找不到构建产物：${dist}，先跑 npm run build`)
    process.exit(2)
  }

  const htmlFiles = listFiles(dist, '.html')
  const cssFiles = listFiles(path.join(dist, 'assets'), '.css')
  const css = cssFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  const sourceCss = fs.readFileSync(path.join(REPO_ROOT, 'docs', '.vitepress', 'theme', 'styles', 'custom.css'), 'utf8')

  // 1 视口声明
  const missingViewport = htmlFiles.filter((file) => {
    const html = fs.readFileSync(file, 'utf8')
    const count = (html.match(/<meta[^>]+name="viewport"/gi) ?? []).length
    return count !== 1 || !/<meta[^>]+name="viewport"[^>]+width=device-width/i.test(html)
  })
  record('R1', missingViewport.length === 0,
    `viewport meta：${htmlFiles.length - missingViewport.length}/${htmlFiles.length} 个页面恰有一个且含 width=device-width`,
    '在 config 的 head 里补 viewport meta（VitePress 默认已带，检查是否被覆盖）')

  // 2 三档断点
  const breakpoints = ['480px', '640px', '768px', '1024px']
  const missingBreakpoints = breakpoints.filter((bp) => !css.includes(`max-width: ${bp}`) && !css.includes(`max-width:${bp}`))
  record('R2', missingBreakpoints.length === 0,
    `断点：${breakpoints.length - missingBreakpoints.length}/${breakpoints.length} 档存在（缺 ${missingBreakpoints.join(' ') || '无'}）`,
    '在 custom.css 补手机 / 平板 / 桌面三档 media query')

  // 3 图解高度受视口约束
  record('R3', /\.diagram-frame iframe[^}]*min\(var\(--diagram-height/.test(css.replace(/\n/g, ' ')),
    '图解高度使用 min(var(--diagram-height), …vh)',
    '让 DiagramFrame 传 CSS 变量，并在样式里用 min() 夹住高度')

  // 4 宽内容自滚动
  record('R4', /\.vp-doc table[^{]*\{[^}]*overflow-x:\s*auto/.test(css.replace(/\n/g, ' ')),
    'Markdown 表格在窄屏自滚动',
    '在窄屏媒体查询里加 .vp-doc table { display: block; overflow-x: auto }')
  record('R5', /\.api-params[^{]*\{[^}]*overflow-x:\s*auto/.test(css.replace(/\n/g, ' ')),
    'API 参数表在窄屏自滚动',
    '给 .api-params 加 overflow-x: auto')

  // 5 自定义样式不含固定大宽度
  const fixedWidths = [...sourceCss.matchAll(/(?<!max-)(?<!min-)\bwidth:\s*(\d{3,})px/g)]
    .filter((matched) => Number(matched[1]) > 320)
  record('R6', fixedWidths.length === 0,
    `固定大宽度：${fixedWidths.length} 处`,
    '改用 max-width、minmax 或百分比，避免窄屏横向溢出')

  // 6 关键容器有窄屏分支
  const containers = ['.cmp-grid', '.entry-cards', '.kd-pages li', '.tag-row', '.install-row']
  const missingContainers = containers.filter((selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return !new RegExp(`${escaped}[^{]*\\{[^}]*flex-wrap|${escaped}[^{]*\\{[^}]*grid-template-columns`, 's').test(sourceCss)
  })
  record('R7', missingContainers.length === 0,
    `可换行容器：${containers.length - missingContainers.length}/${containers.length}（缺 ${missingContainers.join(' ') || '无'}）`,
    '给这些容器加 flex-wrap 或自适应列，避免窄屏挤压')

  const asJson = args.includes('--json')
  if (asJson) {
    console.log(JSON.stringify({ ok: errors.length === 0, checks, errors }, null, 2))
  } else {
    for (const item of checks) console.log(`${item.ok ? '✅' : '❌'} [${item.id}] ${item.message}`)
    for (const item of errors) console.log(`   → 修法：${item.fix}`)
    console.log(`响应式门禁：${errors.length === 0 ? '通过' : `${errors.length} 项不通过`}`)
  }
  process.exit(errors.length === 0 ? 0 : 1)
}

try {
  main()
} catch (error) {
  console.error('[check-responsive] 脚本异常：', error)
  process.exit(2)
}
