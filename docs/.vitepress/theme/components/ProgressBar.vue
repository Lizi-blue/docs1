<script setup lang="ts">
/** 学习进度：当前知识点在所属知识域里的位置。 */
import { computed } from 'vue'

const props = defineProps<{ current: number; total: number; label?: string }>()
const percent = computed(() => (props.total ? Math.round((props.current / props.total) * 100) : 0))
</script>

<template>
  <div class="progress-bar">
    <div class="progress-text">
      <span class="progress-label">{{ label }}</span>
      <span class="progress-count">第 {{ current }} / {{ total }} 讲 · {{ percent }}%</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: `${percent}%` }" />
    </div>
  </div>
</template>
