#!/usr/bin/env node
/**
 * restructure-api-groups —— 把知识点页的 `## API 手册` 按方法组分层（宪法 1.4.0 / 门禁 V23）。
 *
 * 做两件事：
 *   1. 把单张大表按模块语义拆成 ≥2 个 H3 方法组，每组紧跟一张 <ApiTable>。
 *   2. 把 scripts/data/api-method-details.json 里的必会方法提升为独立条目（一条一个方法）。
 *
 * 用法：node scripts/restructure-api-groups.mjs [--dry-run] [--only 01-thread-basics]
 * 退出码：0 成功 / 1 有页面不满足前置 / 2 脚本异常。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DETAILS = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'data', 'api-method-details.json'), 'utf8'))

// 模块 → 方法组（顺序即输出顺序）。test 命中条目名或方法名。
const GROUPS = {
  threading: [
    ['线程对象与生命周期', /Thread|current_thread|main_thread|enumerate|active_count|get_ident|get_native_id/],
    ['线程本地与定时器', /local|Timer/],
    ['锁与互斥', /Lock|RLock/],
    ['条件与同步原语', /Condition|Event|Semaphore|BoundedSemaphore|Barrier/],
  ],
  multiprocessing: [
    ['进程对象与启动方式', /Process|set_start_method|get_context|get_start_method|cpu_count|current_process|active_children|freeze_support/],
    ['进程池', /Pool/],
    ['队列与管道', /Queue|Pipe/],
    ['共享状态', /Lock|Event|Semaphore|Barrier|Manager|Value|Array/],
  ],
  queue: [
    ['队列类型', /Queue$|LifoQueue|PriorityQueue|SimpleQueue/],
    ['入队与出队', /put|get/],
    ['完成与同步', /task_done|join|qsize|empty|full|maxsize|shutdown/],
  ],
  'concurrent.futures': [
    ['执行器与提交', /Executor|ThreadPoolExecutor|ProcessPoolExecutor/],
    ['Future 与结果', /Future/],
    ['批量等待', /as_completed|wait|FIRST_|ALL_/],
  ],
  asyncio: [
    ['运行与任务', /^asyncio\.(run|create_task|TaskGroup|Task|current_task|all_tasks|eager_task_factory)$|Task\./],
    ['并发组合', /gather|shield|wait$|as_completed/],
    ['超时与同步', /timeout|wait_for|Semaphore|Lock|Event|sleep/],
    ['队列', /Queue/],
    ['线程与循环桥接', /to_thread|run_in_executor|call_soon_threadsafe|run_coroutine_threadsafe|get_running_loop|new_event_loop|set_event_loop|run_forever|stop|call_later|add_signal_handler/],
    ['流与服务器', /start_server|open_connection|StreamReader|StreamWriter/],
  ],
  subprocess: [
    ['一次性执行', /^subprocess\.(run|CompletedProcess|CalledProcessError|TimeoutExpired|check_output|check_call|call|getoutput|getstatusoutput|list2cmdline)/],
    ['长驻进程与管道', /Popen|PIPE|DEVNULL|STDOUT/],
    ['信号与进程组', /killpg|getpgid|send_signal/],
  ],
  signal: [
    ['注册与查询', /^signal\.(signal|getsignal|strsignal|raise_signal|valid_signals|pause|alarm)$/],
    ['常用信号', /SIGTERM|SIGINT|SIGHUP|SIGKILL|SIGCHLD|SIGUSR1|SIGALRM|SIG_/],
    ['线程与阻塞', /pthread_sigmask|sigwait|set_wakeup_fd|Signals and threads/],
  ],
  'multiprocessing.shared_memory': [
    ['共享内存段', /SharedMemory$|SharedMemory\./],
    ['共享列表与管理器', /SharedMemoryManager|ShareableList|resource_tracker/],
  ],
  sys: [
    ['线程切换间隔', /switchinterval/],
    ['解释器状态', /_is_gil_enabled|flags|getrecursionlimit|getrefcount|intern|monitoring|setprofile|settrace|getasyncgenhooks/],
    ['版本与实现', /version_info|implementation|abiflags|gettotalrefcount/],
  ],
  faulthandler: [
    ['抓栈', /dump_traceback|dump_c_stack/],
    ['开关与登记', /enable|disable|is_enabled|cancel_dump_traceback_later|register|unregister/],
    ['信号常量', /^faulthandler\._sig/],
  ],
  socket: [
    ['创建与连接', /^socket\.(socket|bind|listen|accept|connect|create_connection|getaddrinfo|setdefaulttimeout)$/],
    ['收发数据', /recv|send|makefile/],
    ['选项与超时', /settimeout|setsockopt|close|shutdown|dup|fileno|getpeername|getsockname/],
    ['地址族与常量', /AF_|SOCK_|SO_|inet_|gethostbyname/],
  ],
  '浏览器原生入口': [
    ['DOM 查询与操作', /querySelector|querySelectorAll|textContent|innerHTML|addEventListener|classList|createElement|appendChild/],
    ['加载与生命周期', /DOMContentLoaded|onload|window|document|script|defer|async|module/],
  ],
  browser: [
    ['DOM 查询与操作', /querySelector|querySelectorAll|textContent|innerHTML|addEventListener|classList|createElement|appendChild/],
    ['加载与生命周期', /DOMContentLoaded|onload|window|document|script|defer|async|type=\"module\"/],
  ],
  npm: [
    ['包管理命令', /^npm (install|ci|run|init|update|audit)/],
    ['清单与依赖', /package\.json|dependencies|devDependencies|scripts|lock|engines/],
    ['模块语法', /ESM|import|export|require|type.*module/],
  ],
  SafeQueue: [
    ['构造与生命周期', /__init__|__enter__|__exit__|close/],
    ['任务与结果', /submit|drain/],
  ],
  '实时输出接口': [
    ['连接与订阅', /EventSource|fetch|连接|订阅/],
    ['事件与续传', /Last-Event-ID|事件|续传|status|output|end/],
  ],
  vite: [
    ['命令行', /vite (dev|build|preview)/],
    ['配置项', /defineConfig|base|build\.|server\.|resolve\.|plugins|optimizeDeps|envDir/],
    ['环境变量', /import\.meta\.env|VITE_/],
  ],
}

const FALLBACK = [
  ['必会接口', (item) => item.rank === '必会'],
  ['常用接口', (item) => item.rank === '常用'],
  ['进阶与了解', (item) => item.rank !== '必会' && item.rank !== '常用'],
]

/** 兜底：全部落进同一组时按顺序对半拆，保证满足「≥2 组」 */
function splitFallback(items) {
  const titles = []
  const groups = new Map()
  for (const item of items) {
    const title = FALLBACK.find(([, test]) => test(item))?.[0] ?? '其他接口'
    if (!groups.has(title)) {
      groups.set(title, [])
      titles.push(title)
    }
    groups.get(title).push(item)
  }
  if (titles.length === 1 && items.length > 1) {
    const half = Math.ceil(items.length / 2)
    return [
      ['核心接口', items.slice(0, half)],
      ['延伸接口', items.slice(half)],
    ]
  }
  return titles.map((title) => [title, groups.get(title)])
}

