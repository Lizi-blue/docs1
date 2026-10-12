#!/usr/bin/env node
/**
 * check-pages-artifact —— GitHub Pages 产物门禁（P1–P6，005 T003/T007/T023）。
 *
 * 契约正文：specs/005-github-pages-deploy/contracts/base-path-contract.md
 *
 *   P1 站内绝对链接都必须带 base 前缀（base 为 / 时只做基本检查）
 *   P2 产物不得出现内网域名与私有地址字符串（internalAddressHits=0）
 *   P3 产物不得引用外部网络资源（externalResourceHits=0）
 *   P4 产物根含 .nojekyll（hasNoJekyll=true）
 *   P5 产物根含自包含的 404.html 兜底页（has404Fallback=true）
 *   P6 产物不得出现「内网域名 + /api」这类内网接口组合
 *
 * 口径：P2/P4/P5/P6 是「公网产物（base ≠ /）」的断言（契约 §3 按子路径构建表述）。
 * 内网产物（base = /）本就部署在内网域名下，这几条只记录数值不判错；P3 两个产物都查。
 * base 取值：--base > DOCS1_BASE > 从产物 index.html 推断 > /。
 *
 * 用法：node scripts/check-pages-artifact.mjs [--dist docs/.vitepress/dist] [--base /docs1/] [--json]
 * 退出码：0 通过 / 1 有错误 / 2 脚本异常。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.css', '.json', '.xml', '.txt', '.svg', '.map'])
const INTERNAL_STRINGS = ['docs1.minilab.uzibird.cn', 'minilab.uzibird.cn', '192.168.', 'gitea.minilab']
const INTRANET_API = /(?:https?:\/\/)?(?:[\w.-]*minilab\.uzibird\.cn|192\.168\.\d{1,3}\.\d{1,3})[^\s"'<>()]*\/api\b/g

const errors = []
const warnings = []

function fail(code, file, line, message, fix) {
  errors.push({ code, file, line: line ?? 0, message, fix })
}

/** 从产物里推断 base：取 index.html 里第一个资源引用的前缀。 */
function inferBase(dist) {
  const index = path.join(dist, 'index.html')
  if (!fs.existsSync(index)) return null
  const html = fs.readFileSync(index, 'utf8')
  const matched = /(?:src|href)="(\/[^"']*?)\/assets\//.exec(html)
  if (matched) return `${matched[1]}/`
  return null
}

function resolveBase(raw) {
  const value = raw ?? process.env.DOCS1_BASE ?? '/'
  if (!value.startsWith('/') || !value.endsWith('/')) {
    console.error(`[check-pages-artifact] base 必须以 / 开头并以 / 结尾，当前：${value}`)
    process.exit(2)
  }
  return value
}

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file, result)
    else result.push(file)
  }
  return result
}

function lineOf(text, offset) {
  return text.slice(0, offset).split('\n').length
}

function relative(file) {
  return path.relative(REPO_ROOT, file).replace(/\\/g, '/')
}

/* ------------------------------------------------------------------- P1 */

function checkInternalLinks(file, html, base) {
  const samples = []
  for (const matched of html.matchAll(/(?:href|src)\s*=\s*["']([^"']*)["']/g)) {
    const value = matched[1].trim()
    if (!value || value.startsWith('#') || value.startsWith('//')) continue
    if (/^(?:[a-z][a-z0-9+.-]*:)/i.test(value)) continue
    if (!value.startsWith('/')) continue
    if (base === '/') continue
    if (value.startsWith(base)) continue
    samples.push({ file, line: lineOf(html, matched.index), value })
  }
  return samples
}

/* ------------------------------------------------------------------- P3 */

