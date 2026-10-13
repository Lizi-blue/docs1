#!/usr/bin/env node
/**
 * 布局审计（需 Playwright，可选执行）：
 *   node scripts/audit-layout.mjs --base https://docs1.minilab.uzibird.cn \
 *        --paths /backend/components/safe-queue,/backend/learn/concurrency/thread-basics
 *
 * 判据：重叠=0、空目录列宽=0、主栏 ≥ 42rem、正文利用率 ≥ 70%。
 * 未安装 playwright 时退出码 2，并提示安装方式（不静默通过）。
 */
const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const base = arg('base', 'http://127.0.0.1:4191')
const paths = arg('paths', '/backend/components/safe-queue').split(',')
const [w, h] = arg('viewport', '1560x766').split('x').map(Number)

let chromium
try {
  ;({ chromium } = await import('playwright'))
} catch {
  console.error('[audit-layout] 未安装 playwright。安装后重试：npm i -D playwright && npx playwright install chromium')
  process.exit(2)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: w, height: h } })
let failed = 0

for (const path of paths) {
  await page.goto(base + path, { waitUntil: 'networkidle' })
  const m = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), w: Math.round(r.width), right: Math.round(r.right) }
    }
    const main = document.querySelector('.cmp-main')
    const aside = document.querySelector('.cmp-aside')
    let overlaps = 0
    if (main && aside) {
      const mr = main.getBoundingClientRect().right
      aside.querySelectorAll('pre, table, div[class*="language-"]').forEach((el) => {
        if (el.getBoundingClientRect().left < mr - 1) overlaps += 1
      })
    }
    const emptyAside = document.querySelector('.VPDoc .aside:has(.VPDocOutlineItem:empty)')
    return {
      viewport: window.innerWidth,
      main: box('.cmp-main') || box('.content-container'),
      asideCol: box('.cmp-aside'),
      emptyAsideWidth: emptyAside ? Math.round(emptyAside.getBoundingClientRect().width) : 0,
      overlaps,
    }
  })
  const measure = 42 * 16
  const util = Math.round(((m.main?.w || 0) / m.viewport) * 100)
  const ok = m.overlaps === 0 && m.emptyAsideWidth === 0 && (m.main?.w || 0) >= measure && util >= 70
  console.log(`${ok ? '✅' : '❌'} ${path}  主栏=${m.main?.w}px 侧栏=${m.asideCol?.w ?? 0}px 空列=${m.emptyAsideWidth}px 重叠=${m.overlaps} 利用率=${util}%`)
  if (!ok) failed += 1
}

await browser.close()
process.exit(failed ? 1 : 0)
