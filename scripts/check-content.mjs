#!/usr/bin/env node
/**
 * check-content —— 内容机械门禁（V1–V18）。
 *
 * 用法：
 *   node --experimental-strip-types scripts/check-content.mjs [--root docs] [--json]
 *
 * 退出码：0 通过 / 1 存在错误 / 2 脚本自身异常。
 *
 * 单一事实源：页面模型与链接规则直接复用引擎的 doc-engine.ts，
 * 不做第二份扫描实现（宪法 I 与 engine-contract §2）。
 *
 * 规则编号对照（详见 specs/001-docs-engine/data-model.md 与
 * specs/002-content-orchestration/contracts/check-contract.md）：
 *   V1  目录元数据可解析且每级至多一份
 *   V2  页面 type 在白名单内
 *   V3  frontmatter 无未知字段
 *   V4  按类型必填字段齐全
 *   V5  url 全局唯一、同目录 slug 不重复
 *   V6  命名前缀（缺 NN- 给提示，不判错）
 *   V7  知识点页四段式必需小节齐全
 *   V8  组件页含安装命令、核心源码与至少三种引用方式
 *   V9  链接字段全部命中 linkMap
 *   V10 图解产物存在且自包含
 *   V11 领域两个入口页存在、kind 与 entry 一致、条目数与实际页面数一致
 *   V12 tags_index 非空且为小写短标签
 *   V13 结构化载荷可解析
 *   V14 枚举字段取值合法
 *   V15 知识域 teach 块字段齐全且类型正确
 *   V16 四教学要素标题存在，追问链条目 3–5 条
 *   V17 teach.lessons 与知识点页双向完整
 *   V18 教学要素内容非空
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import matter from 'gray-matter'
import { buildDocTree } from '../docs/.vitepress/plugins/doc-engine.ts'
import { parseSegment } from '../docs/.vitepress/shared/links.ts'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const TYPES = ['knowledge', 'component', 'cross-component', 'landing']
const LEVELS = ['basic', 'intermediate', 'advanced']
const COMPONENT_TYPES = ['library', 'framework', 'pattern', 'tool']
const REUSABILITY = ['high', 'medium', 'low']
const ENTRY_KINDS = ['domain', 'learn', 'components']

const COMMON_FIELDS = ['title', 'type', 'description']
const TYPE_FIELDS = {
  knowledge: [
    'domain', 'knowledge_domain', 'order', 'level', 'tags', 'source_module',
    'api_methods', 'prerequisites', 'related_knowledge', 'related_components',
  ],
  component: [
    'domain', 'order', 'component_type', 'install_command', 'depends_on_knowledge',
    'depends_on_components', 'related_components', 'tags_index', 'reusability',
  ],
  'cross-component': [
    'domain', 'order', 'depends_on', 'depends_on_components', 'install_command',
    'tags_index', 'reusability',
  ],
  landing: ['domain', 'entry'],
}
const REQUIRED_FIELDS = {
  knowledge: ['title', 'type', 'domain', 'knowledge_domain'],
  component: ['title', 'type', 'domain', 'component_type', 'install_command', 'tags_index'],
  'cross-component': ['title', 'type', 'domain', 'depends_on', 'install_command', 'tags_index'],
  landing: ['title', 'type', 'domain', 'entry'],
}
const LINK_FIELDS = [
  'prerequisites', 'related_knowledge', 'related_components',
  'depends_on_knowledge', 'depends_on_components',
]
const KNOWLEDGE_SECTIONS = [
  '## TL;DR', '## 概念定义', '## 原理图解', '## 关键对比',
  '## API 手册：', '## 组合用法：', '### 组合了哪些知识？', '### 数据流图解',
  '### 分步实现', '### 对比表格',
  '## 完整 Demo：', '### 场景描述', '### 完整代码', '### 运行方式',
  '### 面试追问链', '### 关联组件',
]
const TEACHING_ELEMENTS = [
  '### 本讲要解决的问题', '### 常见误区', '### 面试追问链', '### 下一讲衔接',
]

const SKIP_DIRS = new Set(['.vitepress', 'public', 'node_modules', '.git', 'diagrams'])

const errors = []
const warnings = []

function fail(code, file, line, message, fix) {
  errors.push({ code, file, line: line ?? 0, message, fix })
}
function warn(code, file, line, message, fix) {
  warnings.push({ code, file, line: line ?? 0, message, fix })
}

function rel(file) {
  return path.relative(REPO_ROOT, file).replace(/\\/g, '/')
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

function walkDirs(root) {
  const result = [root]
  for (const dir of listDirs(root)) result.push(...walkDirs(dir))
  return result
}

function readMeta(dir) {
  const file = path.join(dir, '_meta.yml')
  if (!fs.existsSync(file)) return { file, meta: null }
  try {
    const value = yaml.load(fs.readFileSync(file, 'utf8'))
    return { file, meta: value && typeof value === 'object' ? value : {} }
  } catch (error) {
    fail('V1', rel(file), error.mark?.line ? error.mark.line + 1 : 0,
      `_meta.yml 解析失败：${error.message}`, '修正 YAML 语法后重跑门禁')
    return { file, meta: null }
  }
}

function readPage(file) {
  const parsed = matter(fs.readFileSync(file, 'utf8'))
  return { data: parsed.data ?? {}, content: parsed.content ?? '' }
}

function normalizeSlug(value) {
  return path.basename(String(value)).replace(/\.md$/i, '').replace(/^\d+[-_]/, '')
}

function headingLines(content) {
  return content.split('\n').map((text, index) => ({ text: text.trim(), line: index + 1 }))
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

/* ------------------------------------------------------------------ 扫描 */

