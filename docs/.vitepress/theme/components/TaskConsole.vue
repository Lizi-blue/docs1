<script setup lang="ts">
/**
 * 任务控制台：下发白名单命令，订阅 SSE 看实时输出。
 * 用法：<TaskConsole />
 * 依赖：浏览器原生 fetch 与 EventSource。服务不可用时只提示，不报错。
 *
 * 接口契约见 specs/003-task-dispatch/plan.md：
 *   GET  /api/tasks?limit=          -> { tasks, limits }
 *   POST /api/tasks                 -> 201 Task；400 校验失败；429 并发超限
 *   POST /api/tasks/{id}/cancel     -> 200；409 已结束
 *   GET  /api/tasks/{id}/stream     -> SSE：output / status / end
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled' | 'timeout'

interface TaskMetrics {
  duration_s?: number
  cpu_s?: number
  peak_rss_bytes?: number
  output_bytes?: number
}

interface TaskSummary {
  id: string
  command: string
  args?: string[]
  status: TaskStatus
  exit_code?: number | null
  metrics?: TaskMetrics
  truncated?: boolean
}

interface Limits {
  max_concurrency: number
  timeout_max_s: number
  output_max_bytes: number
  keep: number
  allowlist: string[]
}

interface Chunk {
  seq: number
  stream: 'stdout' | 'stderr'
  text: string
}

const STATUS_TEXT: Record<TaskStatus, string> = {
  queued: '排队中',
  running: '运行中',
  succeeded: '成功',
  failed: '失败',
  canceled: '已取消',
  timeout: '超时',
}

const online = ref<boolean | null>(null)
const limits = ref<Limits | null>(null)
const tasks = ref<TaskSummary[]>([])
const command = ref('')
const argsText = ref('')
const timeoutS = ref<number | null>(null)
const submitting = ref(false)
const cancellingId = ref('')
const selectedId = ref('')
const chunks = ref<Chunk[]>([])
const lastSeq = ref(0)
const autoScroll = ref(true)
const notice = ref('')
const outputEl = ref<HTMLElement | null>(null)

let source: EventSource | null = null
let reconnectTimer: number | null = null
let pollTimer: number | null = null
const seenSeq = new Set<number>()

const allowlist = computed(() => limits.value?.allowlist ?? [])
const selected = computed(() => tasks.value.find((task) => task.id === selectedId.value) ?? null)
const totalBytes = computed(() => chunks.value.reduce((sum, chunk) => sum + byteLength(chunk.text), 0))
const stdoutBytes = computed(
  () => chunks.value.filter((chunk) => chunk.stream !== 'stderr').reduce((sum, chunk) => sum + byteLength(chunk.text), 0),
)
const stderrBytes = computed(() => totalBytes.value - stdoutBytes.value)

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

function messageOf(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    for (const key of ['detail', 'error', 'message']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return fallback
}

function formatSeconds(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'
  return `${value.toFixed(2)} s`
}

function formatBytes(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`
  return `${(value / 1024 / 1024).toFixed(2)} MiB`
}

function statusClass(status: TaskStatus): string {
  if (status === 'succeeded') return 'task-status-ok'
  if (status === 'failed' || status === 'timeout') return 'task-status-bad'
  if (status === 'running') return 'task-status-run'
  return 'task-status-idle'
}

function canCancel(task: TaskSummary): boolean {
  return task.status === 'queued' || task.status === 'running'
}

async function request(path: string, init?: RequestInit): Promise<{ status: number; data: unknown }> {
  const response = await fetch(path, init)
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }
  return { status: response.status, data }
}

/** 参数支持空格分隔，也支持每行一个。引号包住的片段算一个参数。 */
function parseArgs(text: string): string[] {
  const tokens: string[] = []
  for (const line of text.split('\n')) {
    const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g
    let matched: RegExpExecArray | null = pattern.exec(line)
    while (matched !== null) {
      tokens.push(matched[1] ?? matched[2] ?? matched[3])
      matched = pattern.exec(line)
    }
  }
  return tokens
}

async function refresh(): Promise<void> {
  try {
    const { status, data } = await request('/api/tasks?limit=50')
    const payload = data as { tasks?: TaskSummary[]; limits?: Limits } | null
    if (status < 200 || status >= 300 || !payload || !Array.isArray(payload.tasks)) {
      online.value = false
      return
    }
    tasks.value = payload.tasks
    if (payload.limits) limits.value = payload.limits
    if (!command.value && allowlist.value.length > 0) command.value = allowlist.value[0]
    online.value = true
  } catch {
    online.value = false
  }
}

