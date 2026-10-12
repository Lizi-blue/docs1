#!/usr/bin/env node
/**
 * check-experience —— 体验与设计令牌门禁（X1–X7，004 T011/T037）。
 *
 * 契约正文：specs/004-component-hub-console/contracts/design-tokens-contract.md
 *
 *   X1 令牌类别齐全：space ≥5、font ≥4、radius ≥3、shadow ≥2、color / focus / state 各 ≥1
 *   X2 深色覆盖：html.dark 块存在，颜色/状态/阴影类令牌要么在块内覆盖，要么派生自 --vp-*
 *   X3 无原始色值（tokens.css 除外）；裸 px 白名单外判错
 *   X4 存在 :focus-visible 规则且引用 --docs1-focus-ring
 *   X5 交互状态齐备：hover / active / disabled / loading / empty / error / degraded
 *   X6 对比度：能解析字面量的前景背景对按 WCAG ≥4.5；解析不出的组合要求 contrast-checked 注释
 *   X7 三档断点存在，且宽内容容器有 overflow-x: auto
 *
 * 用法：node scripts/check-experience.mjs [--root docs] [--json]
 * 退出码：0 通过 / 1 有错误 / 2 脚本异常。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const MINIMUM = { space: 5, font: 4, radius: 3, shadow: 2, color: 1, focus: 1, state: 1 }
const CATEGORY_PATTERNS = {
  space: /^--docs1-space-/,
  font: /^--docs1-font-/,
  radius: /^--docs1-radius-/,
  shadow: /^--docs1-shadow-/,
  color: /^--docs1-color-/,
  focus: /^--docs1-focus-/,
  state: /^--docs1-state-/,
}
const STATE_PATTERNS = {
  hover: /:hover/,
  active: /:active/,
  disabled: /:disabled|\[disabled\]|aria-disabled/,
  loading: /loading|aria-busy/,
  empty: /-empty\b|\.empty\b|:empty/,
  error: /-error\b|\.error\b|role="alert"/,
  degraded: /-degraded\b|\.degraded\b|offline|降级/,
}
/** 允许裸 px 的属性（结构尺寸）。 */
const SIZE_PROPERTIES = new Set([
  'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height',
  'flex', 'flex-basis', 'grid-template-columns', 'grid-template-rows', 'grid-auto-columns', 'grid-auto-rows',
])
/** px 出现在这些函数里按结构尺寸处理（栅格与 var 回退）。 */
const SIZE_FUNCTIONS = new Set(['minmax', 'repeat', 'var', 'clamp', 'min', 'max'])

/** 判断某个 px 命中是否落在结构尺寸上下文里。 */
function pxAllowed(property, value, index) {
  if (SIZE_PROPERTIES.has(property)) return true
  // 设计令牌定义本身：--docs1-* 是唯一允许出现字面量的地方（契约 §1 白名单）。
  if (/^--docs1-/.test(property)) return true
  const before = value.slice(0, index)
  const open = before.lastIndexOf('(')
  if (open >= 0 && !before.slice(open).includes(')')) {
    const name = /([a-z-]+)\s*$/.exec(before.slice(0, open))?.[1] ?? ''
    if (SIZE_FUNCTIONS.has(name)) return true
  }
  const snippet = value.slice(index, index + 6)
  if (/^1px/.test(snippet) && /^(border|outline)/.test(property)) return true
  return false
}

const errors = []
const warnings = []

function fail(code, file, line, message, fix) {
  errors.push({ code, file, line: line ?? 0, message, fix })
}

function resolveRoot(value) {
  return path.isAbsolute(value) ? value : path.join(REPO_ROOT, value)
}

function relative(file) {
  return path.relative(REPO_ROOT, file).replace(/\\/g, '/')
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (matched) => matched.replace(/[^\n]/g, ' '))
}

function lineOf(source, needle) {
  const index = source.split('\n').findIndex((line) => line.includes(needle))
  return index < 0 ? 1 : index + 1
}

