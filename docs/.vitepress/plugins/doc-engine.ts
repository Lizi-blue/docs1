/**
 * doc-engine —— 声明式文档引擎的解析层。
 *
 * 职责（只做三件事）：
 *   1. scanDir(root)          递归扫描目录，读取每级 _meta.yml
 *   2. buildPageModel(tree)   合并目录元数据 + 页面 frontmatter，得到页面模型
 *   3. generateVirtualModule  产出虚拟模块 `virtual:doc-tree`，供主题与侧边栏消费
 *
 * 约定（内容作者只需要遵守这些）：
 *   · 目录/文件名 `NN-前缀` 决定排序；去掉前缀即 URL 片段
 *   · `learn/` 放渐进式学习，`components/` 放组件，二者是领域下的两个入口
 *   · 目录级 `_meta.yml` 声明名称/图标/顺序/描述/学习路径
 *   · 页面 frontmatter 声明 type（knowledge / component / cross-component）
 *
 * 新增领域不需要改本文件、也不需要改任何配置。
 */
import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import matter from 'gray-matter'
import type { Plugin } from 'vite'
// 显式带扩展名：Node 侧（scripts/check-content.mjs）也要直接加载本文件。
import { isIndexSegment, normalizeLink, parseSegment, urlFromSegments } from '../shared/links.ts'

export type PageType = 'knowledge' | 'component' | 'cross-component' | 'landing'

export interface PathStep {
  from?: string
  to?: string
  label?: string
}

export interface DirMeta {
  name?: string
  icon?: string
  order?: number
  description?: string
  entry_type?: string
  prerequisites?: string[]
  path?: PathStep[]
}

export interface PageNode {
  file: string
  url: string
  slug: string
  order: number
  type: PageType
  title: string
  description?: string
  level?: string
  tags: string[]
  domain: string
  domainName: string
  domainIcon: string
  knowledgeDomain?: string
  knowledgeDomainName?: string
  knowledgeDomainIcon?: string
  knowledgeDomainUrl?: string
  subtopic?: string
  prerequisites: string[]
  relatedKnowledge: string[]
  relatedComponents: string[]
  sourceModule?: string
  apiMethods: string[]
  componentType?: string
  installCommand?: string
  dependsOnKnowledge: string[]
  dependsOnComponents: string[]
  tagsIndex: string[]
  reusability?: string
}

export interface KnowledgeDomainNode {
  slug: string
  name: string
  icon: string
  order: number
  description?: string
  prerequisites: string[]
  path: PathStep[]
  url: string
  pages: PageNode[]
  subtopics: { slug: string; name: string; icon: string; order: number; pages: PageNode[] }[]
}

export interface DomainNode {
  slug: string
  name: string
  icon: string
  order: number
  description?: string
  url: string
  entry: { learn?: string; components?: string }
  learn: KnowledgeDomainNode[]
  components: PageNode[]
  crossComponents: PageNode[]
}

export interface DocTree {
  domains: DomainNode[]
  pages: PageNode[]
  /** 规范化链接 -> 实际 URL；作者写 /backend/learn/01-concurrency/01-thread-basics 也能命中 */
  linkMap: Record<string, string>
  backlinks: Record<string, { reusedByComponents: string[]; usedKnowledge: string[]; componentsOf: string[] }>
  warnings: string[]
}

const SKIP_DIRS = new Set(['.vitepress', 'public', 'node_modules', '.git', 'diagrams'])
const SKIP_FILES = new Set(['README.md'])

/* ------------------------------------------------------------------ 基础工具 */

function readYaml(file: string): DirMeta {
  if (!fs.existsSync(file)) return {}
  try {
    const value = yaml.load(fs.readFileSync(file, 'utf8'))
    return value && typeof value === 'object' ? (value as DirMeta) : {}
  } catch (error) {
    throw new Error(`_meta.yml 解析失败：${file}\n${(error as Error).message}`)
  }
}

function isIndexFile(file: string): boolean {
  // 注意：isIndexSegment 判断的是不含扩展名的路径片段
  return isIndexSegment(path.basename(file, '.md'))
}

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
}

