<script setup lang="ts">
/**
 * 自定义 Layout：读 frontmatter 的 type / entry 字段切换页面形态。
 *   · entry          -> 领域或入口页，顶部渲染自动索引区
 *   · knowledge      -> 单栏 + 右栏目录；顶部进度条 + 前置知识
 *   · component      -> 双栏（正文 + 引用方式）；顶部安装命令
 *   · cross-component-> 双栏 + 依赖汇聚
 * 底部统一渲染双向链接。
 */
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import PageHeader from './components/PageHeader.vue'
import EntryIndex from './components/EntryIndex.vue'
import RelatedLinks from './components/RelatedLinks.vue'

const { frontmatter: fm } = useData()
</script>

<template>
  <DefaultTheme.Layout>
    <template #doc-before>
      <EntryIndex v-if="fm.entry" :kind="fm.entry" />
      <PageHeader v-else-if="fm.pageModel" />
    </template>
    <template #doc-after>
      <RelatedLinks v-if="fm.pageModel" />
    </template>
  </DefaultTheme.Layout>
</template>
