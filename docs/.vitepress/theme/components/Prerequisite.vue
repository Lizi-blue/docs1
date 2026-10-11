<script setup lang="ts">
/** 前置知识提示：把 frontmatter 的 prerequisites 渲染成可点的前置阅读清单。 */
import { computed } from 'vue'
import { resolvePage } from '../lib/tree'

const props = defineProps<{ items: string[] }>()
const resolved = computed(() =>
  props.items.map((link) => {
    const found = resolvePage(link)
    return { url: found?.url ?? link, title: found?.title ?? link, ok: Boolean(found) }
  }),
)
</script>

<template>
  <div v-if="resolved.length" class="prerequisite">
    <span class="prerequisite-title">先看这些</span>
    <a v-for="item in resolved" :key="item.url" class="prerequisite-item" :href="item.url">
      {{ item.ok ? item.title : `${item.title}（链接未命中）` }}
    </a>
  </div>
</template>