function listMarkdown(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !SKIP_FILES.has(entry.name))
    .map((entry) => entry.name)
}

/** URL：逐段去掉数字前缀；入口目录 learn/components 保留 */
export function toUrl(file: string, docsRoot: string): string {
  const rel = path.relative(docsRoot, file).replace(/\\/g, '/').replace(/\.md$/, '')
  return urlFromSegments(rel.split('/').filter(Boolean))
}

export { normalizeLink }

/* ------------------------------------------------------------------ 扫描与建模 */

interface FileEntry {
  file: string
  order: number
  slug: string
  front: Record<string, any>
  title: string
}

function readPage(file: string, docsRoot: string, warnings: string[]): FileEntry {
  const raw = fs.readFileSync(file, 'utf8')
  const parsed = matter(raw)
  const data = (parsed.data || {}) as Record<string, any>
  const firstHeading = /^#\s+(.+)$/m.exec(parsed.content)?.[1]?.trim()
  if (!data.title && !firstHeading) warnings.push(`缺标题（frontmatter title 与一级标题都没有）：${path.relative(docsRoot, file)}`)
  const base = parseSegment(path.basename(file, '.md'))
  return {
    file,
    order: typeof data.order === 'number' ? data.order : base.order ?? 999,
    slug: base.slug === 'index' ? '' : base.slug,
    front: data,
    title: data.title || firstHeading || base.slug,
  }
}

function resolveType(front: Record<string, any>, relPath: string): PageType {
  if (front.type) return front.type as PageType
  const parts = relPath.split('/')
  if (parts[0] === 'cross-domain') return 'cross-component'
  if (parts.includes('components')) return 'component'
  if (parts.includes('learn')) return 'knowledge'
  return 'landing'
}

function toPageNode(
  entry: FileEntry,
  ctx: {
    docsRoot: string
    domain: { slug: string; name: string; icon: string }
    knowledgeDomain?: { slug: string; name: string; icon: string; url: string }
    subtopic?: string
  },
  warnings: string[],
): PageNode {
  const front = entry.front
  const rel = path.relative(ctx.docsRoot, entry.file).replace(/\\/g, '/')
  const type = resolveType(front, rel)
  if (!front.type) warnings.push(`缺 frontmatter.type（按目录推断为 ${type}）：${rel}`)
  const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : value ? [String(value)] : [])
  const dependsOn: Record<string, string[]> = front.depends_on && typeof front.depends_on === 'object' ? front.depends_on : {}
  return {
    file: rel,
    url: toUrl(entry.file, ctx.docsRoot),
    slug: entry.slug,
    order: entry.order,
    type,
    title: entry.title,
    description: front.description,
    level: front.level,
    tags: list(front.tags),
    domain: ctx.domain.slug,
    domainName: ctx.domain.name,
    domainIcon: ctx.domain.icon,
    knowledgeDomain: ctx.knowledgeDomain?.slug,
    knowledgeDomainName: ctx.knowledgeDomain?.name,
    knowledgeDomainIcon: ctx.knowledgeDomain?.icon,
    knowledgeDomainUrl: ctx.knowledgeDomain?.url,
    subtopic: ctx.subtopic,
    prerequisites: list(front.prerequisites),
    relatedKnowledge: list(front.related_knowledge),
    relatedComponents: list(front.related_components),
    sourceModule: front.source_module,
    apiMethods: list(front.api_methods),
    componentType: front.component_type,
    installCommand: front.install_command,
    dependsOnKnowledge: [...list(front.depends_on_knowledge), ...list(dependsOn.backend), ...list(dependsOn.frontend)],
    dependsOnComponents: list(front.depends_on_components),
    tagsIndex: list(front.tags_index),
    reusability: front.reusability,
  }
}

function sortByOrder<T extends { order: number | null; slug: string }>(items: T[]): T[] {
  return items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.slug.localeCompare(b.slug))
}

/** 知识点排序：order 优先，其次文件名 */
function sortPages(pages: PageNode[]): PageNode[] {
  return pages.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
}

