# Feature Specification: 并发任务下发与实时输出（task-dispatch）

**Feature Branch**: `003-task-dispatch`

**Created**: 2026-10-12

**Status**: Implemented

**Input**: User description: 「实现多线程多进程任务下发调度执行功能（支持下发、取消、性能监控等），再实现一个配套前端组件实时查看任务的 stdout 输出（例如支持下发一个 cp 命令在 Linux 执行，前端可以实时看到输出）」（承宪法 VIII 编排技能、IX 官方依据、X 层级与接口覆盖）。

## Clarifications

### Session 2026-10-12

- Q: 执行服务用什么技术栈？ → A: 仓内 Python 标准库服务（`service/`），线程池调度加每任务子进程。不引入第三方 Web 框架，避开私有索引依赖风险。
- Q: 取消如何可靠？ → A: 子进程独立进程组，先 `SIGTERM`，宽限期后 `SIGKILL`。任务已结束时取消返回 409。
- Q: 性能监控口径？ → A: 任务维度记录提交、开始与结束时间，耗时、退出码、CPU 时间、峰值常驻内存、输出字节数与结束原因。
- Q: 前端如何实时取 stdout？ → A: 同源 SSE（`text/event-stream`）。Caddy 反代 `/api/*` 到本机服务。断线用 `Last-Event-ID` 续传。
- Q: 安全边界？ → A: 命令白名单加参数校验（禁止 shell 元字符、禁止 `shell=True`），工作目录限定工作区，输出与超时与并发都有上限。
- Q: 部署形态？ → A: 同一容器。Caddy 托管静态站并反代 `/api`，入口脚本拉起 Python 服务；`/health` 仍由 Caddy 直返 200。不新增数据库与 PVC。

## User Scenarios & Testing

### User Story 1 - 下发任务并实时看输出（Priority: P1）

读者在演示页选择白名单命令（例如 `cp`），填写参数并提交。页面立即显示任务进入队列与运行状态，输出面板逐行追加标准输出与标准错误。

**Why this priority**: 这是本特性的核心价值，也是并发讲解的落地示例。

**Independent Test**: 提交一个复制大文件的 `cp` 任务，断言状态从 queued 到 running 再到 succeeded，且输出行数与文件写入过程对应。

**Acceptance Scenarios**:

1. **Given** 服务空闲，**When** 提交白名单内的 `cp` 任务，**Then** 1 秒内页面显示 running 并出现首批输出。
2. **Given** 任务运行中，**When** 输出持续产生，**Then** 面板按行追加且自动滚动，字节数递增。
3. **Given** 任务结束，**When** 查看任务卡片，**Then** 显示退出码、耗时、CPU 时间、峰值内存与输出字节数。

### User Story 2 - 取消运行中的任务（Priority: P1）

读者提交长任务后点击取消。服务向进程组发 `SIGTERM`，宽限期后发 `SIGKILL`。任务状态变为 canceled，已产生的输出仍可查看。

**Independent Test**: 提交 `sleep` 长任务并取消，断言 3 秒内状态变为 canceled 且进程组无残留。

**Acceptance Scenarios**:

1. **Given** 任务运行中，**When** 点击取消，**Then** 3 秒内状态为 canceled，`ps` 查不到该进程组。
2. **Given** 任务已结束，**When** 再次取消，**Then** 服务返回 409 并说明原因。

### User Story 3 - 性能监控与限额（Priority: P2）

读者在任务列表中看到每个任务的耗时、CPU、峰值内存与输出体积。超过并发上限时提交被拒，超过超时上限的任务自动置 timeout，输出超上限时截断并标记。

**Independent Test**: 并发提交超过上限，断言多出的请求返回 429；提交超时任务，断言状态为 timeout 且指标完整。

### User Story 4 - 安全边界（Priority: P1）

服务只执行白名单命令。参数含 shell 元字符或控制字符时被拒。工作目录限定在工作区，路径越界被拒。

**Independent Test**: 提交 `rm`、`sh -c`、含 `;` 与 `|` 的参数、以及越界路径，断言全部返回 400 且无副作用。

## Requirements

### Functional Requirements

