<script setup lang="ts">
/**
 * 底部双向链接（自动生成）：
 *   · 知识点页 -> 关联知识点 + 哪些组件复用了它
 *   · 组件页   -> 依赖了哪些知识点 + 关联组件
 */
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { backlinksOf, resolvePage } from '../lib/tree'

const { frontmatter: fm } = useData()
const page = computed(() => fm.value.pageModel as any)
const links = computed(() => backlinksOf(page.value?.url ?? ''))

function toItems(list: string[]) {
  return [...new Set(list)].map((link) => {
    const found = resolvePage(link)
    return { url: found?.url ?? link, title: found?.title ?? link, ok: Boolean(found) }
  })
}

const groups = computed(() => {
  const model = page.value
  if (!model) return []
  if (model.type === 'knowledge') {
    return [
      { title: '关联知识点', items: toItems(model.relatedKnowledge ?? []) },
      { title: '被这些组件复用', items: toItems(links.value.reusedByComponents) },
    ]
  }
  return [
    { title: '依赖的知识点', items: toItems(model.dependsOnKnowledge ?? []) },
    { title: '关联组件', items: toItems([...(model.dependsOnComponents ?? []), ...(model.relatedComponents ?? [])]) },
  ]
})
</script>

<template>
  <div v-if="page" class="related-links">
    <h2 class="related-title">关联与复用</h2>
    <div v-for="group in groups" :key="group.title" class="related-group">
      <div class="related-group-title">{{ group.title }}</div>
      <ul v-if="group.items.length" class="related-list">
        <li v-for="item in group.items" :key="item.url">
          <a :href="withBase(item.url)">{{ item.ok ? item.title : `${item.title}（未命中）` }}</a>
        </li>
      </ul>
      <div v-else class="related-empty">暂无</div>
    </div>
  </div>
</template>
