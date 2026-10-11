<script setup lang="ts">
/** 安装命令框：一键复制。组件页顶部与右栏共用。 */
import { ref } from 'vue'

const props = defineProps<{ command: string; compact?: boolean }>()
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.command)
  } catch {
    const area = document.createElement('textarea')
    area.value = props.command
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
  copied.value = true
  window.setTimeout(() => (copied.value = false), 1500)
}
</script>

<template>
  <div class="install-box" :class="{ compact }">
    <div class="install-label">安装 / 引入</div>
    <div class="install-row">
      <code class="install-command">{{ command }}</code>
      <button class="install-copy" type="button" @click="copy">{{ copied ? '已复制' : '复制' }}</button>
    </div>
  </div>
</template>