function updateSelected(status: TaskStatus, extra?: Partial<TaskSummary>): void {
  const task = tasks.value.find((item) => item.id === selectedId.value)
  if (!task) return
  task.status = status
  if (extra) Object.assign(task, extra)
}

async function submit(): Promise<void> {
  if (!command.value.trim()) {
    notice.value = '先选择或填写命令。'
    return
  }
  submitting.value = true
  try {
    const body: Record<string, unknown> = { command: command.value.trim(), args: parseArgs(argsText.value) }
    if (typeof timeoutS.value === 'number' && Number.isFinite(timeoutS.value) && timeoutS.value > 0) {
      body.timeout_s = timeoutS.value
    }
    const { status, data } = await request('/api/tasks', { method: 'POST', body: JSON.stringify(body) })
    online.value = true
    if (status === 201 && data) {
      notice.value = ''
      const created = data as TaskSummary
      openTask(created.id)
      await refresh()
      return
    }
    if (status === 400) notice.value = `参数校验失败：${messageOf(data, '检查参数与工作目录')}。`
    else if (status === 429) notice.value = `并发已达上限（${limits.value?.max_concurrency ?? '-'}），等任务结束再提交。`
    else notice.value = `提交失败（HTTP ${status}）：${messageOf(data, '未知原因')}。`
  } catch {
    online.value = false
    notice.value = '提交失败：连不上任务服务。'
  } finally {
    submitting.value = false
  }
}

async function cancel(id: string): Promise<void> {
  cancellingId.value = id
  try {
    const { status, data } = await request(`/api/tasks/${id}/cancel`, { method: 'POST' })
    online.value = true
    if (status === 200) {
      notice.value = '已发送取消信号。宽限期后强制结束。'
      await refresh()
      return
    }
    if (status === 409) notice.value = '任务已结束，取消无效。'
    else if (status === 404) notice.value = '任务不存在，可能已被清理。'
    else notice.value = `取消失败（HTTP ${status}）：${messageOf(data, '未知原因')}。`
  } catch {
    online.value = false
    notice.value = '取消失败：连不上任务服务。'
  } finally {
    cancellingId.value = ''
  }
}

function closeStream(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (source) {
    source.close()
    source = null
  }
}

/** 打开某任务的输出流。from 是起始序号，用于断线续传。 */
function openStream(id: string, from: number): void {
  closeStream()
  const stream = new EventSource(`/api/tasks/${id}/stream?from=${from}`)
  source = stream
  stream.onopen = () => {
    online.value = true
  }
  stream.addEventListener('output', (event) => {
    pushChunk((event as MessageEvent).data)
  })
  stream.addEventListener('status', (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data) as { status?: TaskStatus }
      if (payload.status) updateSelected(payload.status)
    } catch {
      notice.value = '收到无法解析的状态帧。'
    }
  })
  stream.addEventListener('end', (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data) as {
        status?: TaskStatus
        exit_code?: number | null
        metrics?: TaskMetrics
      }
      if (payload.status) updateSelected(payload.status, { exit_code: payload.exit_code ?? null, metrics: payload.metrics })
    } catch {
      notice.value = '收到无法解析的结束帧。'
    }
    closeStream()
    void refresh()
  })
  stream.onerror = () => {
    // 浏览器会自动重连并带上 Last-Event-ID。连接被彻底关闭时，本组件按序号重建。
    if (stream.readyState === EventSource.CLOSED && selectedId.value === id) {
      reconnectTimer = window.setTimeout(() => openStream(id, lastSeq.value + 1), 2000)
    }
  }
}

function openTask(id: string): void {
  selectedId.value = id
  chunks.value = []
  seenSeq.clear()
  lastSeq.value = 0
  openStream(id, 0)
}

function pushChunk(raw: string): void {
  let chunk: Chunk
  try {
    chunk = JSON.parse(raw) as Chunk
  } catch {
    notice.value = '收到无法解析的输出帧。'
    return
  }
  if (typeof chunk.seq !== 'number' || typeof chunk.text !== 'string') return
  if (seenSeq.has(chunk.seq)) return
  seenSeq.add(chunk.seq)
  chunks.value.push(chunk)
  if (chunk.seq > lastSeq.value) lastSeq.value = chunk.seq
}

function clearOutput(): void {
  chunks.value = []
}

watch(
  () => chunks.value.length,
  async () => {
    if (!autoScroll.value) return
    await nextTick()
    const element = outputEl.value
    if (element) element.scrollTop = element.scrollHeight
  },
)

onMounted(() => {
  void refresh()
  pollTimer = window.setInterval(() => void refresh(), 3000)
})

