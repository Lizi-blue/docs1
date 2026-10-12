#!/usr/bin/env node
/**
 * check-nav —— 导航层级机械门禁（宪法 X / N1–N4）。
 *
 * 为什么需要它：层级压平、入口页只列一部分讲、outline 知识域不标待补，
 * 这三类问题在源码层看不出来。这里在构建产物上断言。
 *
 *   N1 学习入口页列出该域每个已开写知识域的全部讲
 *   N2 含子主题的知识域：入口页出现子主题分组与其页面
 *   N3 未开写知识域（teach.status: outline）在入口页标出「待补」
 *   N4 每个知识点页的侧边栏含所属知识域名与至少两条同域链接（作用域侧边栏生效）
 *   N5 领域首页的顶栏下拉含该域全部知识域（顶栏层级加深）
 *   N6 有页内 H3 分组的知识点页：侧边栏出现 1.1.1 级锚点链接且锚点真实存在
 *
 * 用法：node --experimental-strip-types scripts/check-nav.mjs [--dist docs/.vitepress/dist] [--json]
 * 退出码：0 通过 / 1 有问题 / 2 脚本异常。前置：先跑 npm run build。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDocTree } from '../docs/.vitepress/plugins/doc-engine.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const checks = []

function record(id, ok, message, fix) {
  checks.push({ id, ok, message })
  if (!ok) errors.push({ id, message, fix })
}

const OUTLINE_LABEL = '待补'

function distFile(dist, url) {
  const clean = url.replace(/^\//, '')
  return path.join(dist, clean.endsWith('/') || clean === '' ? `${clean}index.html` : `${clean}.html`)
}

function readHtml(dist, url) {
  const file = distFile(dist, url)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
}

function allPages(kd) {
  return [...kd.pages, ...kd.subtopics.flatMap((sub) => sub.pages)]
}

function main() {
  const args = process.argv.slice(2)
  const distIndex = args.indexOf('--dist')
  const dist = path.resolve(process.argv.includes('--dist')
    ? path.join(REPO_ROOT, args[distIndex + 1])
    : path.join(REPO_ROOT, 'docs', '.vitepress', 'dist'))
  if (!fs.existsSync(dist)) {
    console.error(`[check-nav] 找不到构建产物：${dist}，先跑 npm run build`)
    process.exit(2)
  }

  const tree = buildDocTree(path.join(REPO_ROOT, 'docs'))

  for (const domain of tree.domains) {
    const entryUrl = domain.entry.learn
    if (!entryUrl) continue
    const entryHtml = readHtml(dist, entryUrl)
    if (!entryHtml) {
      record('N1', false, `${domain.slug} 学习入口页缺失：${entryUrl}`, '检查 build 输出')
      continue
    }

    const missingLessons = []
    const missingSubtopics = []
    const missingOutline = []
    for (const kd of domain.learn) {
      const outline = kd.teach?.status === 'outline'
      if (outline) {
        if (!entryHtml.includes(`${kd.name}`) || !entryHtml.includes(OUTLINE_LABEL)) missingOutline.push(kd.slug)
        continue
      }
      if (!entryHtml.includes(kd.name)) missingLessons.push(`${kd.slug}（知识域标题）`)
      for (const page of kd.pages) {
        if (!entryHtml.includes(page.title)) missingLessons.push(`${kd.slug}/${page.title}`)
      }
      for (const sub of kd.subtopics) {
        if (!entryHtml.includes(sub.name)) missingSubtopics.push(`${kd.slug}/${sub.name}`)
        for (const page of sub.pages) {
          if (!entryHtml.includes(page.title)) missingSubtopics.push(`${kd.slug}/${sub.name}/${page.title}`)
        }
      }
    }
    record('N1', missingLessons.length === 0,
      `${domain.slug} 学习入口层级：缺 ${missingLessons.length} 项`,
      `入口页必须列出每个已开写知识域与其全部讲：${missingLessons.slice(0, 5).join('、')}`)
    record('N2', missingSubtopics.length === 0,
      `${domain.slug} 子主题层级：缺 ${missingSubtopics.length} 项`,
      `入口页必须列出子主题分组与其页面：${missingSubtopics.slice(0, 5).join('、')}`)
    record('N3', missingOutline.length === 0,
      `${domain.slug} 未开写知识域标注：缺 ${missingOutline.length} 项`,
      `outline 知识域必须在入口页标「${OUTLINE_LABEL}」：${missingOutline.join('、')}`)

    const scopedMissing = []
    for (const kd of domain.learn) {
      for (const page of allPages(kd)) {
        const html = readHtml(dist, page.url)
        if (!html) {
          scopedMissing.push(`${page.url}（页面缺失）`)
          continue
        }
        const links = allPages(kd).filter((item) => item.url !== page.url && html.includes(item.url)).length
        if (!html.includes(kd.name) || links < 2) scopedMissing.push(`${page.url}（同域链接 ${links} 条）`)
      }
    }
    record('N4', scopedMissing.length === 0,
      `${domain.slug} 作用域侧边栏：问题页 ${scopedMissing.length} 个`,
      `知识点页侧边栏必须含所属知识域名与至少两条同域链接：${scopedMissing.slice(0, 4).join('、')}`)
  }

  for (const domain of tree.domains) {
    const html = readHtml(dist, domain.url)
    if (!html) {
      record('N5', false, `${domain.slug} 领域首页缺失：${domain.url}`, '检查 build 输出')
      continue
    }
    const missingNav = domain.learn.filter((kd) => !html.includes(kd.name)).map((kd) => kd.slug)
    record('N5', missingNav.length === 0,
      `${domain.slug} 顶栏层级：缺 ${missingNav.length} 个知识域`,
      `顶栏下拉必须含全部知识域：${missingNav.join('、')}`)
  }

  const anchorMissing = []
  let anchorChecked = 0
  for (const domain of tree.domains) {
    for (const kd of domain.learn) {
      for (const page of allPages(kd)) {
        const groups = (page.outline ?? []).filter((item) => item.level === 3)
        if (groups.length === 0) continue
        anchorChecked += 1
        const html = readHtml(dist, page.url)
        if (!html) continue
        const linked = groups.filter((group) => html.includes(`${page.url}#${group.slug}`)).length
        const anchored = groups.filter((group) => html.includes(`id="${group.slug}"`)).length
        if (linked === 0 || anchored < groups.length) {
          anchorMissing.push(`${page.url}（锚点链接 ${linked}，锚点存在 ${anchored}/${groups.length}）`)
        }
      }
    }
  }
  record('N6', anchorMissing.length === 0,
    `页内分组锚点：抽查 ${anchorChecked} 页，问题 ${anchorMissing.length} 页`,
    `侧边栏必须链到 1.1.1 级锚点，且锚点真实存在：${anchorMissing.slice(0, 4).join('、')}`)

  if (args.includes('--json')) {
    console.log(JSON.stringify({ ok: errors.length === 0, checks, errors }, null, 2))
  } else {
    for (const item of checks) console.log(`${item.ok ? '✅' : '❌'} [${item.id}] ${item.message}`)
    for (const item of errors) console.log(`   → 修法：${item.fix}`)
    console.log(`导航层级门禁：${errors.length === 0 ? '通过' : `${errors.length} 项不通过`}`)
  }
  process.exit(errors.length === 0 ? 0 : 1)
}

try {
  main()
} catch (error) {
  console.error('[check-nav] 脚本异常：', error)
  process.exit(2)
}
