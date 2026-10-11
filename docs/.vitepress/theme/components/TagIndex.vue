<script setup lang="ts">
/** 标签索引：走 VitePress 数据加载器（createContentLoader）的扁平页面索引。 */
import { computed } from 'vue'
import { data as pages } from '../../data/pages.data'

const props = defineProps<{ domain?: string; field?: 'tags' | 'tagsIndex' }>()
const field = computed(() => props.field ?? 'tags')
const scope = computed(() => pages.filter((page) => !props.domain || page.domain === props.domain))

const groups = computed(() => {
  const map = new Map<string, { url: string; title: string }[]>()
  for (const page of scope.value) {
    for (const tag of (page[field.value] ?? []) as string[]) {
      if (!map.has(tag)) map.set(tag, [])
      map.get(tag)!.push({ url: page.url, title: page.title })
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})
</script>

<template>
  <div v-if="groups.length" class="tag-index">
    <h2 class="tag-index-title">按标签索引</h2>
    <div v-for="[tag, items] in groups" :key="tag" class="tag-row">
      <span class="tag-name">#{{ tag }}</span>
      <a v-for="item in items" :key="item.url" class="tag-item" :href="item.url">{{ item.title }}</a>
    </div>
  </div>
</template>