function scan(root) {
  const docs = path.join(REPO_ROOT, root)
  const metas = []
  const pages = []
  for (const dir of walkDirs(docs)) {
    const { file, meta } = readMeta(dir)
    if (meta) metas.push({ file, dir, meta })
    for (const md of listFiles(dir, '.md')) {
      if (SKIP_DIRS.has(path.basename(path.dirname(md)))) continue
      pages.push({ file: md, ...readPage(md) })
    }
  }
  return { docs, metas, pages }
}

function checkMetas(metas) {
  const counts = new Map()
  for (const { file } of metas) {
    const dir = path.dirname(file)
    counts.set(dir, (counts.get(dir) ?? 0) + 1)
  }
  for (const [dir, count] of counts) {
    if (count > 1) fail('V1', rel(dir), 0, '同一目录存在多份 _meta.yml', '只保留一份')
  }
}

function checkFrontmatter(page, tree) {
  const file = rel(page.file)
  // 站点首页用 layout: home，不属于任何领域，豁免类型约束
  if (file === 'docs/index.md') return
  const data = page.data
  const type = data.type
  if (!type) {
    fail('V2', file, 1, '缺少 frontmatter.type', '按 contracts/content-contract.md §3 补 type')
    return
  }
  if (!TYPES.includes(type)) {
    fail('V2', file, 1, `type 取值非法：${type}`, `允许值：${TYPES.join(' / ')}`)
    return
  }
  const allowed = new Set([...COMMON_FIELDS, ...TYPE_FIELDS[type]])
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) fail('V3', file, 1, `未知 frontmatter 字段：${key}`, '删除该字段或改为契约中的字段名')
  }
  for (const field of REQUIRED_FIELDS[type]) {
    const value = data[field]
    if (value === undefined || value === null || value === '') {
      fail('V4', file, 1, `缺少必填字段：${field}`, `按 ${type} 的必填字段补齐`)
    }
  }
  if (data.level && !LEVELS.includes(data.level)) {
    fail('V14', file, 1, `level 取值非法：${data.level}`, `允许值：${LEVELS.join(' / ')}`)
  }
  if (data.component_type && !COMPONENT_TYPES.includes(data.component_type)) {
    fail('V14', file, 1, `component_type 取值非法：${data.component_type}`, `允许值：${COMPONENT_TYPES.join(' / ')}`)
  }
  if (data.reusability && !REUSABILITY.includes(data.reusability)) {
    fail('V14', file, 1, `reusability 取值非法：${data.reusability}`, `允许值：${REUSABILITY.join(' / ')}`)
  }
  if (data.entry && !ENTRY_KINDS.includes(data.entry)) {
    fail('V14', file, 1, `entry 取值非法：${data.entry}`, `允许值：${ENTRY_KINDS.join(' / ')}`)
  }
  for (const field of LINK_FIELDS) {
    for (const link of data[field] ?? []) {
      if (!tree.linkMap[link.replace(/\.md$/, '')]) {
        const normalized = link.replace(/\.md$/, '').replace(/\/+$/, '')
        const hit = tree.linkMap[normalized] ?? tree.linkMap[normalized.replace(/^\//, '/')]
        if (!hit) fail('V9', file, 1, `链接未命中：${field} → ${link}`, '检查目标页面是否存在或路径是否写错')
      }
    }
  }
  if (type === 'component' || type === 'cross-component') {
    const tags = data.tags_index ?? []
    if (!Array.isArray(tags) || tags.length === 0) {
      fail('V12', file, 1, 'tags_index 为空', '至少给一个标签')
    } else {
      for (const tag of tags) {
        if (!/^[a-z0-9-]+$/.test(tag)) fail('V12', file, 1, `tags_index 非法标签：${tag}`, '只用小写字母、数字与连字符')
      }
    }
  }
  if (type === 'knowledge') {
    for (const section of KNOWLEDGE_SECTIONS) {
      const found = headingLines(page.content).some(({ text }) => text.startsWith(section))
      if (!found) {
        fail('V7', file, 1, `缺必需小节：${section}`, '按 contracts/content-contract.md §4 补齐四段式')
      }
    }
    checkTeachingElements(file, page.content)
  }
  if (type === 'component' || type === 'cross-component') checkComponentPage(file, page, data)
}

function checkTeachingElements(file, content) {
  for (const element of TEACHING_ELEMENTS) {
    if (!content.includes(element)) {
      fail('V16', file, 1, `缺教学要素：${element}`, '按 skill 的「每讲教学结构」补该小节')
    }
  }
  const chain = sectionBody(content, '### 面试追问链')
  if (chain) {
    const count = chain.filter((line) => line.includes('<details>')).length
    if (count < 3 || count > 5) {
      fail('V16', file, 1, `追问链条目数 ${count} 条`, '保持在 3–5 条，并让后一问依赖前一问')
    }
  }
  const problem = sectionBody(content, '### 本讲要解决的问题')
  if (problem && problem.filter((line) => line.trim()).length === 0) {
    fail('V18', file, 1, '「本讲要解决的问题」没有正文', '写 2–4 句说明这一讲解决什么')
  }
  const pitfalls = sectionBody(content, '### 常见误区')
  if (pitfalls) {
    const items = pitfalls.filter((line) => /^\s*([-*]|\d+\.)\s+\S/.test(line))
    if (items.length === 0) fail('V18', file, 1, '「常见误区」没有列表项', '至少写 2 条错误说法与纠正')
  }
  const next = sectionBody(content, '### 下一讲衔接')
  if (next) {
    const hasLink = next.some((line) => /\]\(\/[^)]+\)/.test(line))
    if (!hasLink) fail('V18', file, 1, '「下一讲衔接」没有页面链接', '至少给一个指向下一讲的链接')
  }
}

