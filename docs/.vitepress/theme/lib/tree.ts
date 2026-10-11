/**
 * 主题侧取数：虚拟模块 `virtual:doc-tree` 是导航、入口索引与双向链接的唯一来源。
 */
import { docTree } from 'virtual:doc-tree'
import { normalizeLink } from '../../shared/links'
import type { DocTree, KnowledgeDomainNode, PageNode } from '../../plugins/doc-engine'

export const tree = docTree as DocTree

export function pageByUrl(url: string): PageNode | undefined {
  return tree.pages.find((page) => page.url === url)
}

export function resolvePage(link: string): PageNode | undefined {
  const url = tree.linkMap[normalizeLink(link)] ?? tree.linkMap[link]
  return url ? pageByUrl(url) : undefined
}

export function titleOf(link: string): string {
  return resolvePage(link)?.title ?? normalizeLink(link)
}

export function domainOf(slug: string) {
  return tree.domains.find((domain) => domain.slug === slug)
}

export function knowledgeDomainOf(domainSlug: string, kdSlug: string): KnowledgeDomainNode | undefined {
  return domainOf(domainSlug)?.learn.find((kd) => kd.slug === kdSlug)
}

export function backlinksOf(url: string) {
  return tree.backlinks[url] ?? { reusedByComponents: [], usedKnowledge: [], componentsOf: [] }
}

/** 当前知识点在其知识域里的位置（用于进度条） */
export function positionIn(domainSlug?: string, kdSlug?: string, url?: string) {
  if (!domainSlug || !kdSlug || !url) return undefined
  const kd = knowledgeDomainOf(domainSlug, kdSlug)
  if (!kd) return undefined
  const flat = kd.pages
  const index = flat.findIndex((page) => page.url === url)
  if (index < 0) return undefined
  return { index: index + 1, total: flat.length, kd }
}
