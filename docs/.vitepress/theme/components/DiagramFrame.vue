<script setup lang="ts">
/**
 * 交互图解外框：嵌入 Archify 生成的自包含 HTML（docs/public/diagrams/*.html）。
 * 用法：<DiagramFrame src="/diagrams/gil-workflow.html" title="GIL 工作流程" />
 * 图解地址按基础路径加前缀，根路径与子路径部署都能取到。
 */
import { withBase } from 'vitepress'

withDefaults(defineProps<{ src: string; title?: string; height?: number }>(), { height: 520 })
</script>

<template>
  <figure class="diagram-frame">
    <figcaption v-if="title">
      <span>{{ title }}</span>
      <a :href="withBase(src)" target="_blank" rel="noopener">在新窗口打开</a>
    </figcaption>
    <iframe :src="withBase(src)" :title="title ?? '交互图解'" :style="{ '--diagram-height': `${height}px` }" loading="lazy" />
  </figure>
</template>
