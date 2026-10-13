<script setup lang="ts">
/**
 * 任务控制台：下发命令，订阅 SSE 看实时输出。
 * 用法：<TaskConsole /> 或 <TaskConsole api-base="https://host/api" />
 * 依赖：浏览器原生 fetch 与 EventSource。服务不可用时只提示，不报错。
 *
 * 接口契约见 specs/003-task-dispatch/plan.md：
 *   GET  /api/tasks?limit=          -> { tasks, limits }
 *   POST /api/tasks                 -> 201 Task；400 校验失败；429 并发超限
 *   POST /api/tasks/{id}/cancel     -> 200；409 已结束
 *   GET  /api/tasks/{id}/stream     -> SSE：output / status / end
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ apiBase?: string }>(), { apiBase: '/api' })

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

let events: EventStream | null = null
let reconnectTimer: number | null = null
let pollTimer: number | null = null
const seenSeq = new Set<number>()
const api = new ApiClient()

const base = computed(() => props.apiBase.replace(/\/+$/, ''))
const allowlist = computed(() => limits.value?.allowlist ?? [])
const selected = computed(() => tasks.value.find((task) => task.id === selectedId.value) ?? null)
const totalBytes = computed(() => chunks.value.reduce((sum, chunk) => sum + byteLength(chunk.text), 0))
const stdoutBytes = computed(
  () => chunks.value.filter((chunk) => chunk.stream !== 'stderr').reduce((sum, chunk) => sum + byteLength(chunk.text), 0),
)
const stderrBytes = computed(() => totalBytes.value - stdoutBytes.value)
const busy = computed(() => online.value === null)
const offline = computed(() => online.value === false)
const streamBusy = computed(() => selected.value?.status === 'running' || selected.value?.status === 'queued')

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

function messageOf(data: unknown, fallback: string): string {
  // 委托给 ApiClient 的错误体映射。
  return ApiClient.messageOf(data, fallback)
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

function request(path: string, init?: RequestInit): Promise<{ status: number; data: unknown }> {
  // 委托给 ApiClient：请求与 JSON 解析都由它负责。
  return api.request(path, init)
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
    const { status, data } = await request(`${base.value}/tasks?limit=50`)
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
    const { status, data } = await request(`${base.value}/tasks`, { method: 'POST', body: JSON.stringify(body) })
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
    const { status, data } = await request(`${base.value}/tasks/${id}/cancel`, { method: 'POST' })
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
  if (events) {
    events.close()
    events = null
  }
}

/** 打开某任务的输出流。from 是起始序号，用于断线续传。 */
function openStream(id: string, from: number): void {
  closeStream()
  events = new EventStream({
    onOpen: () => {
      online.value = true
    },
    onOutput: (raw) => pushChunk(raw),
    onStatus: (raw) => {
      try {
        const payload = JSON.parse(raw) as { status?: TaskStatus }
        if (payload.status) updateSelected(payload.status)
      } catch {
        notice.value = '收到无法解析的状态帧。'
      }
    },
    onEnd: (raw) => {
      try {
        const payload = JSON.parse(raw) as {
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
    },
    onClosed: () => {
      // 连接彻底断开时，按已收到的最大序号重建。
      if (selectedId.value === id) {
        reconnectTimer = window.setTimeout(() => openStream(id, lastSeq.value + 1), 2000)
      }
    },
  })
  events.open(`${base.value}/tasks/${id}/stream?from=${from}`)
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
    <p v-if="busy" class="task-banner task-banner-loading" role="status">正在连接任务服务……</p>
    <p v-else-if="offline" class="task-banner task-banner-offline" role="status">
      任务服务不可用。提交与实时输出暂时关闭。静态说明仍可阅读。
    </p>

    <p class="task-note">任务与输出只保存在内存。服务重启后清空。</p>

    <form class="task-form" @submit.prevent="submit">
      <label class="task-field" for="task-command">
        <span class="task-label">命令</span>
        <select id="task-command" v-model="command" class="task-input" :disabled="offline" :aria-disabled="offline">
          <option v-for="name in allowlist" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <label class="task-field task-field-wide" for="task-args">
        <span class="task-label">参数</span>
        <textarea
          id="task-args"
          v-model="argsText"
          class="task-input task-args"
          rows="2"
          :disabled="offline"
          :aria-disabled="offline"
          placeholder="空格分隔，也可以每行一个"
        />
      </label>
      <label class="task-field" for="task-timeout">
        <span class="task-label">超时（秒）</span>
        <input
          id="task-timeout"
          v-model.number="timeoutS"
          class="task-input"
          type="number"
          min="1"
          :max="limits?.timeout_max_s"
          :disabled="offline"
          :aria-disabled="offline"
        />
      </label>
      <button
        type="submit"
        class="task-button"
        :disabled="offline || submitting || !command"
        :aria-disabled="offline || submitting || !command"
      >
        {{ submitting ? '提交中……' : '提交任务' }}
      </button>
    </form>

    <p v-if="limits" class="task-limits">
      并发上限 {{ limits.max_concurrency }} ·
      超时上限 {{ limits.timeout_max_s }} 秒 ·
      输出上限 {{ formatBytes(limits.output_max_bytes) }} ·
      保留 {{ limits.keep }} 条
    </p>
    <p v-if="notice" class="task-banner task-banner-error" role="alert">{{ notice }}</p>

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
                :aria-disabled="!canCancel(task) || cancellingId === task.id"
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
          <label class="task-toggle" for="task-autoscroll">
            <input id="task-autoscroll" v-model="autoScroll" type="checkbox" />
            自动滚动
          </label>
          <button type="button" class="task-link" @click="clearOutput">清空显示</button>
        </div>
        <div
          ref="outputEl"
          class="task-output"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          :aria-busy="streamBusy"
        >
          <p v-if="chunks.length === 0 && !selected" class="task-empty">选中一个任务，输出会出现在这里。</p>
          <p v-else-if="chunks.length === 0" class="task-empty">任务还没有输出。等第一批分片到达。</p>
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

<style scoped>
.task-console { display: grid; gap: var(--docs1-space-3); margin: var(--docs1-space-5) 0; }
.task-banner {
  margin: 0; padding: var(--docs1-space-2) var(--docs1-space-3);
  border-radius: var(--docs1-radius-md); font-size: var(--docs1-font-sm);
  background: var(--docs1-color-surface);
  border-left: var(--docs1-border-3) solid var(--docs1-color-border);
  color: var(--docs1-color-muted);
}
.task-banner-loading { border-left-color: var(--docs1-color-accent); color: var(--docs1-color-accent); }
.task-banner-error { border-left-color: var(--docs1-color-danger); color: var(--docs1-color-danger); }
.task-banner-offline { border-left-color: var(--docs1-color-warn); color: var(--docs1-color-warn); }
.task-note { margin: 0; font-size: var(--docs1-font-xs); color: var(--docs1-color-muted); }

.task-form {
  display: grid; gap: var(--docs1-space-4); align-items: end;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr) auto;
  padding: var(--docs1-space-5); border: var(--docs1-border-1) solid var(--docs1-color-border);
  border-radius: var(--docs1-radius-lg); background: var(--docs1-color-surface);
}
.task-field { display: grid; gap: var(--docs1-space-1); min-width: 0; }
.task-field-wide { min-width: 0; }
.task-label { font-size: var(--docs1-font-xs); color: var(--docs1-color-muted); }
.task-input {
  width: 100%; min-width: 0; padding: var(--docs1-space-2) var(--docs1-space-3);
  font-size: var(--docs1-font-sm); color: var(--docs1-color-text);
  border: var(--docs1-border-1) solid var(--docs1-color-border);
  border-radius: var(--docs1-radius-sm); background: transparent;
}
.task-args { resize: vertical; font-family: var(--vp-font-family-mono); }
.task-button {
  min-height: var(--docs1-space-9); padding: var(--docs1-space-2) var(--docs1-space-6);
  border: none; border-radius: var(--docs1-radius-sm); cursor: pointer;
  background: var(--docs1-color-accent); color: var(--docs1-color-on-accent);
  font-size: var(--docs1-font-sm);
}
.task-button[aria-disabled='true'] { opacity: 0.6; cursor: not-allowed; }
.task-limits { margin: 0; font-size: var(--docs1-font-xs); color: var(--docs1-color-muted); }

.task-grid { display: grid; gap: var(--docs1-space-6); align-items: start; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.task-panel {
  min-width: 0; padding: var(--docs1-space-5);
  border: var(--docs1-border-1) solid var(--docs1-color-border); border-radius: var(--docs1-radius-lg);
}
.task-panel-title {
  display: flex; flex-wrap: wrap; gap: var(--docs1-space-1) var(--docs1-space-4);
  justify-content: space-between; margin: 0 0 var(--docs1-space-3);
  font-size: var(--docs1-font-md); font-weight: 600;
}
.task-meta { font-size: var(--docs1-font-xs); font-weight: 400; color: var(--docs1-color-muted); }
.task-bytes { margin: 0 0 var(--docs1-space-3); font-size: var(--docs1-font-xs); color: var(--docs1-color-muted); }
.task-empty { margin: 0; font-size: var(--docs1-font-sm); color: var(--docs1-color-muted); }

.task-list { margin: 0; padding: 0; list-style: none; display: grid; gap: var(--docs1-space-3); }
.task-card {
  display: grid; gap: var(--docs1-space-2); padding: var(--docs1-space-4);
  border: var(--docs1-border-1) solid var(--docs1-color-border); border-radius: var(--docs1-radius-md);
}
.task-card-active { border-color: var(--docs1-color-accent); }
.task-card-head { display: flex; flex-wrap: wrap; gap: var(--docs1-space-1) var(--docs1-space-3); align-items: center; justify-content: space-between; }
.task-cmd { font-size: var(--docs1-font-xs); overflow-wrap: anywhere; }
.task-card-metrics { display: flex; flex-wrap: wrap; gap: var(--docs1-space-1) var(--docs1-space-4); font-size: var(--docs1-font-xs); color: var(--docs1-color-muted); }
.task-truncated { color: var(--docs1-color-warn); }
.task-card-actions { display: flex; flex-wrap: wrap; gap: var(--docs1-space-3); }
.task-link {
  min-height: var(--docs1-space-8); padding: var(--docs1-space-0) var(--docs1-space-4);
  border: var(--docs1-border-1) solid var(--docs1-color-border); border-radius: var(--docs1-radius-sm);
  background: transparent; color: var(--docs1-color-accent);
  cursor: pointer; font-size: var(--docs1-font-xs);
}
.task-link[aria-disabled='true'] { opacity: 0.5; cursor: not-allowed; color: var(--docs1-state-disabled); }
.task-status-ok { color: var(--docs1-color-success); border-color: var(--docs1-color-success); }
.task-status-bad { color: var(--docs1-color-danger); border-color: var(--docs1-color-danger); }
.task-status-run { color: var(--docs1-color-accent); border-color: var(--docs1-color-accent-soft); }
.task-status-idle { color: var(--docs1-color-muted); }

.task-output-tools {
  display: flex; flex-wrap: wrap; gap: var(--docs1-space-3); align-items: center;
  justify-content: space-between; margin-bottom: var(--docs1-space-3);
}
.task-toggle { display: inline-flex; gap: var(--docs1-space-2); align-items: center; font-size: var(--docs1-font-xs); color: var(--docs1-color-muted); }
.task-output {
  height: 20rem; overflow: auto; padding: var(--docs1-space-4);
  border-radius: var(--docs1-radius-md); background: var(--docs1-color-surface);
  font-family: var(--vp-font-family-mono); font-size: var(--docs1-font-xs); line-height: 1.6;
}
.task-line { display: flex; gap: var(--docs1-space-2); margin: 0; align-items: baseline; }
.task-line-err .task-text { color: var(--docs1-color-danger); }
.task-prefix { flex: 0 0 auto; color: var(--docs1-color-muted); }
.task-text { flex: 1 1 auto; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.task-size { flex: 0 0 auto; color: var(--docs1-color-muted); font-size: var(--docs1-font-xs); }

.task-input:focus-visible,
.task-button:focus-visible,
.task-link:focus-visible,
.task-toggle input:focus-visible {
  outline: var(--docs1-focus-ring);
  outline-offset: var(--docs1-focus-offset);
}

@media (max-width: 1024px) {
  .task-form { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .task-field-wide { grid-column: 1 / -1; }
  .task-output { height: 18rem; }
}
@media (max-width: 640px) {
  .task-form, .task-grid { grid-template-columns: minmax(0, 1fr); }
  .task-output { height: 15rem; }
}
@media (max-width: 480px) {
  .task-grid { gap: var(--docs1-space-3); }
  .task-panel { padding: var(--docs1-space-4); }
}
.task-button:active,
.task-button-ghost:active { background: var(--docs1-state-active); }
</style>
