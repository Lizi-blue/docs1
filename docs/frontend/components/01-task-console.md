---
title: "任务控制台 · 前端组件"
type: component
domain: frontend
direction: frontend
component_type: library
order: 1
install_command: "npm install vue"
knowledge_index:
  - page: /frontend/learn/engineering/vite-dev-and-build
    role: "开发态按需编译单文件组件，构建产出静态产物"
  - page: /frontend/learn/engineering/npm-and-modules
    role: "Vue 依赖的声明方式与版本锁定"
  - page: /frontend/learn/engineering/project-structure
    role: "组件目录与构建产物的落位约定"
  - page: /backend/learn/communication/socket-and-streams
    role: "SSE 长连接与分片推送的协议语义"
reuse_manifest: reuse/task-console/manifest.json
cross_link: /backend/components/task-console
tags_index: [vue3, sse, accessibility, log-panel]
reusability: high
description: "Vue 3 任务控制台：提交、取消、状态呈现与实时日志面板"
---

# 任务控制台 · 前端组件

## 组件简介

前端任务控制台：一块面板里下发命令、看任务状态、盯实时输出。

它解决三件事：表单与提示、状态呈现、日志面板的续传与去重。

服务不在时页面照常打开，只给一条降级提示。

本页只讲浏览器侧实现。服务端实现见下一节的对端页面。

## 对应另一端

服务端的调度、取消与推送由 [后端任务服务](/backend/components/task-console) 承担。

本组件只消费接口，不关心命令怎么落地。

## 依赖的知识域与知识点

<KnowledgeIndex />

## 对象模型

前端控制台由三个对象组成。

| 对象 | 职责 | 状态 | 生命周期 |
|---|---|---|---|
| `ApiClient` | 发 HTTP 请求、解析 JSON、把错误体翻成一句中文提示 | 无（纯函数式调用） | 组件挂载时创建一个实例 |
| `EventStream` | 创建与关闭 SSE 连接，把事件交给回调 | 当前 `EventSource` 句柄 | 每次打开输出流时创建一个实例 |
| `TaskConsole` | 视图与状态容器：表单、任务卡、日志面板与提示 | 任务列表、选中项、输出行、序号、在线状态 | 页面挂载时创建，卸载时销毁 |

每个对象单独一节。

### ApiClient

源码位置：`docs/.vitepress/theme/components/task-console/api.ts`。

| 项 | 内容 |
|---|---|
| 职责 | 发请求、解析 JSON、把错误体翻成一句中文提示 |
| 持有 | 无 |
| 方法 | `request(path, init)`、`ApiClient.messageOf(data, fallback)` |
| 边界 | 不碰 Vue 状态，不碰订阅，不写界面 |
| 谁调用它 | `TaskConsole` 的 `refresh`、`submit`、`cancel`、`updateSelected` |
| 它调用谁 | 浏览器 `fetch` |

### EventStream

源码位置：`docs/.vitepress/theme/components/task-console/stream.ts`。

| 项 | 内容 |
|---|---|
| 职责 | 创建连接、转发 `output` / `status` / `end` 三类事件、关连接 |
| 持有 | 当前 `EventSource` 句柄 |
| 方法 | `open(url)`、`close()` |
| 边界 | 不解析业务字段，不管重连节奏，不碰界面 |
| 谁调用它 | `TaskConsole` 的 `openStream` 与 `closeStream` |
| 它调用谁 | 浏览器 `EventSource`，回调交给 `TaskConsole` |

### TaskConsole

源码位置：`docs/.vitepress/theme/components/TaskConsole.vue`。

| 项 | 内容 |
|---|---|
| 职责 | 界面与状态：命令表单、任务列表、日志面板、提示与降级 |
| 持有 | `ApiClient`、`EventStream`、任务列表、输出行、序号与在线状态 |
| 方法 | `refresh`、`submit`、`cancel`、`updateSelected`、`openStream`、`closeStream`、`pushChunk` |
| 边界 | 不直连数据库，不判断白名单，不做命令拼接 |
| 谁调用它 | 组件页的 `<TaskConsole />` 挂载 |
| 它调用谁 | `ApiClient`、`EventStream` |

