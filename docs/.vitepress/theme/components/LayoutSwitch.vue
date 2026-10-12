<script setup lang="ts">
/**
 * 布局档位切换（006 FR-004）：优化后 / 经典。
 * 只改根元素类名与 localStorage，不触网络、不重载页面。
 */
import { onMounted, ref } from 'vue'

const KEY = 'docs1-layout'
const OPTIONS = [
  { value: 'taste', label: '优化版' },
  { value: 'classic', label: '经典版' },
] as const

const current = ref<string>('taste')

function apply(value: string) {
  const root = document.documentElement
  root.classList.remove('layout-taste', 'layout-classic')
  root.classList.add(`layout-${value}`)
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // 隐私模式下写入失败：本页仍然生效。
  }
  current.value = value
}

onMounted(() => {
  current.value = document.documentElement.classList.contains('layout-classic') ? 'classic' : 'taste'
})
</script>

<template>
  <div class="layout-switch" role="group" aria-label="布局档位">
    <span class="layout-switch-label">布局</span>
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      class="layout-switch-btn"
      :class="{ 'is-active': current === option.value }"
      :aria-pressed="current === option.value"
      @click="apply(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.layout-switch {
  display: flex;
  align-items: center;
  gap: var(--docs1-space-1);
  margin-left: var(--docs1-space-3);
}
.layout-switch-label {
  font-size: var(--docs1-font-xs);
  color: var(--docs1-color-muted);
}
.layout-switch-btn {
  min-height: 32px;
  padding: 0 var(--docs1-space-4);
  border: var(--docs1-border-1) solid var(--docs1-color-border);
  border-radius: var(--docs1-radius-pill);
  background: var(--docs1-color-surface);
  color: var(--docs1-color-text);
  font-size: var(--docs1-font-xs);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.layout-switch-btn:hover {
  background: var(--docs1-state-hover);
}
.layout-switch-btn:active {
  background: var(--docs1-state-active);
}
.layout-switch-btn:focus-visible {
  outline: var(--docs1-focus-ring);
  outline-offset: var(--docs1-focus-offset);
}
.layout-switch-btn.is-active {
  border-color: var(--docs1-state-selected);
  color: var(--docs1-state-selected);
}
@media (max-width: 640px) {
  .layout-switch-label {
    display: none;
  }
}
</style>
