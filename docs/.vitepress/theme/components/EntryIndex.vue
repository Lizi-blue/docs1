<script setup lang="ts">
/**
 * 入口页自动索引区（作者只需要写导语 + 一个 <EntryIndex :kind="..." />）。
 *   kind="domain"     领域首页：两个入口卡片
 *   kind="learn"      渐进式学习入口：知识域列表 + 学习路径 + 有序知识点
 *   kind="components" 组件查询入口：组件卡片 + 标签索引
 */
import { computed } from 'vue'
import { useData } from 'vitepress'
import TagIndex from './TagIndex.vue'
import { domainOf, knowledgeDomainOf } from '../lib/tree'

const props = defineProps<{ kind: 'domain' | 'learn' | 'components' }>()
const { frontmatter: fm, page } = useData()

const domainSlug = computed(() => (fm.value.domain as string) || page.value.relativePath.split('/')[0])
const domain = computed(() => domainOf(domainSlug.value))
const levelText: Record<string, string> = { basic: '基础', intermediate: '进阶', advanced: '深入' }
const typeText: Record<string, string> = { library: '库', framework: '框架', pattern: '模式', tool: '工具' }

const stats = computed(() => {
  const current = domain.value
  if (!current) return { kds: 0, pages: 0, components: 0, outlines: 0 }
  const total = (kd: any) =>
    kd.pages.length + (kd.subtopics ?? []).reduce((sum: number, sub: any) => sum + sub.pages.length, 0)
  return {
    kds: current.learn.length,
    pages: current.learn.reduce((sum, kd) => sum + total(kd), 0),
    components: current.components.length,
    outlines: current.learn.filter((kd) => kd.teach?.status === 'outline').length,
  }
})

const isOutline = (kd: any) => kd.teach?.status === 'outline'
const lessonTotal = (kd: any) =>
  kd.pages.length + (kd.subtopics ?? []).reduce((sum: number, sub: any) => sum + sub.pages.length, 0)

function kdIndex(kd: any) {
  return (domain.value?.learn.findIndex((item) => item.slug === kd.slug) ?? 0) + 1
}

function kdTitle(domainSlugValue: string, kdSlug: string) {
  return knowledgeDomainOf(domainSlugValue, kdSlug)
}
</script>

<template>
  <div v-if="domain" class="entry-index">
    <!-- 领域首页：两个入口 -->
    <template v-if="props.kind === 'domain'">
      <div class="entry-cards">
        <a v-if="domain.entry.learn" class="entry-card" :href="domain.entry.learn">
          <div class="entry-card-icon">📚</div>
          <div class="entry-card-title">渐进式学习</div>
          <div class="entry-card-desc">按学习路径逐讲推进：原理 → API 手册 → 组合用法 → 完整 Demo</div>
          <div class="entry-card-meta">
            {{ stats.kds }} 个知识域 · 已开写 {{ stats.pages }} 讲<template v-if="stats.outlines"> · 待补 {{ stats.outlines }} 域</template>
          </div>
        </a>
        <a v-if="domain.entry.components" class="entry-card" :href="domain.entry.components">
          <div class="entry-card-icon">🧩</div>
          <div class="entry-card-title">组件查询</div>
          <div class="entry-card-desc">按组件查复用：由哪些知识点组合、完整源码、其他项目如何引入</div>
          <div class="entry-card-meta">{{ stats.components }} 个组件</div>
        </a>
      </div>
    </template>

    <!-- 渐进式学习入口 -->
    <template v-else-if="props.kind === 'learn'">
      <div class="kd-list">
        <section v-for="kd in domain.learn" :key="kd.slug" class="kd-card">
          <header class="kd-header">
            <span class="kd-icon">{{ kd.icon }}</span>
            <a v-if="!isOutline(kd)" class="kd-name" :href="kd.url">{{ kdIndex(kd) }}. {{ kd.name }}</a>
            <span v-else class="kd-name kd-name-outline">{{ kdIndex(kd) }}. {{ kd.name }}</span>
            <span v-if="isOutline(kd)" class="badge badge-outline">待补</span>
            <span class="kd-count">{{ isOutline(kd) ? '未开写' : `${lessonTotal(kd)} 讲` }}</span>
          </header>
          <p v-if="kd.description" class="kd-desc">{{ kd.description }}</p>
          <div v-if="kd.path.length" class="kd-path">
            <span v-for="step in kd.path" :key="step.label ?? step.from" class="kd-path-step">
              {{ step.label ?? `${step.from} → ${step.to}` }}
            </span>
          </div>
          <p v-if="isOutline(kd)" class="kd-outline">方向已登记，内容待补。学完能做什么：{{ (kd.teach?.outcomes ?? []).join('；') }}</p>
          <ol v-else class="kd-pages">
            <li v-for="(item, index) in kd.pages" :key="item.url">
              <span class="kd-index">{{ kdIndex(kd) }}.{{ index + 1 }}</span>
              <a :href="item.url">{{ item.title }}</a>
              <span v-if="item.level" class="badge badge-level">{{ levelText[item.level] ?? item.level }}</span>
              <span v-if="item.description" class="kd-page-desc">{{ item.description }}</span>
            </li>
          </ol>
          <div v-for="(sub, subIndex) in kd.subtopics ?? []" :key="sub.slug" class="kd-sub">
            <div class="kd-sub-title">{{ kdIndex(kd) }}.{{ subIndex + 1 }} {{ sub.icon }} {{ sub.name }}</div>
            <ol class="kd-pages kd-pages-sub">
              <li v-for="(item, index) in sub.pages" :key="item.url">
                <span class="kd-index">{{ kdIndex(kd) }}.{{ subIndex + 1 }}.{{ index + 1 }}</span>
                <a :href="item.url">{{ item.title }}</a>
                <span v-if="item.description" class="kd-page-desc">{{ item.description }}</span>
              </li>
            </ol>
          </div>
          <div v-if="isOutline(kd) && domain.entry.learn" class="kd-start">
            已登记方向，内容待补：<a :href="domain.entry.learn">返回学习入口</a>
          </div>
          <div v-if="!isOutline(kd) && kd.pages.length" class="kd-start">
            推荐起点：<a :href="kd.pages[0].url">{{ kd.pages[0].title }}</a>
          </div>
        </section>
      </div>
    </template>

    <!-- 组件查询入口 -->
    <template v-else>
      <div class="cmp-list">
        <a v-for="item in domain.components" :key="item.url" class="cmp-card" :href="item.url">
          <div class="cmp-card-head">
            <span class="cmp-card-title">{{ item.title }}</span>
            <span class="badge badge-type">{{ typeText[item.componentType ?? ''] ?? item.componentType ?? '组件' }}</span>
          </div>
          <div class="cmp-card-desc">{{ item.description }}</div>
          <div class="cmp-card-tags">
            <span v-for="tag in item.tagsIndex" :key="tag" class="badge badge-tag">#{{ tag }}</span>
          </div>
          <div class="cmp-card-meta">
            依赖 {{ item.dependsOnKnowledge.length }} 个知识点 · 可复用度 {{ item.reusability ?? '未评' }}
          </div>
        </a>
      </div>
      <TagIndex :domain="domainSlug" />
    </template>
  </div>
</template>
