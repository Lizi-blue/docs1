<script setup lang="ts">
/**
 * API 手册渲染：参数表 + 方法列表 + 折叠最小示例。
 * 作者用法（单行 JSON）：
 *   <ApiTable :items="[{ name: 'threading.Thread', rank: '必会', signature: 'Thread(group=None, target=None, ...)',
 *     params: [{ name: 'target', type: 'callable', default: 'None', desc: '线程执行的函数' }],
 *     returns: 'Thread 实例', methods: ['start() — 启动线程'], effect: '…', scenario: '…',
 *     example: 'import threading', exampleLang: 'python' }]" />
 */
export interface ApiParam {
  name: string
  type?: string
  default?: string
  desc?: string
}

export interface ApiItem {
  name: string
  rank?: string
  signature?: string
  params?: ApiParam[]
  returns?: string
  raises?: string
  methods?: string[]
  effect?: string
  scenario?: string
  example?: string
  exampleLang?: string
}

const props = defineProps<{ items: ApiItem[] }>()
const rankClass = (rank?: string) =>
  rank === '必会' ? 'rank-must' : rank === '常用' ? 'rank-common' : 'rank-advanced'
const rankText = (rank?: string) => rank ?? '未分档'
</script>

<template>
  <div class="api-table">
    <section v-for="item in props.items" :key="item.name" class="api-item">
      <h3 class="api-name">
        <span class="badge" :class="rankClass(item.rank)">{{ rankText(item.rank) }}</span>
        <code>{{ item.name }}</code>
      </h3>
      <p v-if="item.signature" class="api-signature"><code>{{ item.signature }}</code></p>

      <table v-if="item.params?.length" class="api-params">
        <thead>
          <tr><th>参数</th><th>类型</th><th>默认值</th><th>说明</th></tr>
        </thead>
        <tbody>
          <tr v-for="param in item.params" :key="param.name">
            <td><code>{{ param.name }}</code></td>
            <td>{{ param.type ?? '-' }}</td>
            <td>{{ param.default ?? '-' }}</td>
            <td>{{ param.desc ?? '-' }}</td>
          </tr>
        </tbody>
      </table>

      <p v-if="item.methods?.length" class="api-methods">
        <strong>方法：</strong>
        <span v-for="(method, index) in item.methods" :key="method">
          <code>{{ method }}</code><span v-if="index < item.methods.length - 1"> / </span>
        </span>
      </p>

      <ul class="api-facts">
        <li v-if="item.effect"><strong>使用效果：</strong>{{ item.effect }}</li>
        <li v-if="item.returns"><strong>返回值：</strong>{{ item.returns }}</li>
        <li v-if="item.raises"><strong>异常：</strong>{{ item.raises }}</li>
        <li v-if="item.scenario"><strong>适用场景：</strong>{{ item.scenario }}</li>
      </ul>

      <details v-if="item.example" class="api-example">
        <summary>最小示例</summary>
        <pre><code>{{ item.example }}</code></pre>
      </details>
    </section>
  </div>
</template>