function buildDomain(docsRoot: string, dirName: string, warnings: string[]): DomainNode | null {
  const dir = path.join(docsRoot, dirName)
  if (dirName === 'cross-domain' || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null
  const meta = readYaml(path.join(dir, '_meta.yml'))
  const segment = parseSegment(dirName)
  const domain = {
    slug: segment.slug,
    name: meta.name || segment.slug,
    icon: meta.icon || '📘',
    order: meta.order ?? segment.order ?? 999,
    url: `/${segment.slug}/`,
  }

  const learn: KnowledgeDomainNode[] = []
  const learnDir = path.join(dir, 'learn')
  for (const kdName of sortByOrder(
    listDirs(learnDir).map((name) => {
      const seg = parseSegment(name)
      const kdMeta = readYaml(path.join(learnDir, name, '_meta.yml'))
      return { name, slug: seg.slug, order: kdMeta.order ?? seg.order ?? 999 }
    }),
  )) {
    const kdDir = path.join(learnDir, kdName.name)
    const kdMeta = readYaml(path.join(kdDir, '_meta.yml'))
    const kdSlug = kdName.slug
    const kdCtx = {
      slug: kdSlug,
      name: kdMeta.name || kdSlug,
      icon: kdMeta.icon || '⚡',
      url: `/${segment.slug}/learn/${kdSlug}/`,
    }
    const pages: PageNode[] = []
    const subtopics: KnowledgeDomainNode['subtopics'] = []
    for (const file of listMarkdown(kdDir)) {
      if (isIndexFile(file)) continue
      pages.push(toPageNode(readPage(path.join(kdDir, file), docsRoot, warnings), { docsRoot, domain, knowledgeDomain: kdCtx }, warnings))
    }
    for (const sub of sortByOrder(
      listDirs(kdDir).map((name) => {
        const seg = parseSegment(name)
        const subMeta = readYaml(path.join(kdDir, name, '_meta.yml'))
        return { name, slug: seg.slug, order: subMeta.order ?? seg.order ?? 999 }
      }),
    )) {
      const subDir = path.join(kdDir, sub.name)
      const subMeta = readYaml(path.join(subDir, '_meta.yml'))
      const subPages = listMarkdown(subDir)
        .filter((file) => !isIndexFile(file))
        .map((file) => toPageNode(readPage(path.join(subDir, file), docsRoot, warnings), { docsRoot, domain, knowledgeDomain: kdCtx, subtopic: sub.slug }, warnings))
      if (!subPages.length) continue
      subtopics.push({
        slug: sub.slug,
        name: subMeta.name || sub.slug,
        icon: subMeta.icon || '📎',
        order: sub.order,
        pages: sortPages(subPages),
      })
    }
    learn.push({
      slug: kdSlug,
      name: kdCtx.name,
      icon: kdCtx.icon,
      order: kdName.order,
      description: kdMeta.description,
      prerequisites: kdMeta.prerequisites || [],
      path: (kdMeta.path as PathStep[]) || [],
      url: kdCtx.url,
      pages: sortPages(pages),
      subtopics: subtopics.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug)),
    })
  }

  const components: PageNode[] = []
  const componentsDir = path.join(dir, 'components')
  for (const file of listMarkdown(componentsDir)) {
    if (isIndexFile(file)) continue
    components.push(toPageNode(readPage(path.join(componentsDir, file), docsRoot, warnings), { docsRoot, domain }, warnings))
  }

  return {
    slug: domain.slug,
    name: domain.name,
    icon: domain.icon,
    order: domain.order,
    description: meta.description,
    url: domain.url,
    entry: {
      learn: fs.existsSync(path.join(learnDir, 'index.md')) ? `${domain.url}learn/` : undefined,
      components: fs.existsSync(path.join(componentsDir, 'index.md')) ? `${domain.url}components/` : undefined,
    },
    learn,
    components: sortPages(components),
    crossComponents: [],
  }
}

