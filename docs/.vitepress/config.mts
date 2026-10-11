/**
 * 站点配置：导航与侧边栏全部由 doc-engine 扫出的文档树生成。
 * 新增领域 / 知识域 / 知识点 / 组件都不需要改本文件。
 */
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'
import { buildDocTree, docEngine, normalizeLink, type DomainNode, type KnowledgeDomainNode } from './plugins/doc-engine'
import { cmpSplit } from './plugins/cmp-split'

const docsRoot = fileURLToPath(new URL('..', import.meta.url))
const tree = buildDocTree(docsRoot)

// 路由重写：源文件带 NN- 前缀（排序用），URL 去掉前缀（读者用）。
// 例：backend/learn/01-concurrency/01-thread-basics -> backend/learn/concurrency/thread-basics
const rewrites: Record<string, string> = {}
for (const page of tree.pages) {
  rewrites[page.file] = page.url.replace(/^\//, '') + '.md'
}

function kdItems(kd: KnowledgeDomainNode) {
  const items: any[] = kd.pages.map((page) => ({ text: page.title, link: page.url }))
  for (const sub of kd.subtopics) {
    items.push({
      text: `${sub.icon} ${sub.name}`,
      collapsed: false,
      items: sub.pages.map((page) => ({ text: page.title, link: page.url })),
    })
  }
  return items
}

function learnGroup(domain: DomainNode, only?: KnowledgeDomainNode) {
  const knowledgeDomains = only ? [only] : domain.learn
  const items: any[] = []
  if (!only && domain.entry.learn) items.push({ text: '① 学习入口与路径', link: domain.entry.learn })
  for (const kd of knowledgeDomains) {
    items.push({ text: `${kd.icon} ${kd.name}`, collapsed: false, items: kdItems(kd) })
  }
  return { text: '📚 渐进式学习', collapsed: false, items }
}

function componentGroup(domain: DomainNode) {
  const items: any[] = []
  if (domain.components.length && domain.entry.components) items.push({ text: '组件索引', link: domain.entry.components })
  for (const page of domain.components) items.push({ text: `🧩 ${page.title}`, link: page.url })
  for (const page of domain.crossComponents) items.push({ text: `🔗 ${page.title}`, link: page.url })
  if (!items.length) return null
  return { text: '🧩 组件查询', collapsed: false, items }
}

const sidebar: Record<string, any> = {}
for (const domain of tree.domains) {
  const full = [
    { text: `${domain.icon} ${domain.name}`, items: [{ text: '领域首页（双入口）', link: domain.url }] },
    learnGroup(domain),
    componentGroup(domain),
  ].filter(Boolean)
  sidebar[`/${domain.slug}/`] = full
  // 作用域侧边栏：进入某知识域时只展开该域（页面上千也保持可读）
  for (const kd of domain.learn) {
    sidebar[`/${domain.slug}/learn/${kd.slug}/`] = [
      {
        text: `${domain.icon} ${domain.name}`,
        items: [
          { text: '领域首页', link: domain.url },
          ...(domain.entry.learn ? [{ text: '学习入口', link: domain.entry.learn }] : []),
        ],
      },
      { text: `${kd.icon} ${kd.name}`, collapsed: false, items: kdItems(kd) },
      componentGroup(domain),
    ].filter(Boolean)
  }
}

export default defineConfig({
  lang: 'zh-CN',
  title: '技术面试备考文档引擎',
  description: '声明式目录 + 元数据驱动：渐进式学习与组件查询',
  cleanUrls: true,
  rewrites,
  // URL 由解析层生成（逐段去掉 NN- 前缀），VitePress 自带的映射规则认不出这些路径。
  // 断链检查改由 scripts/check-content.mjs 用同一份 linkMap 判定，见 FR-017 / FR-034。
  ignoreDeadLinks: true,
  srcExclude: ['**/README.md'],
  lastUpdated: false,
  head: [['meta', { name: 'theme-color', content: '#3b6ef6' }]],
  markdown: {
    config: (md) => {
      md.use(cmpSplit)
    },
  },
  vite: {
    plugins: [docEngine(docsRoot)],
    server: { host: '0.0.0.0' },
  },
  transformPageData(pageData) {
    const rel = pageData.relativePath.replace(/\.md$/, '')
    const url = normalizeLink('/' + rel)
    const node = tree.pages.find((page) => page.url === url)
    const frontmatter: any = (pageData.frontmatter ??= {})
    if (node) {
      frontmatter.pageModel = node
      if (!frontmatter.title) frontmatter.title = node.title
      if (node.level) frontmatter.level ??= node.level
    }
    if (!frontmatter.description && node?.description) frontmatter.description = node.description
    // 布局切换：组件页是双栏（正文 + 引用方式），关掉默认右栏目录避免三栏拥挤
    if (node && (node.type === 'component' || node.type === 'cross-component')) frontmatter.outline ??= false
  },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      ...tree.domains.map((domain) => ({
        text: `${domain.icon} ${domain.name}`,
        link: domain.url,
        activeMatch: `^/${domain.slug}/`,
      })),
    ],
    sidebar,
    outline: { level: [2, 3], label: '本页目录' },
    search: { provider: 'local' },
    docFooter: { prev: '上一页', next: '下一页' },
    darkModeSwitchLabel: '外观',
    sidebarMenuLabel: '目录',
    returnToTopLabel: '回到顶部',
    footer: {
      message: '内容为受控中文（asd-ste100-skill-zh 规则），图解由 Archify 生成',
      copyright: 'docs-1 · docs1.minilab.uzibird.cn',
    },
  },
})