onBeforeUnmount(() => {
  closeStream()
  if (pollTimer !== null) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="task-console">
    <p v-if="online === false" class="task-banner task-banner-offline">
      任务服务不可用。提交与实时输出暂时关闭。静态说明仍可阅读。
    </p>
    <p v-else-if="online === null" class="task-banner">正在连接任务服务……</p>

    <p class="task-note">任务与输出只保存在内存。服务重启后清空。</p>

    <form class="task-form" @submit.prevent="submit">
      <label class="task-field">
        <span class="task-label">命令</span>
        <select v-model="command" class="task-input" :disabled="online === false">
          <option v-for="name in allowlist" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <label class="task-field task-field-wide">
        <span class="task-label">参数</span>
        <textarea
          v-model="argsText"
          class="task-input task-args"
          rows="2"
          :disabled="online === false"
          placeholder="空格分隔，也可以每行一个"
        />
      </label>
      <label class="task-field">
        <span class="task-label">超时（秒）</span>
        <input
          v-model.number="timeoutS"
          class="task-input"
          type="number"
          min="1"
          :max="limits?.timeout_max_s"
          :disabled="online === false"
        />
      </label>
      <button type="submit" class="task-button" :disabled="online === false || submitting || !command">
        {{ submitting ? '提交中……' : '提交任务' }}
      </button>
    </form>

    <p v-if="limits" class="task-limits">
      并发上限 {{ limits.max_concurrency }} ·
      超时上限 {{ limits.timeout_max_s }} 秒 ·
      输出上限 {{ formatBytes(limits.output_max_bytes) }} ·
      保留 {{ limits.keep }} 条
    </p>
    <p v-if="notice" class="task-banner task-banner-error">{{ notice }}</p>

    <div class="task-grid">
      <section class="task-panel">
        <p class="task-panel-title">任务列表<span class="task-meta">{{ tasks.length }} 条</span></p>
        <p v-if="tasks.length === 0" class="task-empty">还没有任务。先提交一个试试。</p>
        <ul class="task-list">
          <li
            v-for="task in tasks"
            :key="task.id"
            class="task-card"
            :class="{ 'task-card-active': task.id === selectedId }"
          >
            <div class="task-card-head">
              <code class="task-cmd">{{ task.command }} {{ (task.args ?? []).join(' ') }}</code>
              <span class="badge" :class="statusClass(task.status)">{{ STATUS_TEXT[task.status] ?? task.status }}</span>
            </div>
            <div class="task-card-metrics">
              <span>退出码 {{ task.exit_code ?? '-' }}</span>
              <span>耗时 {{ formatSeconds(task.metrics?.duration_s) }}</span>
              <span>CPU {{ formatSeconds(task.metrics?.cpu_s) }}</span>
              <span>峰值内存 {{ formatBytes(task.metrics?.peak_rss_bytes) }}</span>
              <span>输出 {{ formatBytes(task.metrics?.output_bytes) }}</span>
              <span v-if="task.truncated" class="task-truncated">已截断</span>
            </div>
            <div class="task-card-actions">
              <button type="button" class="task-link" @click="openTask(task.id)">看输出</button>
              <button
                type="button"
                class="task-link"
                :disabled="!canCancel(task) || cancellingId === task.id"
                @click="cancel(task.id)"
              >
                {{ cancellingId === task.id ? '取消中……' : '取消' }}
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section class="task-panel">
        <p class="task-panel-title">
          实时输出
          <span class="task-meta">
            {{ selected ? `${selected.command} · ${STATUS_TEXT[selected.status] ?? selected.status}` : '未选任务' }}
          </span>
        </p>
        <p class="task-bytes">
          共 {{ formatBytes(totalBytes) }} ·
          stdout {{ formatBytes(stdoutBytes) }} ·
          stderr {{ formatBytes(stderrBytes) }}
        </p>
        <div class="task-output-tools">
          <label class="task-toggle"><input v-model="autoScroll" type="checkbox" /> 自动滚动</label>
          <button type="button" class="task-link" @click="clearOutput">清空显示</button>
        </div>
        <div ref="outputEl" class="task-output">
          <p v-if="chunks.length === 0" class="task-empty">选中一个任务，输出会出现在这里。</p>
          <p
            v-for="chunk in chunks"
            :key="chunk.seq"
            class="task-line"
            :class="chunk.stream === 'stderr' ? 'task-line-err' : 'task-line-out'"
          >
            <span class="task-prefix">{{ chunk.stream === 'stderr' ? '[err]' : '[out]' }}</span>
            <span class="task-text">{{ chunk.text }}</span>
            <span class="task-size">{{ byteLength(chunk.text) }}B</span>
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