/* --------------------------------------------------------------- 令牌解析 */

/** 取一个块的 `--name: value` 映射。 */
function readTokens(css, blockStart) {
  const tokens = new Map()
  const start = css.indexOf(blockStart)
  if (start < 0) return tokens
  const body = css.slice(start, css.indexOf('}', start))
  for (const matched of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    tokens.set(`--${matched[1]}`, matched[2].trim())
  }
  return tokens
}

function parseColor(value) {
  const text = String(value).trim()
  const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(text)
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split('').map((char) => char + char).join('') : hex[1]
    return [0, 2, 4].map((offset) => Number.parseInt(raw.slice(offset, offset + 2), 16))
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(text)
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map((part) => Number.parseFloat(part))
    if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) return parts
  }
  const hsl = /^hsla?\(([^)]+)\)$/i.exec(text)
  if (hsl) {
    const parts = hsl[1].split(/[\s,/]+/).filter(Boolean)
    const hue = Number.parseFloat(parts[0]) / 360
    const saturation = Number.parseFloat(parts[1]) / 100
    const lightness = Number.parseFloat(parts[2]) / 100
    if ([hue, saturation, lightness].every((part) => Number.isFinite(part))) {
      return hslToRgb(hue, saturation, lightness)
    }
  }
  return null
}

function hslToRgb(hue, saturation, lightness) {
  const channel = (offset) => {
    const k = (offset + hue * 12) % 12
    const a = saturation * Math.min(lightness, 1 - lightness)
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))))
  }
  return [channel(0), channel(8), channel(4)]
}

/** 令牌解析：支持 var(--x, fallback) 递归；解析不出返回 null。 */
function resolveToken(name, tokens, depth = 0) {
  if (depth > 6) return null
  const value = tokens.get(name)
  if (!value) return null
  const fallback = /var\(\s*(--[a-z0-9-]+)\s*,\s*([^)]*)\)/i.exec(value)
  if (fallback) return resolveToken(fallback[1], tokens, depth + 1) ?? parseColor(fallback[2])
  if (/^var\(/i.test(value)) return null
  return parseColor(value)
}