function externalResources(html) {
  const found = []
  for (const matched of html.matchAll(/<[^>]*\ssrc\s*=\s*["'](https?:\/\/[^"']+|	\/\/[^"']+)["']/gi)) {
    found.push(matched[1])
  }
  for (const matched of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = matched[0]
    if (!/rel\s*=\s*["'][^"']*stylesheet/i.test(tag)) continue
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag)
    if (href && /^(?:https?:)?\/\//i.test(href[1])) found.push(href[1])
  }
  return found
}

/* ------------------------------------------------------------------ 主流程 */

/**
 * P7 平台不可提供的文件名：GitHub Pages 不提供以 @ 或 _ 开头的文件与目录。
 * 本地搜索索引的虚拟模块名曾以 @ 开头，导致公网站内搜索静默失效。
 */
function checkUnservableNames(files) {
  const offenders = files.filter((file) => {
    const rel = path.relative(distRootForNames, file).split(path.sep)
    return rel.some((part) => part.startsWith('@') || part.startsWith('_'))
  })
  for (const file of offenders.slice(0, 5)) {
    fail('P7', relative(file), 1, '文件名以 @ 或 _ 开头，托管平台不提供该文件', '改构建期命名，例如去掉 chunk 名的 @ 前缀')
  }
  return offenders.length
}

let distRootForNames = ''

function main() {
  const args = process.argv.slice(2)
  const distIndex = args.indexOf('--dist')
  const baseIndex = args.indexOf('--base')
  const asJson = args.includes('--json')
  const distArg = distIndex >= 0 ? args[distIndex + 1] : 'docs/.vitepress/dist'
  const dist = path.isAbsolute(distArg) ? distArg : path.join(REPO_ROOT, distArg)

  if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) {
    console.error(`[check-pages-artifact] 产物目录不存在：${dist}，先跑 npm run build`)
    process.exit(2)
  }

  const rawBase = baseIndex >= 0 ? args[baseIndex + 1] : process.env.DOCS1_BASE
  const inferred = rawBase ? null : inferBase(dist)
  const base = resolveBase(rawBase ?? inferred ?? undefined)
  const baseSource = baseIndex >= 0 ? '--base' : process.env.DOCS1_BASE ? 'DOCS1_BASE' : inferred ? '推断自产物' : '默认 /'
  const publicBuild = base !== '/'

  distRootForNames = dist
  const files = walk(dist)
  const htmlFiles = files.filter((file) => file.endsWith('.html'))
  const textFiles = files.filter((file) => TEXT_EXTENSIONS.has(path.extname(file)))
  const sizeBytes = files.reduce((total, file) => total + fs.statSync(file).size, 0)

  // P7 平台不可提供的文件名（@ / _ 开头）
  const unservableNames = checkUnservableNames(files)

  // P1 站内链接带前缀
  const unprefixed = []
  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8')
    if (path.basename(file) === '404.html') continue
    unprefixed.push(...checkInternalLinks(file, html, base))
  }
  if (base !== '/' && unprefixed.length > 0) {
    const detail = unprefixed.slice(0, 5).map((item) => `${relative(item.file)}:${item.line} → ${item.value}`).join('、')
    fail('P1', relative(unprefixed[0].file), unprefixed[0].line,
      `站内绝对链接缺少 base 前缀（共 ${unprefixed.length} 处）：${detail}`,
      `渲染时统一加 base（${base}），或让引擎输出带前缀的 URL`)
  }

  // P2 内网域名与私有地址
  let internalAddressHits = 0
  const internalSamples = []
  for (const file of textFiles) {
    const text = fs.readFileSync(file, 'utf8')
    for (const needle of INTERNAL_STRINGS) {
      let index = text.indexOf(needle)
      while (index >= 0) {
        internalAddressHits += 1
        if (internalSamples.length < 5) internalSamples.push(`${relative(file)}:${lineOf(text, index)} → ${needle}`)
        index = text.indexOf(needle, index + needle.length)
      }
    }
  }
  if (internalAddressHits > 0 && publicBuild) {
    fail('P2', relative(textFiles[0] ?? dist), 0,
      `产物出现内网域名或私有地址 ${internalAddressHits} 处：${internalSamples.join('、')}`,
      '公网产物不得含内网信息，改用占位域名或去掉该串')
  }

  // P3 外部资源引用
  let externalResourceHits = 0
  const externalSamples = []
  for (const file of htmlFiles) {
    for (const url of externalResources(fs.readFileSync(file, 'utf8'))) {
      externalResourceHits += 1
      if (externalSamples.length < 5) externalSamples.push(`${relative(file)} → ${url}`)
    }
  }
  if (externalResourceHits > 0) {
    fail('P3', relative(htmlFiles[0] ?? dist), 0,
      `产物引用外部网络资源 ${externalResourceHits} 处：${externalSamples.join('、')}`,
      '把资源内置到产物，或用站内相对路径')
  }

  // P4 .nojekyll
  const nojekyll = path.join(dist, '.nojekyll')
  const hasNoJekyll = fs.existsSync(nojekyll)
  if (!hasNoJekyll && publicBuild) {
    fail('P4', relative(nojekyll), 0, '产物根缺 .nojekyll', '跑 node scripts/pages-extra.mjs --dist <dist> --base <base>')
  }

  // P5 兜底页
  const fallback = path.join(dist, '404.html')
  const has404Fallback = fs.existsSync(fallback)
  if (!has404Fallback && publicBuild) {
    fail('P5', relative(fallback), 0, '产物根缺 404.html 兜底页', '跑 node scripts/pages-extra.mjs --dist <dist> --base <base>')
  } else if (publicBuild) {
    const html = fs.readFileSync(fallback, 'utf8')
    const external = externalResources(html)
    if (external.length > 0) {
      fail('P5', relative(fallback), 0, `兜底页引用了外部资源：${external.slice(0, 3).join('、')}`, '兜底页必须自包含')
    }
    if (base !== '/' && !html.includes(`"${base}"`) && !html.includes(`'${base}'`)) {
      fail('P5', relative(fallback), 0, `兜底页没有使用 base 前缀 ${base}`, '兜底页的首页链接与跳转目标都要带 base')
    }
  }

  // P6 内网接口组合
  let intranetApiHits = 0
  const intranetSamples = []
  for (const file of textFiles) {
    const text = fs.readFileSync(file, 'utf8')
    for (const matched of text.matchAll(INTRANET_API)) {
      intranetApiHits += 1
      if (intranetSamples.length < 5) intranetSamples.push(`${relative(file)}:${lineOf(text, matched.index)} → ${matched[0]}`)
    }
  }
  if (intranetApiHits > 0 && publicBuild) {
    fail('P6', relative(textFiles[0] ?? dist), 0,
      `产物出现内网接口组合 ${intranetApiHits} 处：${intranetSamples.join('、')}`,
      '公网产物不得指向内网服务；接口地址走同源相对路径或降级说明')
  }

  const stats = {
    dist: relative(dist),
    base,
    baseSource,
    files: files.length,
    htmlFiles: htmlFiles.length,
    sizeBytes,
    hasNoJekyll,
    has404Fallback,
    internalAddressHits,
    externalResourceHits,
    unprefixedRootLinks: base === '/' ? 0 : unprefixed.length,
    unservableNames,
  }

  if (asJson) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings, stats }, null, 2))
  } else {
    for (const item of errors) {
      console.log(`❌ [${item.code}] ${item.file}${item.line ? `:${item.line}` : ''} ${item.message} → 修法：${item.fix}`)
    }
    for (const item of warnings) {
      console.log(`⚠️ [${item.code}] ${item.file} ${item.message} → 建议：${item.fix}`)
    }
    console.log(`产物断言：base=${base}（${baseSource}） / 文件 ${files.length} 个 / 错误 ${errors.length} 项`)
    console.log(`hasNoJekyll=${hasNoJekyll} has404Fallback=${has404Fallback} internalAddressHits=${internalAddressHits} externalResourceHits=${externalResourceHits} unprefixedRootLinks=${stats.unprefixedRootLinks} unservableNames=${unservableNames}`)
  }
  process.exit(errors.length === 0 ? 0 : 1)
}

try {
  main()
} catch (error) {
  console.error('[check-pages-artifact] 脚本异常：', error)
  process.exit(2)
}