- **FR-001**: 服务 MUST 提供端点：`POST /api/tasks`、`GET /api/tasks`、`GET /api/tasks/{id}`、`POST /api/tasks/{id}/cancel`、`GET /api/tasks/{id}/stream`（SSE）、`GET /api/health`。响应 MUST 为 JSON（流式端点除外）。
- **FR-002**: 提交体 MUST 为 `{command, args[], cwd?, timeout_s?, env?}`。`command` MUST 在白名单内。MUST NOT 接受整串 shell 命令。
- **FR-003**: 调度 MUST 用线程池（workers 可配置），每任务一个子进程，MUST NOT 使用 `shell=True`。
- **FR-004**: 状态机 MUST 为 `queued → running → succeeded | failed | canceled | timeout`，迁移单向且不可回退。
- **FR-005**: 输出 MUST 区分标准输出与标准错误（展示时带前缀），延迟 MUST ≤1 秒，MUST 支持 `Last-Event-ID` 断线续传（不丢不重）。
- **FR-006**: 取消 MUST 针对整个进程组，先 `SIGTERM`，宽限 3 秒后 `SIGKILL`。已结束任务取消 MUST 返回 409。
- **FR-007**: 每任务 MUST 记录：提交、开始、结束时间，耗时，退出码，CPU 时间，峰值常驻内存，输出字节数，结束原因。
- **FR-008**: 限额 MUST 可配置：并发上限（默认 4）、单任务超时上限（默认 300 秒）、输出上限（默认 1 MiB）、保留任务数（默认 50）。超限行为 MUST 明确：并发超限 429，超时置 `timeout`，输出超限截断并置 `truncated`。
- **FR-009**: 命令白名单 MUST 由配置文件给出，默认含 `cp`、`ls`、`echo`、`sleep`、`sha256sum`、`mkdir`、`dd`。参数 MUST 拒绝控制字符与 shell 元字符（`; | & $ > < \` ( ) { } * ? ! ~`）。`cwd` MUST 限定在工作区内。
- **FR-010**: 任务与输出 MUST 保留在内存环形缓冲，重启即清空。此限制 MUST 写进演示页说明。
- **FR-011**: 前端组件 MUST 提供：命令选择、参数输入、提交、取消、任务列表与实时输出面板。
- **FR-012**: 前端 MUST 用 `EventSource` 订阅 SSE，断线自动重连并续传；输出面板 MUST 自动滚动并显示字节数与状态。
- **FR-013**: 站点 MUST 提供一个可直接操作的页面（组件页），示例为在 Linux 执行 `cp`。
- **FR-014**: 服务核心（白名单校验、状态机、限额、SSE 续传）MUST 有 pytest 用例，CI MUST 运行。
- **FR-015**: `GET /health`（Caddy 直返）与 `GET /api/health`（服务）MUST 返回 200；后者 MUST 带版本与并发占用。
- **FR-016**: 部署 MUST 复用同一镜像与同一 Ingress 域名；MUST NOT 新增数据库、PVC 与额外端口。

### Key Entities

- **Task**：任务标识、命令与参数、工作目录、状态、时间戳三元组、退出码、结束原因。
- **TaskMetrics**：耗时、CPU 时间、峰值常驻内存、输出字节数、行数。
- **OutputChunk**：序号、流类型（stdout/stderr）、文本、时间戳。
- **Limits**：并发上限、超时上限、输出上限、保留数。
- **Allowlist**：命令名到默认参数的映射与参数规则。

## Success Criteria

- **SC-001**: 提交白名单任务后，1 秒内页面出现 running 与首批输出。
- **SC-002**: 复制 1 GiB 文件的任务全程输出可续传，结束后指标齐全（退出码、耗时、CPU、峰值内存、字节数）。
- **SC-003**: 取消在 3 秒内生效，进程组无残留。
- **SC-004**: 非白名单命令返回 400、并发超限返回 429、超时任务置 timeout，三类各有用例。
- **SC-005**: 输出达上限后截断，任务仍正常结束并标记 truncated。
- **SC-006**: 站点静态页与九条门禁不受影响（全绿）。
- **SC-007**: 断线重连后输出不丢不重，序号连续。

## Assumptions

- 无鉴权，限内网实验室使用。演示页 MUST 声明可执行命令范围与风险。
- 单副本部署，任务状态不跨实例共享。
- 服务与站点同源部署，前端不需要配置接口地址。