/** 扫描 + 建模：返回完整文档树、扁平页面索引与反向链接 */
export function buildDocTree(docsRoot: string): DocTree {
  const warnings: string[] = []
  const domains: DomainNode[] = []
  for (const dirName of sortByOrder(
    listDirs(docsRoot).map((name) => {
      const seg = parseSegment(name)
      const meta = readYaml(path.join(docsRoot, name, '_meta.yml'))
      return { name, slug: seg.slug, order: meta.order ?? seg.order ?? 999 }
    }),
  )) {
    const built = buildDomain(docsRoot, dirName.name, warnings)
    if (built) domains.push(built)
  }
  domains.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))

  const crossDir = path.join(docsRoot, 'cross-domain')
  const crossComponents = listMarkdown(crossDir)
    .filter((file) => !isIndexFile(file))
    .map((file) =>
      toPageNode(readPage(path.join(crossDir, file), docsRoot, warnings), { docsRoot, domain: { slug: 'cross-domain', name: '跨领域组件', icon: '🔗' } }, warnings),
    )
  if (crossComponents.length) {
    domains.push({
      slug: 'cross-domain',
      name: readYaml(path.join(crossDir, '_meta.yml')).name || '跨领域组件',
      icon: readYaml(path.join(crossDir, '_meta.yml')).icon || '🔗',
      order: 900,
      description: readYaml(path.join(crossDir, '_meta.yml')).description,
      url: '/cross-domain/',
      entry: { components: fs.existsSync(path.join(crossDir, 'index.md')) ? '/cross-domain/' : undefined },
      learn: [],
      components: [],
      crossComponents,
    })
  }

  const pages = domains.flatMap((domain) => [
    ...domain.learn.flatMap((kd) => [...kd.pages, ...kd.subtopics.flatMap((sub) => sub.pages)]),
    ...domain.components,
    ...domain.crossComponents,
  ])

  // 规范化链接表 + 反向链接（知识点 ↔ 组件双向可达）
  const linkMap: Record<string, string> = {}
  for (const page of pages) linkMap[page.url] = page.url
  for (const page of pages) linkMap[normalizeLink(page.url)] = page.url

  const backlinks: DocTree['backlinks'] = {}
  const touch = (url: string) => (backlinks[url] ??= { reusedByComponents: [], usedKnowledge: [], componentsOf: [] })
  for (const page of pages) {
    if (page.type === 'knowledge') {
      for (const component of pages.filter((candidate) => candidate.type !== 'knowledge')) {
        if (component.dependsOnKnowledge.map(normalizeLink).includes(normalizeLink(page.url))) {
          touch(page.url).reusedByComponents.push(component.url)
        }
      }
    } else {
      touch(page.url).usedKnowledge.push(...page.dependsOnKnowledge)
      touch(page.url).componentsOf.push(...page.dependsOnComponents)
    }
  }
  for (const page of pages) {
    for (const link of [...page.prerequisites, ...page.relatedKnowledge, ...page.relatedComponents, ...page.dependsOnKnowledge, ...page.dependsOnComponents]) {
      if (!linkMap[normalizeLink(link)]) warnings.push(`链接未命中：${page.file} → ${link}`)
    }
  }
  return { domains, pages, linkMap, backlinks, warnings }
}

/* ------------------------------------------------------------------ 虚拟模块 */

export const VIRTUAL_MODULE_ID = 'virtual:doc-tree'
const RESOLVED_ID = '\0' + VIRTUAL_MODULE_ID

export function docEngine(docsRoot: string): Plugin {
  return {
    name: 'docs-1:doc-engine',
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_ID
    },
    load(id) {
      if (id !== RESOLVED_ID) return
      const tree = buildDocTree(docsRoot)
      if (tree.warnings.length && process.env.NODE_ENV !== 'production') {
        for (const warning of tree.warnings) console.warn(`[doc-engine] ${warning}`)
      }
      return `export const docTree = ${JSON.stringify(tree)}\nexport default docTree\n`
    },
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(docsRoot) || !/\.(md|yml|yaml)$/.test(file)) return
      const module = server.moduleGraph.getModuleById(RESOLVED_ID)
      if (module) server.moduleGraph.invalidateModule(module)
      server.ws.send({ type: 'full-reload' })
    },
  }
}