## 对象层级

源码没有继承，关系全是持有。

| 子类 | 父类 | 扩展或覆盖 |
|---|---|---|
| 无 | 无 | 本组件没有继承 |

| 持有者 | 被持有者 | 用途 |
|---|---|---|
| `TaskConsole` | `ApiClient` | 取任务列表、提交与取消 |
| `TaskConsole` | `EventStream` | 订阅某一个任务的输出 |

## 对象协作与流程

### 对象关系

| 关系 | 从 | 到 | 说明 |
|---|---|---|---|
| 持有 | `TaskConsole` | `ApiClient` | 所有请求经由它 |
| 持有 | `TaskConsole` | `EventStream` | 打开输出流时创建 |
| 回调 | `EventStream` | `TaskConsole` | 输出、状态与结束帧回到组件 |
| 回调 | `ApiClient` | `TaskConsole` | 状态码与数据回到调用处 |

### 流程一：提交到看到输出

1. 读者在表单里选命令与参数，组件做一次本地校验。
2. `TaskConsole` 调 `ApiClient.request` 提交任务。
3. 201 时把新任务放进列表，并选中它。
4. `TaskConsole` 调 `openStream`，由 `EventStream` 创建 SSE 连接。
5. 服务端推 `status` 帧，组件更新任务状态。
6. 服务端推 `output` 帧，`pushChunk` 追加输出行并按需自动滚动。
7. `end` 帧到达，组件收尾并调 `refresh` 对齐列表。
8. `EventStream.close` 关闭连接，`TaskConsole` 释放实例。

### 流程二：服务不可用时的降级

1. `ApiClient.request` 失败或返回非 200，组件把在线状态置为 false。
2. 界面出现降级提示，说明服务不可用与影响范围。
3. 提交按钮进入禁用态，读者仍能阅读正文与图解。
4. 组件继续按间隔轮询列表，等服务恢复。
5. 列表重新可读时，在线状态回到 true，表单重新可用。

## 组合方式图解

下图回答一个问题：一条输出从服务端分片到面板，中间经过哪几道处理。

<DiagramFrame src="/diagrams/executor-lifecycle.html" title="分片从服务端到日志面板的路径（Archify 交互图）" :height="480" />

## 核心源码

源码按对象分块。两个新增对象是独立文件，视图组件是单文件组件。
文件清单与验收命令见「复用四件套」。

### ApiClient

来源：`docs/.vitepress/theme/components/task-console/api.ts`。

```ts
/**
 * 前端控制台对象一：ApiClient。
 *
 * 职责：发 HTTP 请求、解析 JSON、把错误体翻成一句中文提示。
 * 边界：不碰 Vue 状态，不碰订阅，不写界面。
 * 被谁持有：TaskConsole 组件持有一个实例。
 */
export interface ApiResult {
  status: number
  data: unknown
}

export class ApiClient {
  /** 发一次请求。返回状态码与解析后的数据；解析失败时 data 为 null。 */
  async request(path: string, init?: RequestInit): Promise<ApiResult> {
    const response = await fetch(path, init)
    let data: unknown = null
    try {
      data = await response.json()
    } catch {
      data = null
    }
    return { status: response.status, data }
  }

  /** 从错误体里取一句可读原因。 */
  static messageOf(data: unknown, fallback: string): string {
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>
      for (const key of ['detail', 'error', 'message']) {
        const value = record[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
      }
    }
    return fallback
  }
}
```

### EventStream

来源：`docs/.vitepress/theme/components/task-console/stream.ts`。