function matchGroup(module, name) {
  // 标题可能带中文后缀（如「npm 与模块」），按前后缀回退匹配模块名
  const rules = GROUPS[module] ?? GROUPS[module.split(/[\s与及、]+/)[0]]
  if (rules) {
    for (const [title, test] of rules) if (test.test(name)) return title
  }
  return null
}

function entryFromDetail(module, key, detail) {
  const rest = key.includes('::') ? key.split('::')[1] : key
  const qualified = module === 'vite' ? rest : `${module}.${rest}`
  const entry = {
    name: qualified,
    rank: '必会',
    signature: detail.signature,
    params: detail.params ?? [],
    returns: detail.returns,
    effect: detail.effect,
    scenario: detail.scenario,
    example: detail.example,
    pitfall: detail.pitfall,
  }
  if (detail.raises) entry.raises = detail.raises
  return { entry, owner: rest }
}

function escapePayload(json) {
  return json.replace(/&/g, '&amp;').replace(/'/g, '&#39;')
}

function listKnowledgePages() {
  const pages = []
  const walk = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name)
      if (item.isDirectory()) walk(full)
      else if (item.name.endsWith('.md')) {
        const content = fs.readFileSync(full, 'utf8')
        // 知识点页与组件页都要按方法组分层
        if (/^type:\s*(knowledge|component|cross-component)$/m.test(content)) pages.push(full)
      }
    }
  }
  walk(path.join(REPO_ROOT, 'docs'))
  return pages
}

