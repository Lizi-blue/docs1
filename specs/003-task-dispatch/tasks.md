# Tasks: 并发任务下发与实时输出（task-dispatch）

> 实现进度：16/16 完成（2026-10-12）。证据：`tests/test_task_service.py`（46 passed / 3 skipped）、
> 本地全栈实测（Caddy 反代 + `cp` 任务 SSE 实时输出）、九条门禁全绿、CI 部署后经域名复验。

**Input**: `specs/003-task-dispatch/spec.md` + `plan.md`

## Phase 1 服务端核心

- [x] T001 建 `service/` 包：`config.json`（白名单与限额）、`limits.py`（加载与校验）、`__init__.py`。
- [x] T002 `registry.py`：任务模型、状态机（queued→running→succeeded|failed|canceled|timeout）、环形缓冲、线程安全。
- [x] T003 `executor.py`：线程池调度、子进程进程组、输出读取线程、超时与取消（SIGTERM→SIGKILL）、指标采集（CPU、峰值 RSS、字节数）。
- [x] T004 `app.py`：路由 `/api/health`、`/api/tasks`（POST/GET）、`/api/tasks/{id}`、`/api/tasks/{id}/cancel`、`/api/tasks/{id}/stream`（SSE + Last-Event-ID 续传）、错误码 400/404/409/429。
- [x] T005 参数与命令校验：白名单、元字符与控制字符拒绝、`cwd` 限定工作区、`args` 类型与长度上限。

## Phase 2 前端

- [x] T006 `TaskConsole.vue`：命令选择、参数输入、提交、取消、任务列表、实时输出面板（EventSource、自动滚动、字节数与状态、断线重连与续传）。
- [x] T007 组件页 `docs/backend/components/03-task-console.md`：设计说明、使用文档、三种引用方式、官方依据、API 表（七字段）、演示（`cp` 示例）。
- [x] T008 样式：响应式（手机/平板/桌面），输出面板等宽字体与滚动上限。

## Phase 3 部署与集成

- [x] T009 `Caddyfile`：`handle_path /api/*` 反代 `127.0.0.1:8787`；保留 `/health`。
- [x] T010 `scripts/entrypoint.sh`：拉起服务与 Caddy，转发 SIGTERM 并优雅退出。
- [x] T011 `Dockerfile`：运行阶段装 python3、拷贝 `service/`、使用入口脚本；保留现有六条门禁与健康检查。
- [x] T012 `.dockerignore` 与 `ci.env` 复核（不新增端口、不新增 DB/PVC）。

## Phase 4 测试与验收

- [x] T013 `tests/test_task_service.py`：白名单与元字符（400）、并发上限（429）、状态机单向、取消（409 与进程组清理）、超时置 timeout、输出截断标记、SSE 续传序号连续。
- [x] T014 本地端到端：起服务，提交 `cp` 大文件任务，curl SSE 抽查输出与指标；取消长任务校验无残留。
- [x] T015 线上验收：CI 部署后经域名访问演示页，提交 `cp` 任务并看到实时输出。
- [x] T016 门禁与文档：九条门禁全绿；AGENTS/README 补服务运行与安全边界说明；宪法如需新原则先补 Sync Impact Report。

## Dependencies

Phase 1 → Phase 2/3 可并行；Phase 4 依赖 1 与 3。T013 依赖 T004 的接口冻结。