```ts
/**
 * 前端控制台对象二：EventStream。
 *
 * 职责：创建与关闭 SSE 连接，把事件交给回调。
 * 边界：不解析业务字段，不管重连节奏，不碰界面。
 * 被谁持有：TaskConsole 组件在打开输出流时创建一个实例。
 */
export interface StreamCallbacks {
  onOpen(): void
  onOutput(raw: string): void
  onStatus(raw: string): void
  onEnd(raw: string): void
  /** 连接被彻底关闭时回调，由调用方决定是否重建。 */
  onClosed(): void
}

export class EventStream {
  private source: EventSource | null = null

  constructor(private readonly callbacks: StreamCallbacks) {}

  open(url: string): void {
    this.close()
    const stream = new EventSource(url)
    this.source = stream
    stream.onopen = () => this.callbacks.onOpen()
    stream.addEventListener('output', (event) => {
      this.callbacks.onOutput((event as MessageEvent).data)
    })
    stream.addEventListener('status', (event) => {
      this.callbacks.onStatus((event as MessageEvent).data)
    })
    stream.addEventListener('end', (event) => {
      this.callbacks.onEnd((event as MessageEvent).data)
    })
    stream.onerror = () => {
      // 浏览器会自动重连并带上 Last-Event-ID。彻底关闭时由调用方按序号重建。
      if (stream.readyState === EventSource.CLOSED) this.callbacks.onClosed()
    }
  }

  close(): void {
    if (this.source) {
      this.source.close()
      this.source = null
    }
  }
}
```

### TaskConsole

视图组件较长，完整文件见 `docs/.vitepress/theme/components/TaskConsole.vue`。
它只做三件事：调 `ApiClient`、开 `EventStream`、渲染状态。
## 设计说明

- 只用浏览器原生接口。请求走 `fetch`，输出走 `EventSource`，不引入第三方库。
- 列表靠轮询，输出靠推流。轮询每 3 秒一次，输出按分片实时到达。
- 续传有两条路。浏览器自动重连带 `Last-Event-ID`，连接彻底关闭后按序号重建。
- 面板只留本次会话的分片。切换任务即释放，长输出不会一直占内存。
- 四态齐全。加载、空、错误、降级各有一句提示，读者不用猜。
- 键盘可达。每个输入有 `<label for>`，日志面板用 `aria-live` 播报，焦点环走设计令牌。

### 官方依据与版本差异

