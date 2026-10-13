#!/usr/bin/env node
/**
 * check-component —— 组件页契约门禁（C1–C7，004 T010/T016/T021/T026/T047）。
 *
 * 契约正文：specs/004-component-hub-console/contracts/component-page-contract.md
 *
 *   C1 必填元数据齐全，direction 与 domain 路径映射一致
 *   C2 必需章节及其顺序（16 节），关键小节与 API 方法组
 *   C3 方向纯净：后端页不写前端实现，前端页不写后端实现（`## 对应另一端` 豁免）
 *   C4 知识索引：命中链接表或指向 outline 知识域，role 10–80 字，同页唯一
 *   C5 复用清单：reuse/<component>/manifest.json 存在、文件存在、与页面互指
 *   C6 样式作用域：主题组件 `<style>` 必须 scoped 或带类前缀，禁裸标签选择器
 *   C7 互链双向：声明 cross_link 时对方页面必须回链
 *
 * 用法：node scripts/check-component.mjs [--root docs] [--json]
 * 退出码：0 通过 / 1 有错误 / 2 脚本异常。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { buildDocTree, normalizeLink } from '../docs/.vitepress/plugins/doc-engine.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKIP_DIRS = new Set(['.vitepress', 'public', 'node_modules', '.git', 'diagrams', 'dist'])

const DIRECTIONS = ['backend', 'frontend', 'fullstack']
const DIRECTION_BY_SEGMENT = { backend: 'backend', frontend: 'frontend', 'cross-domain': 'fullstack' }

/** 契约 §2 的 18 个必需章节，顺序即数组顺序。 */
const REQUIRED_SECTIONS = [
  '## 组件简介',
  '## 对应另一端',
  '## 依赖的知识域与知识点',
  '## 对象模型',
  '## 对象层级',
  '## 对象协作与流程',
  '## 组合方式图解',
  '## 核心源码',
  '## 设计说明',
  '## 使用文档',
  '## 复用四件套',
  '## 其他项目如何引用',
  '## 接口契约',
  '## API 手册：',
  '## 常见误区',
  '## 面试追问链',
  '## 与其他组件的关系',
  '## 下一讲衔接',
]

/** 迁移期：只有登记在清单里的页面才强制要求三个对象节。 */
const OO_ROLLOUT_REL = 'scripts/data/oo-rollout.txt'
const OO_SECTIONS = ['## 对象模型', '## 对象层级', '## 对象协作与流程']

function ooRollout(rootDir) {
  const listPath = path.join(path.dirname(rootDir), OO_ROLLOUT_REL)
  if (!fs.existsSync(listPath)) return []
  return fs.readFileSync(listPath, 'utf8').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
}

/** 方向纯净词表（契约 §3）。 */
const PURITY_RULES = {
  backend: [
    [/\.vue/, '前端组件文件后缀 `.vue`'],
    [/EventSource/, '浏览器专有 API `EventSource`'],
    [/document\./, '浏览器专有 API `document.`'],
    [/window\./, '浏览器专有 API `window.`'],
    [/fetch\(/, '浏览器专有 API `fetch(`'],
  ],
  frontend: [
    [/killpg/, '后端实现细节 `killpg`'],
    [/SIGTERM/, '后端实现细节 `SIGTERM`'],
    [/进程组/, '后端实现细节「进程组」'],
    [/\/proc\//, '后端实现细节 `/proc/`'],
  ],
}

const errors = []
const warnings = []

function fail(code, file, line, message, fix) {
  errors.push({ code, file, line: line ?? 0, message, fix })
}
function warn(code, file, line, message, fix) {
  warnings.push({ code, file, line: line ?? 0, message, fix })
}

/* ------------------------------------------------------------------ 读取 */

function resolveRoot(value) {
  return path.isAbsolute(value) ? value : path.join(REPO_ROOT, value)
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.'))
    .map((entry) => path.join(dir, entry.name))
}

function listFiles(dir, extension) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => path.join(dir, entry.name))
}

function readPage(file) {
  const raw = fs.readFileSync(file, 'utf8')
  const parsed = matter(raw)
  return { raw, data: parsed.data ?? {}, content: parsed.content ?? '' }
}

/* ------------------------------------------------------------------ 定位 */

