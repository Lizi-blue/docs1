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

const levelBadge: Record<string, string> = { basic: '基础', intermediate: '进阶', advanced: '深入' }

/** 层级编号：知识域 1 → 讲 1.1 → 子主题 1.1.1 */
function kdItems(kd: KnowledgeDomainNode, kdIndex: number, fallbackLink?: string) {
  const items: any[] = []
  kd.pages.forEach((page, index) => {
    const suffix = page.level ? ` · ${levelBadge[page.level] ?? page.level}` : ''
    // 第三层：页内 H3 分组（1.1.1 起），让「某个包怎么用」有独立层级
    const groups = (page.outline ?? []).filter((item) => item.level === 3)
    items.push({
      text: `${kdIndex}.${index + 1} ${page.title}${suffix}`,
      link: page.url,
      // 默认展开到 x.x；页内方法组（x.x.x）默认折叠。
      collapsed: true,
      items: groups.map((group, groupIndex) => ({
        text: `${kdIndex}.${index + 1}.${groupIndex + 1} ${group.text}`,
        link: `${page.url}#${group.slug}`,
      })),
    })
  })
  kd.subtopics.forEach((sub, subIndex) => {
    items.push({
      text: `${sub.icon} ${kdIndex}.${subIndex + 1} ${sub.name}`,
      // 子主题同理：x.x 可见，x.x.x 折叠。
      collapsed: true,
      items: sub.pages.map((page, pageIndex) => ({
        text: `${kdIndex}.${subIndex + 1}.${pageIndex + 1} ${page.title}`,
        link: page.url,
      })),
    })
  })
  if (kd.teach?.status === 'outline' || items.length === 0) {
    // 未开写知识域没有 index.md，直接指向域学习入口，避免 404
    items.push(fallbackLink ? { text: '待补：内容尚未开写', link: fallbackLink } : { text: '待补：内容尚未开写' })
  }
  return items
}

function learnGroup(domain: DomainNode, only?: KnowledgeDomainNode) {
  const knowledgeDomains = only ? [only] : domain.learn
  const items: any[] = []
  if (!only && domain.entry.learn) items.push({ text: '① 学习入口与路径', link: domain.entry.learn })
  knowledgeDomains.forEach((kd, index) => {
    const number = only ? domain.learn.indexOf(kd) + 1 : index + 1
    const outline = kd.teach?.status === 'outline' ? '（待补）' : ''
    items.push({
      text: `${kd.icon} ${number}. ${kd.name}${outline}`,
      collapsed: false,
      items: kdItems(kd, number, domain.entry.learn),
    })
  })
  return { text: '📚 渐进式学习', collapsed: false, items }
}

function componentEntry(page: { title: string; url: string; outline?: { level: number; text: string; slug: string }[] }, icon: string) {
  const groups = (page.outline ?? []).filter((item) => item.level === 3)
  if (groups.length === 0) return { text: `${icon} ${page.title}`, link: page.url }
  return {
    text: `${icon} ${page.title}`,
    link: page.url,
    // 组件页页内小节（x.x.x）默认折叠，与导航同一约定。
    collapsed: true,
    items: groups.map((group) => ({ text: group.text, link: `${page.url}#${group.slug}` })),
  }
}

function componentGroup(domain: DomainNode) {
  const items: any[] = []
  if (domain.components.length && domain.entry.components) items.push({ text: '组件索引', link: domain.entry.components })
  for (const page of domain.components) items.push(componentEntry(page, '🧩'))
  for (const page of domain.crossComponents) items.push(componentEntry(page, '🔗'))
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
      { text: `${kd.icon} ${domain.learn.indexOf(kd) + 1}. ${kd.name}`, collapsed: false, items: kdItems(kd, domain.learn.indexOf(kd) + 1, domain.entry.learn) },
      componentGroup(domain),
    ].filter(Boolean)
  }
}

// 布局档位：teek（主题版，默认）/ taste（优化版）/ classic（改造前）。运行期可切换。
const LAYOUTS = ['taste', 'classic', 'teek']
function resolveLayout(): string {
  const raw = process.env.DOCS1_LAYOUT ?? 'teek'
  if (!LAYOUTS.includes(raw)) {
    throw new Error(`DOCS1_LAYOUT 只允许 ${LAYOUTS.join(' 或 ')}，当前：${raw}`)
  }
  return raw
}