- [MDN EventSource](https://developer.mozilla.org/zh-CN/docs/Web/API/EventSource) — Chrome 6 与 Firefox 6 起提供。
- [MDN fetch](https://developer.mozilla.org/zh-CN/docs/Web/API/Window/fetch) — Chrome 42 与 Firefox 39 起提供。
- [Vue script setup](https://vuejs.org/api/sfc-script-setup.html) — Vue 3.2 起稳定。

## 使用文档

在页面里直接写标签。接口默认同源，前缀为 `/api`。

```md
<TaskConsole />
```

接口不同源时给出前缀。前缀末尾不要带斜杠。

```md
<TaskConsole api-base="https://tasks.example.com/api" />
```

下面这块由本页直接加载。服务不在时会给降级提示。

<TaskConsole />

### 公网静态托管的边界

公网站点只有静态文件，没有后端服务。此时提交与实时输出不可用。

页面会给一条降级提示，说明原因与影响范围。正文、图解与索引照常可读。

需要真实交互时，用 `api-base` 指向你自己的服务，或在本机起默认服务。

## 复用四件套

本节渲染 `reuse/task-console/manifest.json` 的前端部分。清单落地前先按下表对齐字段名。

| 件 | 内容 |
|---|---|
| 文件清单 | `docs/.vitepress/theme/components/TaskConsole.vue`（组件本体，必需）、`docs/.vitepress/theme/index.ts`（注册入口，可选） |
| 外部依赖 | `vue` 3.5，公开依赖，用包管理器安装 |
| 适配点 | 接口前缀改 `api-base`。轮询间隔与输出上限按项目调整 |
| 验收命令 | `npm run build`，期望构建成功且页面出现面板 |

## 其他项目如何引用

### 方式一：复制单个组件文件

把组件文件放进你的组件目录，改 `api-base` 指向你的接口。

```bash
cp docs/.vitepress/theme/components/TaskConsole.vue your-app/src/components/
```

### 方式二：注册为全局组件

在应用入口注册一次，任意模板都能用。

```javascript
import TaskConsole from './components/TaskConsole.vue'

app.component('TaskConsole', TaskConsole)
```

### 方式三：接进自己的接口

保持端点与事件名不变，只换服务地址。

```javascript
// 端点约定
// GET  /api/tasks            -> { tasks, limits }
// POST /api/tasks            -> 201 任务
// POST /api/tasks/{id}/cancel
// GET  /api/tasks/{id}/stream (SSE: output / status / end)
```

## 接口契约

组件消费四个端点与三种事件。缺一项就会降级或给错误提示。

| 端点 | 方法 | 组件用途 | 失败时的表现 |
|---|---|---|---|
| `/api/tasks` | GET | 拉命令清单与任务列表 | 转离线态并提示 |
| `/api/tasks` | POST | 下发任务 | 400 给校验提示，429 给并发提示 |
| `/api/tasks/{id}/cancel` | POST | 取消任务 | 409 提示任务已结束 |
| `/api/tasks/{id}/stream` | GET | 订阅输出分片 | 关流后按序号重建 |

三种事件的载荷格式固定。`output` 带 `seq`、`stream`、`text`，`status` 带 `status`，`end` 带终态与指标。

`output` 的 `stream` 只有 `stdout` 与 `stderr` 两个取值。面板按取值给前缀。

### 契约版本与迁移

当前 `contract_version` 为 `1.0.0`。端点、事件名与字段名在本版内不变。

破坏性变更要递增主版本号，并在本节写明迁移步骤与替代字段。

未知事件名按忽略处理。服务端新增事件不会打断旧版组件。

## API 手册：任务控制台组件

### TaskConsole

<ApiTable :items='[{"name":"&lt;TaskConsole /&gt;","rank":"必会","signature":"&lt;TaskConsole api-base=\"/api\" /&gt;","params":[{"name":"api-base","type":"string","default":"/api","desc":"接口前缀，同源可省略"}],"returns":"无（渲染整块面板）","effect":"渲染下发表单、任务列表与日志面板","scenario":"演示页或业务页嵌一块任务面板","example":"&lt;TaskConsole /&gt;","exampleLang":"html","pitfall":"跨域部署要显式给 api-base。同源时留空即可。"},{"name":"api-base 属性","rank":"常用","signature":"api-base=\"string\"","params":[{"name":"value","type":"string","default":"/api","desc":"接口前缀"}],"returns":"无","effect":"决定所有请求的路径前缀","scenario":"接口与页面不同源","example":"&lt;TaskConsole api-base=\"https://tasks.example.com/api\" /&gt;","exampleLang":"html","pitfall":"前缀末尾不要带斜杠，否则拼出双斜杠路径。"}]' />

### EventStream

<ApiTable :items='[{"name":"EventSource 订阅","rank":"必会","signature":"new EventSource(url)","params":[{"name":"url","type":"string","default":"必填","desc":"SSE 端点地址"}],"returns":"事件源对象","effect":"长连服务端，按事件名收分片","scenario":"实时日志面板","example":"const source = new EventSource(`${apiBase}/tasks/${id}/stream?from=0`)\nsource.addEventListener(&#39;output&#39;, (event) =&gt; pushChunk(event.data))","exampleLang":"javascript","pitfall":"响应不是 text/event-stream 时连接直接关闭，不会自动重连。"},{"name":"Last-Event-ID 续传","rank":"必会","signature":"?from=N 与 Last-Event-ID 请求头","params":[{"name":"from","type":"number","default":"0","desc":"起始分片序号"}],"returns":"缺失的后续分片","effect":"断线重连后补齐缺口","scenario":"网络抖动或切后台再回来","example":"openStream(id, lastSeq + 1)","exampleLang":"javascript","pitfall":"服务端没回 id 字段时浏览器不带 Last-Event-ID，要用 from 兜底。"},{"name":"序号去重","rank":"常用","signature":"seenSeq.has(chunk.seq)","params":[{"name":"seq","type":"number","default":"必填","desc":"分片序号"}],"returns":"布尔值","effect":"重复分片直接丢弃","scenario":"重连或补发出现重叠","example":"if (seenSeq.has(chunk.seq)) return\nseenSeq.add(chunk.seq)","exampleLang":"javascript","pitfall":"去重只认序号。同一序号文本不同时以先到的为准。"},{"name":"自动滚动","rank":"常用","signature":"scrollTop = scrollHeight","params":[{"name":"autoScroll","type":"boolean","default":"true","desc":"是否跟随最新输出"}],"returns":"无","effect":"新分片到达后滚到底部","scenario":"长输出持续追加","example":"await nextTick()\npanel.scrollTop = panel.scrollHeight","exampleLang":"javascript","pitfall":"读者向上翻阅时不要抢滚动，组件提供开关。"}]' />

### ApiClient

<ApiTable :items='[{"name":"状态呈现","rank":"必会","signature":"STATUS_TEXT[status]","params":[{"name":"status","type":"string","default":"必填","desc":"queued / running / 终态"}],"returns":"中文标签与配色类","effect":"任务卡片显示状态、退出码与指标","scenario":"任务列表与详情","example":"&lt;span class=\"badge\"&gt;{{ STATUS_TEXT[task.status] }}&lt;/span&gt;","exampleLang":"html","pitfall":"终态有四种。不要只判断成功与失败两种。"},{"name":"错误提示映射","rank":"常用","signature":"HTTP 状态码 → 提示文案","params":[{"name":"status","type":"number","default":"必填","desc":"响应状态码"}],"returns":"一句中文提示","effect":"把 400、404、409、429 翻成读者能懂的话","scenario":"提交或取消失败","example":"if (status === 429) notice.value = \"并发已达上限，等任务结束再提交。\"","exampleLang":"javascript","pitfall":"只有网络失败才抛错。4xx 要自己读状态码再给提示。"},{"name":"降级检测","rank":"必会","signature":"online: boolean | null","params":[],"returns":"三态：未知、在线、离线","effect":"列表读不到时关掉表单并给提示","scenario":"静态托管或服务未启动","example":"if (status !== 200 || !Array.isArray(payload.tasks)) online.value = false","exampleLang":"javascript","pitfall":"读不到列表就按离线处理，同时继续轮询等恢复。"}]' />

## 常见误区

- 「`EventSource` 出错后一定会自动重连」是错的。响应不是 `text/event-stream` 时连接直接关闭。
- 「`fetch` 遇到 404 会抛错」是错的。它只在网络层失败时抛出，4xx 要自己读状态码。
- 「重连一定会重复输出」是错的。分片带序号，面板按序号去重。
- 「日志面板可以无限留存」是错的。面板只保留本次会话的分片，切换任务即释放。

## 面试追问链

<details>
<summary>Q1：为什么用 SSE 而不是 WebSocket？</summary>

输出是单向推送。SSE 走普通 HTTP，断线重连与序号续传由协议自理。

</details>

<details>
<summary>Q2：既然浏览器会自动重连，为什么还要自己记序号？</summary>

自动重连依赖服务端回的 `id` 字段。没带时浏览器从头请求，组件按最大序号加一兜底。

</details>

<details>
<summary>Q3：重连后怎么做到不丢不重？</summary>

每个分片带唯一序号。面板丢弃已见序号，只请求缺口之后的内容。

</details>

<details>
<summary>Q4：读者向上翻阅时，面板还在抢滚动怎么办？</summary>

面板给出自动滚动开关。关闭后新分片只追加，不改滚动位置。

</details>

<details>
<summary>Q5：服务没起来时页面会白屏吗？</summary>

不会。列表读不到就转离线态，表单禁用并给提示，轮询继续等恢复。

</details>

## 与其他组件的关系

前端方向当前只有本组件。它消费 [后端任务服务](/backend/components/task-console) 的接口。

后端方向的 [进程安全队列](/backend/components/safe-queue) 与它同源：一个守进程内队列，一个守浏览器面板。

## 下一讲衔接

组件在 Vite 项目里的编译与产物落位见 [Vite 开发与构建](/frontend/learn/engineering/vite-dev-and-build)。

依赖声明与版本锁定见 [npm 与模块](/frontend/learn/engineering/npm-and-modules)。