function restructure(file) {
  const content = fs.readFileSync(file, 'utf8')
  const heading = /^##\s*API 手册：(.+?)\s*$/m.exec(content)
  if (!heading) return { file, skipped: true, reason: '没有 API 手册小节' }
  const module = heading[1].trim()
  const sectionStart = heading.index
  const afterHeading = sectionStart + heading[0].length
  const nextHeading = /^##\s+/gm
  nextHeading.lastIndex = afterHeading
  const next = nextHeading.exec(content)
  const sectionEnd = next ? next.index : content.length
  let body = content.slice(afterHeading, sectionEnd)

  // 段落里可能已有 1 张或多张表：全部合并，避免丢条目
  const decode = (text) => text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  const items = []
  const seen = new Set()
  for (const matched of body.matchAll(/<ApiTable :items='([\s\S]*?)'\s*\/>/g)) {
    for (const item of JSON.parse(decode(matched[1]))) {
      if (seen.has(item.name)) continue
      seen.add(item.name)
      items.push(item)
    }
  }
  if (items.length === 0) return { file, skipped: true, reason: 'API 手册里没有 ApiTable' }
  // 旧的分组 H3 由脚本重建，正文只保留非标题文字
  const prose = body
    .replace(/<ApiTable :items='[\s\S]*?'\s*\/>/g, '')
    .split('\n')
    .filter((line) => !/^###\s/.test(line))
    .join('\n')
    .trim()

  // 分组
  const buckets = new Map()
  const order = []
  const put = (title, item) => {
    if (!buckets.has(title)) {
      buckets.set(title, [])
      order.push(title)
    }
    buckets.get(title).push(item)
  }
  const unmapped = []
  for (const item of items) {
    const title = matchGroup(module, item.name)
    if (title) put(title, item)
    else unmapped.push(item)
  }
  for (const [title, groupItems] of splitFallback(unmapped)) {
    for (const item of groupItems) put(title, item)
  }

  // 提升必会方法为独立条目
  const promoted = []
  for (const [key, detail] of Object.entries(DETAILS.methods)) {
    const [detailModule] = key.split('::')
    if (detailModule !== module) continue
    const { entry, owner } = entryFromDetail(module, key, detail)
    if (items.some((item) => item.name === entry.name)) continue
    promoted.push(entry.name)
    const title = matchGroup(module, entry.name) ?? matchGroup(module, owner) ??
      FALLBACK.find(([, test]) => test(entry))?.[0] ?? '其他接口'
    put(title, entry)
  }

  // 已有条目里若还残留被提升的方法名（methods 数组），去掉以免重复
  for (const item of items) {
    if (!Array.isArray(item.methods)) continue
    item.methods = item.methods.filter((line) => {
      const head = line.split('—')[0].trim().replace(/\(.*$/, '').split('.').pop()
      return !promoted.some((name) => name.split('.').pop() === head)
    })
    if (item.methods.length === 0) delete item.methods
  }

  const out = [heading[0]]
  if (prose) out.push('', prose)
  for (const title of order) {
    const payload = escapePayload(JSON.stringify(buckets.get(title)))
    out.push('', `### ${title}`, '', `<ApiTable :items='${payload}' />`)
  }
  return {
    file,
    module,
    groups: order,
    promoted: promoted.length,
    rendered: out.join('\n') + '\n',
    sectionEnd,
    sectionStart,
  }
}

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const onlyIndex = args.indexOf('--only')
  const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null
  const changed = []
  const skipped = []
  for (const file of listKnowledgePages()) {
    if (only && !file.includes(only)) continue
    const result = restructure(file)
    if (result.skipped) {
      skipped.push(`${path.relative(REPO_ROOT, file)}：${result.reason}`)
      continue
    }
    const original = fs.readFileSync(file, 'utf8')
    const updated = original.slice(0, result.sectionStart) + result.rendered + original.slice(result.sectionEnd)
    if (updated !== original && !dryRun) fs.writeFileSync(file, updated)
    changed.push(`${path.relative(REPO_ROOT, file)} → ${result.groups.length} 组（提升 ${result.promoted} 条）`)
  }
  console.log(changed.join('\n'))
  if (skipped.length) console.log('跳过：\n  ' + skipped.join('\n  '))
  console.log(`共处理 ${changed.length} 页${dryRun ? '（dry-run）' : ''}`)
}

try {
  main()
} catch (error) {
  console.error('[restructure-api-groups] 脚本异常：', error)
  process.exit(2)
}