// 基础路径由构建期环境变量注入：内网默认根路径，GitHub Pages 用仓库子路径。
// 见 specs/005-github-pages-deploy/contracts/base-path-contract.md §1。
function resolveBase(): string {
  const raw = process.env.DOCS1_BASE ?? '/'
  if (!raw.startsWith('/') || !raw.endsWith('/')) {
    throw new Error(`DOCS1_BASE 必须以 / 开头并以 / 结尾，当前：${raw}`)
  }
  return raw
}

const layout = resolveLayout()

export default defineConfig({
  lang: 'zh-CN',
  base: resolveBase(),
  title: '技术面试备考文档引擎',
  description: '声明式目录 + 元数据驱动：渐进式学习与组件查询',
  cleanUrls: true,
  rewrites,
  // URL 由解析层生成（逐段去掉 NN- 前缀），VitePress 自带的映射规则认不出这些路径。
  // 断链检查改由 scripts/check-content.mjs 用同一份 linkMap 判定，见 FR-017 / FR-034。
  ignoreDeadLinks: true,
  srcExclude: ['**/README.md'],
  lastUpdated: false,
  head: [
    ['meta', { name: 'theme-color', content: '#3b6ef6' }],
    [
      'script',
      {},
      // 首屏前定档：运行期选择优先于构建期默认，localStorage 不可用时回退默认档。
      `(function(){try{var k='docs1-layout';var v=localStorage.getItem(k);var d='${layout}';var m=(v==='classic'||v==='taste'||v==='teek')?v:d;var e=document.documentElement;e.classList.remove('layout-taste','layout-classic','layout-teek');e.classList.add('layout-'+m);}catch(err){document.documentElement.classList.add('layout-${layout}');}})();`,
    ],
  ],
  markdown: {
    // headers 未显式开启时 VitePress 不注册 headersPlugin，页面 headers 恒为空数组，
    // 右栏「本页目录」因此全站为空。这里显式开启，与 themeConfig.outline 的层级保持一致。
    headers: { level: [2, 3] },
    config: (md) => {
      md.use(cmpSplit)
    },
  },
  transformHtml(code) {
    // 服务端渲染时先带上默认档类名，避免首屏闪烁。
    return code.replace('<html', `<html class="layout-${layout}"`)
  },
  vite: {
    plugins: [docEngine(docsRoot)],
    server: { host: '0.0.0.0' },
    build: {
      rollupOptions: {
        output: {
          // 本地搜索索引的虚拟模块名以 @ 开头。GitHub Pages 不提供 @ 开头的文件，
          // 会让站内搜索在公网静默失效，故在构建期去掉前缀。
          // 见 specs/005-github-pages-deploy/contracts/base-path-contract.md §3。
          chunkFileNames: (chunk) => `assets/chunks/${chunk.name.replace(/^@/, '')}.[hash].js`,
        },
      },
    },
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
    // 组件页自带双栏（cmp-split：正文 + 引用方式）。
    // 必须同时关掉 outline 与 aside：只关 outline 时目录为空但容器仍占宽，白占约 224px。
    if (node && (node.type === 'component' || node.type === 'cross-component')) {
      frontmatter.outline ??= false
      frontmatter.aside ??= false
    }
    // landing 页（领域首页、学习入口、组件索引）正文由组件构成，目录实测为空。
    // 空目录容器仍占约 224px，宽屏下纯浪费，这里一并关闭（需要时可在页面显式写 aside: true）。
    if (frontmatter.type === 'landing') {
      frontmatter.outline ??= false
      frontmatter.aside ??= false
    }
  },
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      ...tree.domains.map((domain) => ({
        text: `${domain.icon} ${domain.name}`,
        activeMatch: `^/${domain.slug}/`,
        items: [
          { text: '领域首页', link: domain.url },
          ...(domain.entry.learn ? [{ text: '学习入口与路径', link: domain.entry.learn }] : []),
          ...domain.learn.map((kd, index) => ({
            text: `${kd.icon} ${index + 1}. ${kd.name}${kd.teach?.status === 'outline' ? '（待补）' : ''}`,
            items: kdItems(kd, index + 1, domain.entry.learn)
              .filter((item: any) => !item.items || item.items.length > 0)
              .map((item: any) => (item.items
                ? { text: item.text, link: item.items[0]?.link ?? domain.entry.learn }
                : item)),
          })),
          ...(domain.entry.components ? [{ text: '组件查询', link: domain.entry.components }] : []),
        ],
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
      copyright: process.env.DOCS1_SITE_LABEL ?? 'docs-1 · docs1.minilab.uzibird.cn',
    },
  },
})
