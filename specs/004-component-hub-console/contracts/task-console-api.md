# 契约：任务控制台两端接口（task-console-api）

同一功能由两个方向的组件组成，各自只实现自己那一半。本契约冻结两端之间的接口与事件，
是「复制即可复用」的前提：只要目标项目满足本契约，前端组件无需改动业务逻辑。

## 1. 分工

| 方向 | 组件 | 职责 | 不负责 |
|---|---|---|---|
| 后端 | 任务服务组件（`service/`） | 接收下发、调度执行、进程组取消、超时与限额、指标采集、输出缓存、SSE 推送 | 页面呈现、用户交互、样式 |
| 前端 | 控制台组件（`TaskConsole.vue`） | 表单与校验提示、状态机呈现、实时输出面板、错误与降级、键盘可达 | 执行命令、进程管理、白名单判定 |

## 2. HTTP 接口（前端 → 后端）

| 端点 | 方法 | 请求 | 成功 | 失败 |
|---|---|---|---|---|
| `/api/tasks` | POST | `{command, args[], cwd?, timeout_s?}` | 201 `Task` | 400 校验失败；429 并发超限 |
| `/api/tasks` | GET | `?limit=` | 200 `{tasks[], limits}` | — |
| `/api/tasks/{id}` | GET | — | 200 `{task, metrics}` | 404 |
| `/api/tasks/{id}/cancel` | POST | — | 200 `{id, status, cancel_requested}` | 404；409 已结束 |
| `/api/tasks/{id}/stream` | GET | `Last-Event-ID` 或 `?from=N` | 200 `text/event-stream` | 404 |
| `/api/health` | GET | — | 200 `{ok, version, running, limits}` | — |

字段口径以 `specs/003-task-dispatch/contracts/`（若存在）与 `plan.md` 的接口表为准；
两端 MUST 使用同一口径，MUST NOT 各自扩展私有字段。

## 3. 事件流（后端 → 前端）

| 事件 | `data` | 语义 |
|---|---|---|
| `status` | `{id, status, from_seq}` | 连接建立时的当前状态；`status` 取 `queued/running/succeeded/failed/canceled/timeout` |
| `output` | `{seq, stream, text, ts}` | 一行或一块输出；`stream` 为 `stdout` / `stderr`；`seq` 单调递增 |
| `end` | `{id, status, reason, exit_code, signal, metrics}` | 任务结束；收到后前端 MUST 关闭连接 |

规则：

- `seq` MUST 单调递增且可续传：前端重连时带 `Last-Event-ID`，MUST NOT 丢行或重复渲染。
- 前端 MUST 按 `seq` 去重；MUST 在 `end` 后停止重连。
- 后端 MUST NOT 依赖前端的渲染节奏：客户端断开不影响任务执行。

## 4. 降级与失败约定

| 场景 | 前端行为 | 后端行为 |
|---|---|---|
| 服务不可用（健康检查失败） | 显示降级提示与排查建议，禁用提交 | — |
| 提交被拒（400/429） | 展示原因与下一步（如「并发已满，稍后再试」） | 返回结构化错误 `{error:{status,message}}` |
| 取消已结束任务 | 提示「任务已结束」，刷新状态 | 409 |
| 输出超限 | 明确提示已截断并显示上限 | 截断并置 `truncated` |
| 长时间无输出 | 保持连接与心跳文案 | 定期发送 `: keep-alive` 注释帧 |

## 5. 复用适配点

复制到其他项目时，只允许改这三处：

1. **接口基地址**（默认同源，若不同源则配置前缀）。
2. **白名单与限额默认值**（后端 `config.json`）。
3. **品牌与文案**（通过设计令牌与组件属性，不改结构）。

其他任何改动意味着契约被破坏：MUST 递增 `contract_version` 并写迁移步骤。
