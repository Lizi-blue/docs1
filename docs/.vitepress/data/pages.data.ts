/**
 * VitePress 数据加载器（createContentLoader）：扫描 docs/**\/*.md 的 frontmatter，
 * 生成扁平页面索引。用途：组件页按 tags_index 聚合、入口页统计、内容校验对账。
 * 层级导航仍由虚拟模块 `virtual:doc-tree` 提供，两者职责不重叠。
 */
import { createContentLoader } from 'vitepress'

export interface PageIndexEntry {
  url: string
  title: string
  type?: string
  domain?: string
  knowledgeDomain?: string
  level?: string
  tags: string[]
  tagsIndex: string[]
  componentType?: string
  reusability?: string
  description?: string
}

export default createContentLoader('**/*.md', {
  includeSrc: false,
  transform(raw): PageIndexEntry[] {
    return raw
      .map(({ url, frontmatter }) => {
        const data = (frontmatter ?? {}) as Record<string, any>
        return {
          url,
          title: data.title ?? url,
          type: data.type,
          domain: data.domain,
          knowledgeDomain: data.knowledge_domain,
          level: data.level,
          tags: (data.tags ?? []) as string[],
          tagsIndex: (data.tags_index ?? []) as string[],
          componentType: data.component_type,
          reusability: data.reusability,
          description: data.description,
        }
      })
      .filter((entry) => entry.type)
      .sort((a, b) => a.url.localeCompare(b.url))
  },
})

declare const data: PageIndexEntry[]
export { data }