function luminance([red, green, blue]) {
  const channel = (value) => {
    const ratio = value / 255
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
}

function contrastRatio(foreground, background) {
  const first = luminance(foreground)
  const second = luminance(background)
  const [high, low] = first >= second ? [first, second] : [second, first]
  return (high + 0.05) / (low + 0.05)
}

/* ------------------------------------------------------------------- X6 */

function contrastPairs(tokens) {
  const pairs = []
  for (const name of tokens.keys()) {
    const on = /^--docs1-color-on-(.+)$/.exec(name)
    if (on) pairs.push({ fg: name, bg: `--docs1-color-${on[1]}` })
  }
  const foregrounds = [...tokens.keys()].filter((name) => /text$|-text$|-muted$/.test(name) && /^--docs1-color-/.test(name))
  const backgrounds = [...tokens.keys()].filter((name) => /^--docs1-color-(surface|bg|panel)/.test(name) || /-surface$/.test(name))
  for (const fg of foregrounds) for (const bg of backgrounds) pairs.push({ fg, bg })
  const seen = new Set()
  return pairs.filter((pair) => {
    const key = `${pair.fg}|${pair.bg}`
    if (seen.has(key) || !tokens.has(pair.bg)) return false
    seen.add(key)
    return true
  })
}

function checkContrast(cssFile, css) {
  const tokens = readTokens(css, ':root')
  const unresolved = []
  for (const pair of contrastPairs(tokens)) {
    const foreground = resolveToken(pair.fg, tokens)
    const background = resolveToken(pair.bg, tokens)
    if (!foreground || !background) {
      unresolved.push(`${pair.fg} on ${pair.bg}`)
      continue
    }
    const ratio = contrastRatio(foreground, background)
    if (ratio < 4.5) {
      fail('X6', relative(cssFile), lineOf(css, `${pair.fg}:`),
        `对比度不足：${pair.fg} 落在 ${pair.bg} = ${ratio.toFixed(2)}:1（下限 4.5）`,
        '调深前景或调浅背景，或改用对比更强的语义色')
    }
  }
  if (unresolved.length > 0 && !/contrast-checked/.test(css)) {
    fail('X6', relative(cssFile), 1,
      `${unresolved.length} 组前景背景无法解析字面量，且 tokens.css 缺 contrast-checked 注释：${unresolved.join('、')}`,
      '在 tokens.css 补 /* contrast-checked: ≥4.5 */ 说明已人工核对')
  }
}

/* ------------------------------------------------------------------- X3 */

function checkRawValues(file, css) {
  const body = stripComments(css)
  const fileRelative = relative(file)
  for (const matched of body.matchAll(/(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/g)) {
    const line = body.slice(0, matched.index).split('\n').length
    fail('X3', fileRelative, line, `出现原始色值：${matched[1]}`, '改用 --docs1-* 令牌')
  }
  // 去掉 @media / @supports 前置，避免把断点当作裸 px
  const flattened = body.replace(/@(media|supports)[^{]*\{/g, '{')
  // 属性名允许数字与自定义属性的双横线前缀（--docs1-*）。
  for (const matched of flattened.matchAll(/([a-z0-9-]+)\s*:\s*([^;{}]+)/gi)) {
    const property = matched[1].toLowerCase()
    const value = matched[2]
    if (/env\(/.test(value)) continue
    const line = flattened.slice(0, matched.index).split('\n').length
    for (const px of value.matchAll(/(-?\d*\.?\d+)px/g)) {
      if (pxAllowed(property, value, px.index)) continue
      fail('X3', fileRelative, line, `裸 px 未走令牌：${property}: ${value.trim()}`,
        '结构尺寸用 --docs1-space-*，圆角用 --docs1-radius-*，描边用 --docs1-border-*')
    }
  }
}

/* ------------------------------------------------------------------- 主流程 */

function main() {
  const args = process.argv.slice(2)
  const rootIndex = args.indexOf('--root')
  const rootArg = rootIndex >= 0 ? args[rootIndex + 1] : 'docs'
  const asJson = args.includes('--json')
  const rootDir = resolveRoot(rootArg)
  const themeDir = path.join(rootDir, '.vitepress', 'theme')
  const tokensFile = path.join(themeDir, 'styles', 'tokens.css')
  // 样式已分档（custom.css 入口 + classic.css 冻结 + taste.css 优化层），
  // 门禁按目录扫描全部样式文件，避免把重构当成违规。tokens.css 单独处理。
  const stylesDir = path.join(themeDir, 'styles')
  const styleFiles = fs
    .readdirSync(stylesDir)
    .filter((name) => name.endsWith('.css') && name !== 'tokens.css')
    .map((name) => path.join(stylesDir, name))
  const customFile = styleFiles.find((file) => path.basename(file) === 'custom.css') ?? styleFiles[0]
  const customCss = styleFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  const componentDir = path.join(themeDir, 'components')

  if (!fs.existsSync(tokensFile)) {
    console.error(`[check-experience] 找不到令牌文件：${tokensFile}`)
    process.exit(2)
  }

  const tokensCss = fs.readFileSync(tokensFile, 'utf8')
  const componentFiles = fs.existsSync(componentDir)
    ? fs.readdirSync(componentDir).filter((name) => name.endsWith('.vue')).map((name) => path.join(componentDir, name))
    : []
  const componentCss = componentFiles
    .map((file) => [...fs.readFileSync(file, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((item) => item[1]).join('\n'))
    .join('\n')

  // X1 令牌类别齐全
  const rootTokens = readTokens(tokensCss, ':root')
  for (const [category, minimum] of Object.entries(MINIMUM)) {
    const count = [...rootTokens.keys()].filter((name) => CATEGORY_PATTERNS[category].test(name)).length
    if (count < minimum) {
      fail('X1', relative(tokensFile), 1, `${category} 令牌只有 ${count} 个（下限 ${minimum}）`, `在 tokens.css 补足 ${category} 令牌`)
    }
  }

  // X2 深色覆盖
  const darkTokens = readTokens(tokensCss, 'html.dark')
  if (darkTokens.size === 0) {
    fail('X2', relative(tokensFile), 1, '缺 html.dark 覆盖块', '给颜色/状态/阴影令牌补深色值')
  }
  const missingDark = []
  for (const [name, value] of rootTokens) {
    const needsDark = /color|state|shadow/.test(name) || /#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(/.test(value)
    if (!needsDark) continue
    if (darkTokens.has(name) || /var\(--vp-/.test(value)) continue
    missingDark.push(name)
  }
  for (const name of missingDark) {
    fail('X2', relative(tokensFile), lineOf(tokensCss, `${name}:`), `深色模式未覆盖：${name}`, '在 html.dark 里给同名令牌，或改成派生自 --vp-*')
  }

  // X3 原始色值与裸 px
  if (customCss) checkRawValues(customFile, customCss)
  for (const file of componentFiles) {
    const styles = [...fs.readFileSync(file, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((item) => item[1]).join('\n')
    if (styles.trim()) checkRawValues(file, styles)
  }

  // X4 焦点环
  const focusSource = `${customCss}\n${componentCss}`
  if (!/:[a-z-]*focus-visible[^{]*\{[^}]*--docs1-focus-ring/s.test(focusSource)) {
    fail('X4', relative(customFile), 1, ':focus-visible 规则没有引用 --docs1-focus-ring', '补 :focus-visible { outline: var(--docs1-focus-ring); }')
  }

  // X5 状态类
  for (const [state, pattern] of Object.entries(STATE_PATTERNS)) {
    if (!pattern.test(focusSource)) {
      fail('X5', relative(customFile), 1, `缺 ${state} 状态的规则`, `给 ${state} 状态补可见样式`)
    }
  }

  // X6 对比度
  checkContrast(tokensFile, tokensCss)

  // X7 断点与滚动
  const mediaQueries = [...`${customCss}\n${componentCss}`.matchAll(/@media[^{]*/g)].map((item) => item[0])
  const widths = mediaQueries
    .map((query) => /max-width\s*:\s*(\d+)px/.exec(query))
    .filter(Boolean)
    .map((matched) => Number.parseInt(matched[1], 10))
  const hasPhone = widths.some((width) => width <= 640)
  const hasTablet = widths.some((width) => width > 640 && width <= 1100)
  if (!hasPhone || !hasTablet) {
    fail('X7', relative(customFile), 1, `响应式断点不全：${widths.join(' / ') || '无'}`, '补 ≤640px 与平板档断点')
  }
  if (!/overflow-x\s*:\s*auto/.test(focusSource)) {
    fail('X7', relative(customFile), 1, '宽内容容器没有 overflow-x: auto', '表格、代码与日志容器在窄屏自滚动')
  }

  if (asJson) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings }, null, 2))
  } else {
    for (const item of errors) {
      console.log(`❌ [${item.code}] ${item.file}${item.line ? `:${item.line}` : ''} ${item.message} → 修法：${item.fix}`)
    }
    for (const item of warnings) {
      console.log(`⚠️ [${item.code}] ${item.file}${item.line ? `:${item.line}` : ''} ${item.message} → 建议：${item.fix}`)
    }
    console.log(`体验门禁：错误 ${errors.length} 项 / 警告 ${warnings.length} 项`)
  }
  process.exit(errors.length === 0 ? 0 : 1)
}

try {
  main()
} catch (error) {
  console.error('[check-experience] 脚本异常：', error)
  process.exit(2)
}
