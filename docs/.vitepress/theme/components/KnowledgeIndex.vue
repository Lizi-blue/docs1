<script setup lang="ts">
/**
 * 组件页的知识依赖索引：从 frontmatter `knowledge_index` 渲染，作者不手写表格。
 * 目标知识域若为 outline，渲染「待补」标签而不是普通链接。
 */
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { knowledgeDomainOf, resolvePage, titleOf } from '../lib/tree'

interface Entry { page: string; role: string }

const { frontmatter: fm } = useData()
const entries = computed<Entry[]>(() => (fm.value.knowledge_index as Entry[]) ?? [])

function domainOfLink(link: string): string {
  const matched = /^\/([^/]+)\//.exec(link)
  return matched ? matched[1] : ''
}

function kdNameOfLink(link: string): string {
  const page = resolvePage(link)
  if (page?.knowledgeDomain) return page.knowledgeDomain
  const matched = /^\/[^/]+\/learn\/([^/]+)\//.exec(link)
  return matched ? matched[1] : ''
}

function isOutline(link: string): boolean {
  const domain = domainOfLink(link)
  const kd = kdNameOfLink(link)
  if (!domain || !kd) return false
  return knowledgeDomainOf(domain, kd)?.teach?.status === 'outline'
}

function label(link: string): string {
  return resolvePage(link)?.title ?? titleOf(link)
}
</script>

<template>
  <div class="knowledge-index">
    <table class="ki-table">
      <thead>
        <tr><th>知识点</th><th>知识域</th><th>在本组件中的作用</th></tr>
      </thead>
      <tbody>
        <tr v-for="entry in entries" :key="entry.page">
          <td>
            <template v-if="isOutline(entry.page)">
              <span class="ki-label">{{ label(entry.page) }}</span>
              <span class="badge badge-outline">待补</span>
            </template>
            <a v-else :href="withBase(entry.page)">{{ label(entry.page) }}</a>
          </td>
          <td class="ki-domain">{{ kdNameOfLink(entry.page) || domainOfLink(entry.page) }}</td>
          <td>{{ entry.role }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="entries.length === 0" class="ki-empty">尚未登记依赖的知识点。</p>
  </div>
</template>

<style scoped>
.knowledge-index { margin: var(--docs1-space-4) 0; }
.ki-table { width: 100%; border-collapse: collapse; font-size: var(--docs1-font-sm); }
.ki-table th, .ki-table td { border: 1px solid var(--docs1-color-border); padding: var(--docs1-space-2) var(--docs1-space-3); text-align: left; }
.ki-table th { background: var(--docs1-color-surface); }
.ki-domain { color: var(--docs1-color-muted); white-space: nowrap; }
.ki-label { margin-right: var(--docs1-space-2); }
.ki-empty { font-size: var(--docs1-font-sm); color: var(--docs1-color-muted); }
</style>
