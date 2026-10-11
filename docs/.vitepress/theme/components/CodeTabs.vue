<script setup lang="ts">
/**
 * 代码标签页：同一能力的不同写法并排切换。
 * 作者用法（单行 JSON）：
 *   <CodeTabs :tabs="[{ label: '线程池', lang: 'python', code: 'with ThreadPoolExecutor(4) as pool: ...' },
 *                     { label: '多进程', lang: 'python', code: 'with ProcessPoolExecutor(4) as pool: ...' }]" />
 */
import { ref } from 'vue'

const props = defineProps<{ tabs: { label: string; lang?: string; code: string }[] }>()
const active = ref(0)
</script>

<template>
  <div class="code-tabs">
    <div class="code-tabs-header">
      <button
        v-for="(tab, index) in props.tabs"
        :key="tab.label"
        type="button"
        class="code-tab"
        :class="{ active: index === active }"
        @click="active = index"
      >
        {{ tab.label }}
      </button>
    </div>
    <pre class="code-tabs-body"><code>{{ props.tabs[active]?.code }}</code></pre>
  </div>
</template>
