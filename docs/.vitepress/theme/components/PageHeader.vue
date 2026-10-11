<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import ProgressBar from './ProgressBar.vue'
import Prerequisite from './Prerequisite.vue'
import InstallBox from './InstallBox.vue'
import { backlinksOf, positionIn, resolvePage } from '../lib/tree'

const { frontmatter: fm } = useData()
const page = computed(() => fm.value.pageModel as any)
const position = computed(() => positionIn(page.value?.domain, page.value?.knowledgeDomain, page.value?.url))
const reusedBy = computed(() => backlinksOf(page.value?.url ?? '').reusedByComponents)
const levelText: Record<string, string> = { basic: '基础', intermediate: '进阶', advanced: '深入' }
const typeText: Record<string, string> = { library: '库', framework: '框架', pattern: '模式', tool: '工具' }

/** 跨领域组件：按领域聚合依赖 */
const dependencyGroups = computed(() => {
  const groups: Record<string, { title: string; url: string }[]> = {}
  for (const link of page.value?.dependsOnKnowledge ?? []) {
    const found = resolvePage(link)
    const key = found?.domainName ?? '依赖'
    ;(groups[key] ??= []).push({ title: found?.title ?? link, url: found?.url ?? link })
  }
  return groups
})
</script>

<template>
  <div v-if="page" class="page-header">
    <template v-if="page.type === 'knowledge'">
      <ProgressBar
        v-if="position"
        :current="position.index"
        :total="position.total"
        :label="`${position.kd.icon} ${position.kd.name}`"
      />
      <Prerequisite :items="page.prerequisites ?? []" />
      <div class="meta-row">
        <span v-if="page.level" class="badge badge-level">{{ levelText[page.level] ?? page.level }}</span>
        <span v-if="page.sourceModule" class="badge">模块 <code>{{ page.sourceModule }}</code></span>
        <span v-for="tag in page.tags" :key="tag" class="badge badge-tag">#{{ tag }}</span>
        <span v-if="reusedBy.length" class="badge badge-link">被 {{ reusedBy.length }} 个组件复用</span>
      </div>
    </template>

    <template v-else-if="page.type === 'component' || page.type === 'cross-component'">
      <div class="meta-row">
        <span class="badge badge-type">{{ typeText[page.componentType] ?? page.componentType ?? '组件' }}</span>
        <span v-if="page.reusability" class="badge">可复用度 {{ page.reusability }}</span>
        <span v-for="tag in page.tagsIndex" :key="tag" class="badge badge-tag">#{{ tag }}</span>
      </div>
      <InstallBox v-if="page.installCommand" :command="page.installCommand" />
      <div v-if="page.type === 'cross-component'" class="dep-aggregate">
        <div class="dep-title">依赖汇聚（后端与前端如何汇入本组件）</div>
        <div v-for="(items, group) in dependencyGroups" :key="group" class="dep-group">
          <span class="dep-domain">{{ group }}</span>
          <a v-for="item in items" :key="item.url" class="dep-chip" :href="item.url">{{ item.title }}</a>
        </div>
      </div>
    </template>
  </div>
</template>