function checkComponentPage(file, page, data) {
  if (!data.install_command) {
    fail('V8', file, 1, '缺少 install_command', '在 frontmatter 写安装命令')
  }
  if (!page.content.includes('## 核心源码')) {
    fail('V8', file, 1, '缺「## 核心源码」小节', '补完整可复制源码')
  }
  const ways = (page.content.match(/^###\s*方式[一二三]/gm) ?? []).length
  if (ways < 3) {
    fail('V8', file, 1, `引用方式只有 ${ways} 种`, '按契约给出至少三种引用方式')
  }
}

function checkNaming(pages) {
  for (const page of pages) {
    const base = path.basename(page.file, '.md')
    if (/^(index|readme)$/i.test(base)) continue
    if (!/^\d+[-_]/.test(base)) {
      warn('V6', rel(page.file), 0, '文件名缺少 NN- 前缀', '排序依赖前缀，建议补上')
    }
  }
}

function checkUniqueUrls(tree, pages) {
  const seen = new Map()
  for (const page of tree.pages) {
    if (seen.has(page.url)) {
      fail('V5', page.file, 0, `url 冲突：${page.url}`, `与 ${seen.get(page.url)} 重名，改名或改前缀`)
    } else {
      seen.set(page.url, page.file)
    }
  }
  const byDir = new Map()
  for (const page of pages) {
    const dir = path.dirname(page.file)
    const slug = normalizeSlug(page.file)
    const key = `${dir}::${slug}`
    if (byDir.has(key)) {
      fail('V5', rel(page.file), 0, `同目录 slug 重复：${slug}`, `与 ${byDir.get(key)} 冲突`)
    } else {
      byDir.set(key, rel(page.file))
    }
  }
}

function checkDiagrams(root, tree) {
  const docs = path.join(REPO_ROOT, root)
  for (const page of tree.pages) {
    const content = fs.readFileSync(path.join(docs, page.file), 'utf8')
    const refs = [...content.matchAll(/<DiagramFrame[^>]*src=["']([^"']+)["']/g)].map((matched) => matched[1])
    if (refs.length === 0) {
      fail('V10', page.file, 0, '页面没有引用任何图解', '在「## 原理图解」放一个 DiagramFrame')
      continue
    }
    for (const src of refs) {
      const file = path.join(docs, 'public', src.replace(/^\//, ''))
      if (!fs.existsSync(file)) {
        fail('V10', page.file, 0, `图解产物缺失：${src}`, '先跑 bash scripts/gen-diagrams.sh 生成产物')
        continue
      }
      const html = fs.readFileSync(file, 'utf8')
      if (/(?:src|href)=["']https?:\/\//i.test(html)) {
        fail('V10', page.file, 0, `图解含外部资源：${src}`, '图解必须自包含，可离线交互')
      }
    }
  }
}

function checkEntryPages(root, tree) {
  const docs = path.join(REPO_ROOT, root)
  for (const domain of tree.domains) {
    const entries = [
      ['learn', path.join(docs, domain.slug, 'learn', 'index.md')],
      ['components', path.join(docs, domain.slug, 'components', 'index.md')],
    ]
    for (const [kind, file] of entries) {
      if (!fs.existsSync(file)) {
        fail('V11', rel(file), 0, `领域缺 ${kind} 入口页`, '按契约建入口页并写 entry frontmatter')
        continue
      }
      const { data, content } = readPage(file)
      if (data.entry !== kind) {
        fail('V11', rel(file), 1, `entry 与目录不符：${data.entry ?? '缺失'}`, `改为 entry: ${kind}`)
      }
      if (!content.includes(`<EntryIndex kind="${kind}"`)) {
        fail('V11', rel(file), 1, '入口页缺少 EntryIndex 组件', `补 <EntryIndex kind="${kind}" />`)
      }
      if (kind === 'components') {
        const declared = Number((content.match(/条目数[:：]\s*(\d+)/) ?? [])[1] ?? NaN)
        if (Number.isFinite(declared) && declared !== domain.components.length) {
          fail('V11', rel(file), 1, `入口页条目数 ${declared} 与实际 ${domain.components.length} 不一致`, '索引由引擎生成，不要手写条目数')
        }
      }
    }
  }
}

function checkTeachBlocks(metas, tree) {
  for (const { file, meta } of metas) {
    const isKnowledgeDomain = /\/learn\/\d+-[^/]+\/_meta\.yml$/.test(rel(file))
    if (!isKnowledgeDomain) {
      if (meta.teach) fail('V15', rel(file), 0, '非知识域目录出现 teach 块', 'teach 只写在知识域 _meta.yml')
      continue
    }
    const teach = meta.teach
    if (!teach) {
      fail('V15', rel(file), 0, '知识域缺少 teach 块', '按 data-model.md E2 补 audience/prerequisites/outcomes/path/lessons')
      continue
    }
    const misses = []
    if (typeof teach.audience !== 'string' || teach.audience.length < 10) misses.push('audience')
    if (!Array.isArray(teach.prerequisites) || teach.prerequisites.length < 1) misses.push('prerequisites')
    if (!Array.isArray(teach.outcomes) || teach.outcomes.length < 1) misses.push('outcomes')
    if (!Array.isArray(teach.path) || teach.path.length < 1) misses.push('path')
    if (!Array.isArray(teach.lessons) || teach.lessons.length < 1) misses.push('lessons')
    if (misses.length) {
      fail('V15', rel(file), 0, `teach 块缺字段或类型不符：${misses.join('、')}`, '按 data-model.md E2 的约束补齐')
      continue
    }
    for (const lesson of teach.lessons) {
      if (typeof lesson.goal !== 'string' || lesson.goal.length < 10 || lesson.goal.length > 60) {
        fail('V15', rel(file), 0, `lessons.goal 长度不合规：${lesson.slug}`, 'goal 保持 10–60 字')
      }
    }
    // 目录形如 docs/<domain>/learn/<NN-knowledge-domain>/_meta.yml
    const parts = rel(file).split('/')
    const domainSlug = parseSegment(parts[1]).slug
    const kdSlug = parseSegment(parts[3]).slug
    const pages = tree.pages.filter(
      (page) => page.type === 'knowledge' && page.domain === domainSlug && page.knowledgeDomain === kdSlug,
    )
    const declared = new Set(teach.lessons.map((lesson) => normalizeSlug(lesson.slug)))
    const actual = new Set(pages.map((page) => page.slug))
    for (const slug of declared) {
      if (!actual.has(slug)) {
        fail('V17', rel(file), 0, `lessons 指向不存在的页面：${slug}`, '删除幽灵条目或补页面')
      }
    }
    for (const slug of actual) {
      if (!declared.has(slug)) {
        fail('V17', rel(file), 0, `页面未登记进 lessons：${slug}`, '在 teach.lessons 补一条 slug 与 goal')
      }
    }
  }
}

function checkPayloads(pages) {
  const entity = (text) =>
    text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
  for (const page of pages) {
    const content = page.content
    for (const matched of content.matchAll(/<(ApiTable|CodeTabs)\s+:(items|tabs)='([^']*)'\s*\/>/g)) {
      const [, component, , payload] = matched
      try {
        JSON.parse(entity(payload))
      } catch (error) {
        fail('V13', rel(page.file), 0, `${component} 载荷无法解析：${error.message}`, '用脚手架或校验器重新生成载荷')
      }
    }
  }
}

/* ------------------------------------------------------------------ 主流程 */

function main() {
  const args = process.argv.slice(2)
  const rootIndex = args.indexOf('--root')
  const root = rootIndex >= 0 ? args[rootIndex + 1] : 'docs'
  const asJson = args.includes('--json')

  const { docs, metas, pages } = scan(root)
  if (!fs.existsSync(docs)) {
    console.error(`[check-content] 内容目录不存在：${docs}`)
    process.exit(2)
  }
  const tree = buildDocTree(docs)

  checkMetas(metas)
  checkNaming(pages)
  checkUniqueUrls(tree, pages)
  for (const page of pages) checkFrontmatter(page, tree)
  checkDiagrams(root, tree)
  checkEntryPages(root, tree)
  checkTeachBlocks(metas, tree)
  checkPayloads(pages)

  if (asJson) {
    console.log(JSON.stringify({
      ok: errors.length === 0,
      errors,
      warnings,
      stats: {
        domains: tree.domains.length,
        knowledgeDomains: tree.domains.reduce((sum, domain) => sum + domain.learn.length, 0),
        pages: tree.pages.length,
        components: tree.domains.reduce((sum, domain) => sum + domain.components.length, 0),
        diagrams: fs.existsSync(path.join(docs, 'public', 'diagrams'))
          ? fs.readdirSync(path.join(docs, 'public', 'diagrams')).filter((name) => name.endsWith('.html')).length
          : 0,
      },
    }, null, 2))
  } else {
    for (const item of errors) {
      console.log(`❌ [${item.code}] ${item.file}${item.line ? `:${item.line}` : ''} ${item.message} → 修法：${item.fix}`)
    }
    for (const item of warnings) {
      console.log(`⚠️ [${item.code}] ${item.file}${item.line ? `:${item.line}` : ''} ${item.message} → 建议：${item.fix}`)
    }
    console.log(`错误 ${errors.length} 项 / 警告 ${warnings.length} 项`)
  }
  process.exit(errors.length === 0 ? 0 : 1)
}

try {
  main()
} catch (error) {
  console.error('[check-content] 脚本异常：', error)
  process.exit(2)
}