function headingLines(content) {
  return content.split('\n').map((text, index) => {
    const matched = /^(#{1,6})\s+(.+?)\s*$/.exec(text)
    return { text: text.trim(), body: matched?.[2] ?? '', level: matched ? matched[1].length : 0, line: index + 1 }
  })
}

function sectionBody(content, heading) {
  const lines = content.split('\n')
  const start = lines.findIndex((line) => line.trim().startsWith(heading))
  if (start < 0) return null
  const level = (heading.match(/^#+/) ?? ['##'])[0].length
  const body = []
  for (let index = start + 1; index < lines.length; index += 1) {
    const matched = /^(#+)\s/.exec(lines[index])
    if (matched && matched[1].length <= level) break
    body.push(lines[index])
  }
  return body
}

/** 把某节正文替换成等长空白，用于豁免扫描且不破坏行号。 */
function blankSection(content, heading) {
  const lines = content.split('\n')
  const start = lines.findIndex((line) => line.trim().startsWith(heading))
  if (start < 0) return content
  const level = (heading.match(/^#+/) ?? ['##'])[0].length
  for (let index = start; index < lines.length; index += 1) {
    if (index > start) {
      const matched = /^(#+)\s/.exec(lines[index])
      if (matched && matched[1].length <= level) break
    }
    lines[index] = ' '.repeat(lines[index].length)
  }
  return lines.join('\n')
}

function lineOf(content, needle) {
  const index = content.split('\n').findIndex((line) => line.includes(needle))
  return index < 0 ? 1 : index + 1
}

function lineOfKey(raw, key) {
  const index = raw.split('\n').findIndex((line) => new RegExp(`^${key}\\s*:`).test(line))
  return index < 0 ? 1 : index + 1
}

function lineOfOffset(content, offset) {
  return content.slice(0, offset).split('\n').length
}

/* ------------------------------------------------------------------- C1 */

function expectedDirection(relative) {
  const segment = relative.split('/')[0]
  return DIRECTION_BY_SEGMENT[segment] ?? null
}

function checkMetadata(page, relative) {
  const data = page.data
  const required = [
    'title', 'type', 'domain', 'direction', 'component_type',
    'install_command', 'tags_index', 'reusability', 'knowledge_index', 'reuse_manifest',
  ]
  for (const key of required) {
    const value = data[key]
    if (value === undefined || value === null || value === '') {
      fail('C1', relative, lineOfKey(page.raw, key), `缺少必填元数据：${key}`, '按 component-page-contract §1 补齐字段')
    }
  }
  if (data.direction && !DIRECTIONS.includes(data.direction)) {
    fail('C1', relative, lineOfKey(page.raw, 'direction'), `direction 取值非法：${data.direction}`, `允许值：${DIRECTIONS.join(' / ')}`)
  }
  const expected = expectedDirection(relative)
  if (data.direction && expected && data.direction !== expected) {
    fail('C1', relative, lineOfKey(page.raw, 'direction'),
      `direction=${data.direction} 与路径不符（期望 ${expected}）`, '按目录归属改 direction：backend/frontend/cross-domain')
  }
  if (data.type === 'cross-component' && data.direction && data.direction !== 'fullstack') {
    fail('C1', relative, lineOfKey(page.raw, 'direction'), 'cross-component 的 direction 必须是 fullstack', '改为 fullstack')
  }
  if (data.reuse_manifest && !/^reuse\//.test(String(data.reuse_manifest))) {
    fail('C1', relative, lineOfKey(page.raw, 'reuse_manifest'), `reuse_manifest 必须以 reuse/ 开头：${data.reuse_manifest}`, '写 reuse/<component>/manifest.json')
  }
  if (data.tags_index !== undefined && (!Array.isArray(data.tags_index) || data.tags_index.length === 0)) {
    fail('C1', relative, lineOfKey(page.raw, 'tags_index'), 'tags_index 必须是非空数组', '至少给一个小写短标签')
  }
  if (data.component_type && !['library', 'framework', 'pattern', 'tool'].includes(data.component_type)) {
    fail('C1', relative, lineOfKey(page.raw, 'component_type'), `component_type 取值非法：${data.component_type}`, '允许 library / framework / pattern / tool')
  }
}

/* ------------------------------------------------------------------- C2 */

function checkSections(page, relative, data, rootDirForSections) {
  const h2 = headingLines(page.content).filter((item) => item.level === 2)
  const names = h2.map((item) => item.body)
  const hasCrossLink = Boolean(data.cross_link)
  const migrated = ooRollout(rootDirForSections).includes(relative)
  const expected = REQUIRED_SECTIONS.filter((section) => section !== '## 对应另一端' || hasCrossLink)
    .filter((section) => migrated || !OO_SECTIONS.includes(section))
  const bare = (section) => section.replace(/^#+\s*/, '')
  const matchIndex = (section) =>
    names.findIndex((name) => name === bare(section) || (bare(section).endsWith('：') && name.startsWith(bare(section))))

  const missing = expected.filter((section) => matchIndex(section) < 0)
  for (const section of missing) {
    fail('C2', relative, 1, `缺必需章节：${section}`, '按 component-page-contract §2 的 18 节顺序补齐')
  }
  if (!migrated) {
    const pending = OO_SECTIONS.filter((section) => matchIndex(section) < 0)
    if (pending.length) {
      warn('C2', relative, 1, `对象节待补齐（迁移期）：${pending.join('、')}`, '按 008 迁移计划补齐后登记进 scripts/data/oo-rollout.txt')
    }
  }

  const found = []
  for (const section of expected) {
    const index = matchIndex(section)
    if (index >= 0) found.push({ section, index, line: h2[index].line })
  }
  for (let index = 1; index < found.length; index += 1) {
    if (found[index].index < found[index - 1].index) {
      fail('C2', relative, found[index].line, `章节顺序不对：${found[index].section} 应在 ${found[index - 1].section} 之后`, '按契约 §2 的顺序重排')
    }
  }

  const extra = h2.filter((item) => !expected.some((section) => item.body === bare(section) || (bare(section).endsWith('：') && item.body.startsWith(bare(section)))))
  for (const item of extra) warn('C2', relative, item.line, `非契约章节：${item.body}`, '确认这是有意追加的章节')

  const design = sectionBody(page.content, '## 设计说明')
  if (design && !design.some((line) => line.trim() === '### 官方依据与版本差异')) {
    fail('C2', relative, lineOf(page.content, '## 设计说明'), '「## 设计说明」里缺「### 官方依据与版本差异」', '补官方依据小节，≥2 条官方链接并带版本')
  }
  const contract = sectionBody(page.content, '## 接口契约')
  if (contract && !contract.some((line) => line.trim() === '### 契约版本与迁移')) {
    fail('C2', relative, lineOf(page.content, '## 接口契约'), '「## 接口契约」里缺「### 契约版本与迁移」', '补迁移小节，写明 contract_version 与步骤')
  }

  const api = sectionBody(page.content, '## API 手册：')
  if (api) {
    const body = api.join('\n')
    const groups = [...body.matchAll(/^###\s+(.+?)\s*$/gm)].length
    const tables = [...body.matchAll(/<ApiTable :items='/g)].length
    if (groups < 2) fail('C2', relative, lineOf(page.content, '## API 手册：'), `API 手册只有 ${groups} 个方法组`, '按方法组拆成 ≥2 个 H3，每组紧跟一张 ApiTable')
    else if (tables < groups) fail('C2', relative, lineOf(page.content, '## API 手册：'), `方法组 ${groups} 个但 ApiTable 只有 ${tables} 张`, '每组紧跟一张 ApiTable')
  }

  const reuse = sectionBody(page.content, '## 其他项目如何引用')
  if (reuse) {
    const body = reuse.join('\n')
    const ways = [...body.matchAll(/^###\s*方式[一二三]/gm)].length
    if (ways < 3) {
      fail('C2', relative, lineOf(page.content, '## 其他项目如何引用'), `引用方式只有 ${ways} 种`, '按契约给出至少三种方式：方式一 / 方式二 / 方式三')
    }
  }
}

/* ------------------------------------------------------------------- C3 */

function checkPurity(page, relative, data) {
  const direction = data.direction
  const rules = PURITY_RULES[direction]
  if (!rules) return
  const scanned = blankSection(page.content, '## 对应另一端')
  for (const [pattern, label] of rules) {
    const matched = pattern.exec(scanned)
    if (matched) {
      fail('C3', relative, lineOfOffset(scanned, matched.index), `方向不纯：出现${label}`, `${direction} 页只写本方向实现，对方内容放「## 对应另一端」链接`)
    }
  }
}

/* ------------------------------------------------------------------- C4 */

function outlineKnowledgeDomains(tree) {
  const set = new Set()
  for (const domain of tree.domains) {
    for (const kd of domain.learn) {
      if (kd.teach?.status === 'outline') set.add(normalizeLink(kd.url))
    }
  }
  return set
}

function checkKnowledgeIndex(page, relative, data, tree, outlines) {
  const list = data.knowledge_index
  if (!Array.isArray(list)) return
  if (list.length < 3) {
    fail('C4', relative, lineOfKey(page.raw, 'knowledge_index'), `knowledge_index 只有 ${list.length} 条`, '至少 3 条：page 指向知识点页或知识域入口')
  }
  const seen = new Set()
  for (const entry of list) {
    const target = typeof entry?.page === 'string' ? entry.page : ''
    const role = typeof entry?.role === 'string' ? entry.role : ''
    const line = lineOf(page.content, target) || lineOfKey(page.raw, 'knowledge_index')
    if (!target.startsWith('/')) {
      fail('C4', relative, line, `knowledge_index.page 必须以 / 开头：${target || '缺失'}`, '写站内绝对路径')
    } else if (!tree.linkMap[normalizeLink(target)] && !outlines.has(normalizeLink(target))) {
      fail('C4', relative, line, `knowledge_index 链接未命中：${target}`, '指向已存在页面，或未开写知识域的入口')
    }
    if (role.length < 10 || role.length > 80) {
      fail('C4', relative, line, `role 长度不合规：${role.length} 字`, 'role 保持 10–80 字')
    }
    if (seen.has(target)) {
      fail('C4', relative, line, `knowledge_index.page 重复：${target}`, '同一组件内 page 唯一')
    }
    seen.add(target)
  }
  if (list.length > 0 && !page.content.includes('<KnowledgeIndex')) {
    fail('C4', relative, lineOf(page.content, '## 依赖的知识域与知识点'), '正文没有渲染 <KnowledgeIndex />', '索引由组件按 frontmatter 渲染，作者不手写表格')
  }
}

/* ------------------------------------------------------------------- C5 */

function checkReuseManifest(page, relative, data, workspace, linkMap, pagesByUrl) {
  const declared = data.reuse_manifest
  if (!declared) return
  const manifestFile = path.join(workspace, String(declared))
  const line = lineOfKey(page.raw, 'reuse_manifest')
  if (!fs.existsSync(manifestFile)) {
    fail('C5', relative, line, `复用清单不存在：${declared}`, '建 reuse/<component>/manifest.json')
    return
  }
  let manifest = null
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  } catch (error) {
    fail('C5', relative, line, `复用清单 JSON 解析失败：${error.message}`, '修正 JSON 语法')
    return
  }
  const manifestRelative = String(declared)
  if (!/^\d+\.\d+\.\d+$/.test(String(manifest.contract_version ?? ''))) {
    fail('C5', relative, line, `contract_version 非法：${manifest.contract_version ?? '缺失'}`, '写语义化版本，如 1.0.0')
  }
  if (!linkMap[normalizeLink(String(manifest.page ?? ''))]) {
    fail('C5', relative, line, `清单 page 未命中链接表：${manifest.page ?? '缺失'}`, 'page 指向组件页 URL')
  } else {
    const primary = pagesByUrl.get(normalizeLink(String(manifest.page)))
    if (primary && primary.reuseManifest !== manifestRelative) {
      fail('C5', relative, line, `清单 page 指向的页面未声明本清单：${manifest.page}`, '让该页 reuse_manifest 指向同一份清单')
    }
  }
  const sides = manifest.sides ?? {}
  if (Object.keys(sides).length === 0) {
    fail('C5', relative, line, '清单 sides 为空', '至少给 backend 或 frontend 一侧')
  }
  const pageDirection = data.direction
  if (pageDirection && ['backend', 'frontend'].includes(pageDirection) && !sides[pageDirection]) {
    fail('C5', relative, line, `清单缺少本页方向：${pageDirection}`, `补 sides.${pageDirection}`)
  }
  for (const [side, detail] of Object.entries(sides)) {
    const prefix = `sides.${side}`
    if (!Array.isArray(detail?.files) || detail.files.length === 0) {
      fail('C5', relative, line, `${prefix}.files 为空`, '列出复制所需文件')
      continue
    }
    for (const file of detail.files) {
      const target = path.join(workspace, String(file?.path ?? ''))
      if (!file?.path || !fs.existsSync(target)) {
        fail('C5', relative, line, `${prefix} 文件不存在：${file?.path ?? '缺失'}`, '路径相对仓库根，且必须真实存在')
      }
    }
    if (!Array.isArray(detail.adaptation) || detail.adaptation.length === 0) {
      fail('C5', relative, line, `${prefix}.adaptation 为空`, '至少写一条适配点')
    }
    if (!Array.isArray(detail.verify) || detail.verify.length === 0) {
      fail('C5', relative, line, `${prefix}.verify 为空`, '至少写一条验收命令')
    } else {
      for (const item of detail.verify) {
        if (!item?.command || String(item.command).trim().length < 2) {
          fail('C5', relative, line, `${prefix}.verify 命令为空`, '写可执行的验收命令')
        }
      }
    }
    for (const dep of detail.external_deps ?? []) {
      const text = `${dep?.name ?? ''} ${dep?.install ?? ''}`
      if (/minilab\.uzibird\.cn|^dev\/|\.\.\//.test(text)) {
        fail('C5', relative, line, `${prefix}.external_deps 含本仓私有依赖：${dep?.name}`, '只列公开依赖')
      }
    }
  }
}

/* ------------------------------------------------------------------- C6 */

const BARE_ELEMENT = /^[a-zA-Z][a-zA-Z0-9-]*(?:$|[\s>+~,.:#[{])/

function styleSelectors(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const selectors = []
  for (const line of withoutComments.split('\n')) {
    const brace = line.indexOf('{')
    if (brace < 0) continue
    const head = line.slice(0, brace).trim()
    if (!head || head.startsWith('@')) continue
    for (const part of head.split(',')) {
      const selector = part.trim()
      if (selector) selectors.push(selector)
    }
  }
  return selectors
}

function checkStyleScope(rootDir) {
  const componentDir = path.join(rootDir, '.vitepress', 'theme', 'components')
  for (const file of listFiles(componentDir, '.vue')) {
    const relative = path.relative(REPO_ROOT, file).replace(/\\/g, '/')
    const raw = fs.readFileSync(file, 'utf8')
    for (const matched of raw.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)) {
      const attrs = matched[1]
      const body = matched[2]
      const scoped = /\bscoped\b/.test(attrs)
      const selectors = styleSelectors(body)
      const bare = selectors.filter((selector) => BARE_ELEMENT.test(selector))
      if (scoped) continue
      if (selectors.length === 0) {
        fail('C6', relative, lineOfOffset(raw, matched.index), '组件 <style> 既没有 scoped 也没有类前缀选择器', '补 scoped，或给选择器加组件类前缀')
        continue
      }
      for (const selector of bare) {
        fail('C6', relative, lineOfOffset(raw, matched.index), `组件样式出现裸标签选择器：${selector}`, '补 scoped，或改用组件类前缀')
      }
      const first = selectors[0] ?? ''
      if (!first.startsWith('.')) {
        fail('C6', relative, lineOfOffset(raw, matched.index), `组件样式缺少类前缀：${first}`, '选择器统一以组件类前缀开头，或补 scoped')
      }
    }
  }

  const customCss = path.join(rootDir, '.vitepress', 'theme', 'styles', 'custom.css')
  if (fs.existsSync(customCss)) {
    const relative = path.relative(REPO_ROOT, customCss).replace(/\\/g, '/')
    const css = fs.readFileSync(customCss, 'utf8')
    for (const selector of styleSelectors(css)) {
      if (BARE_ELEMENT.test(selector)) {
        fail('C6', relative, lineOf(css, selector), `custom.css 出现裸标签选择器：${selector}`, '加类前缀，例如 .vp-doc table')
      }
    }
  }
}

/* ------------------------------------------------------------------- C7 */

function checkCrossLink(parsed, node, relative, data, tree, pagesByUrl) {
  const target = data.cross_link
  if (!target) return
  const line = lineOfKey(parsed.raw, 'cross_link')
  const resolved = tree.linkMap[normalizeLink(String(target))]
  if (!resolved) {
    fail('C7', relative, line, `cross_link 未命中链接表：${target}`, '指向另一端组件页 URL')
    return
  }
  if (!parsed.content.includes('## 对应另一端')) {
    fail('C7', relative, line, '声明了 cross_link 但正文缺「## 对应另一端」', '补互链小节')
  }
  const counterpart = pagesByUrl.get(normalizeLink(String(target)))
  if (!counterpart) return
  const back = normalizeLink(String(counterpart.crossLink ?? ''))
  if (back !== normalizeLink(node.url)) {
    fail('C7', relative, line, `对方页面没有回链：${target}`, `让对方写 cross_link: ${node.url}`)
  }
}

/* ------------------------------------------------------------------ 主流程 */

/**
 * C9 对象层级：组件绑定的后端源码里若存在继承，页面 MUST 有「对象层级」节，
 * 且该节列出的子类名 MUST 能在源码中找到（宪法 XII 与 008 FR-017…FR-020）。
 */
function checkInheritance(root, parsed, relative) {
  const body = parsed.content ?? ''
  const manifestRel = (parsed.data ?? {}).reuse_manifest
  if (!manifestRel) return
  const manifestPath = path.join(root, manifestRel)
  if (!fs.existsSync(manifestPath)) return
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch {
    return
  }
  // 只扫该页方向对应的那一侧：前端页不应因同一清单里的后端文件而被要求写继承节。
  const direction = (parsed.data ?? {}).direction
  const sides = manifest.sides ?? {}
  const scoped = direction && sides[direction] ? { [direction]: sides[direction] } : sides
  const pyFiles = []
  for (const side of Object.values(scoped)) {
    for (const entry of side.files ?? []) {
      if (String(entry.path).endsWith('.py')) pyFiles.push(path.join(root, entry.path))
    }
  }
  const subclasses = new Set()
  for (const file of pyFiles) {
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const matched of text.matchAll(/^class\s+(\w+)\(([^)]+)\)/gm)) {
      const parents = matched[2].split(',').map((item) => item.trim())
      if (parents.some((parent) => parent && parent !== 'object')) subclasses.add(matched[1])
    }
  }
  if (subclasses.size === 0) return
  if (!/^##\s*对象层级/m.test(body)) {
    fail('C9', relative, 1, `源码存在 ${subclasses.size} 个继承类，但页面缺少「## 对象层级」节`, '补「对象层级」节：继承表与组合表分开列出（宪法 XII）')
    return
  }
  const section = body.split(/^##\s*对象层级/m)[1]?.split(/^##\s/m)[0] ?? ''
  const missing = [...subclasses].filter((name) => !section.includes(name))
  if (missing.length) {
    fail('C9', relative, 1, `对象层级节缺少子类：${missing.join('、')}`, '把源码里所有继承类登记进继承表')
  }
}

function main() {
  const args = process.argv.slice(2)
  const rootIndex = args.indexOf('--root')
  const rootArg = rootIndex >= 0 ? args[rootIndex + 1] : 'docs'
  const asJson = args.includes('--json')
  const rootDir = resolveRoot(rootArg)
  if (!fs.existsSync(rootDir)) {
    console.error(`[check-component] 内容目录不存在：${rootDir}`)
    process.exit(2)
  }
  const workspace = path.dirname(rootDir)
  const tree = buildDocTree(rootDir)
  const pagesByUrl = new Map(tree.pages.map((page) => [normalizeLink(page.url), page]))
  const outlines = outlineKnowledgeDomains(tree)

  const components = tree.pages.filter((page) => page.type === 'component' || page.type === 'cross-component')
  for (const page of components) {
    const file = path.join(rootDir, page.file)
    if (!fs.existsSync(file)) continue
    const parsed = readPage(file)
    checkMetadata(parsed, page.file)
    checkSections(parsed, page.file, parsed.data, rootDir)
    checkPurity(parsed, page.file, parsed.data)
    checkKnowledgeIndex(parsed, page.file, parsed.data, tree, outlines)
    checkReuseManifest(parsed, page.file, parsed.data, workspace, tree.linkMap, pagesByUrl)
    checkCrossLink(parsed, page, page.file, parsed.data, tree, pagesByUrl)
    checkInheritance(workspace, parsed, page.file)
  }
  checkStyleScope(rootDir)

  if (asJson) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings }, null, 2))
  } else {
    for (const item of errors) {
      console.log(`❌ [${item.code}] ${item.file}${item.line ? `:${item.line}` : ''} ${item.message} → 修法：${item.fix}`)
    }
    for (const item of warnings) {
      console.log(`⚠️ [${item.code}] ${item.file}${item.line ? `:${item.line}` : ''} ${item.message} → 建议：${item.fix}`)
    }
    console.log(`组件页 ${components.length} 个 / 错误 ${errors.length} 项 / 警告 ${warnings.length} 项`)
  }
  process.exit(errors.length === 0 ? 0 : 1)
}

try {
  main()
} catch (error) {
  console.error('[check-component] 脚本异常：', error)
  process.exit(2)
}
