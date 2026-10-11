# Implementation Plan: 并发任务下发与实时输出（task-dispatch）

**Branch**: `003-task-dispatch` | **Date**: 2026-10-12 | **Spec**: `specs/003-task-dispatch/spec.md`

## Summary

在 `docs-1` 仓内新增一个 Python 标准库任务服务（`service/`），提供下发、取消、监控与 SSE 输出流；
VitePress 站点新增一个 Vue 组件与演示页，同源调用 `/api/*` 实时查看 stdout。
部署仍为单容器：Caddy 托管静态站并反代 `/api`，入口脚本同时拉起服务与 Caddy。

## Technical Context

- **语言/运行时**：Python 3.13（标准库 `http.server`、`subprocess`、`threading`、`queue`、`json`、`resource`）；前端 Vue 3 + VitePress 1.6。
- **依赖**：零第三方运行时依赖（避开私有索引风险）。
- **测试**：pytest（CI 已装 py3-pytest / pytest）。
- **部署**：同一镜像；Caddy `handle_path /api/*` 反代 `127.0.0.1:8787`；`/health` 由 Caddy 直返。
- **并发模型**：`ThreadingHTTPServer` 每请求一线程；线程池 `ThreadPoolExecutor` 调度任务；每任务一个子进程（独立进程组）。
- **存储**：内存环形缓冲（默认 50 个任务），重启清空。

## Constitution Check

| 原则 | 检查 |
|---|---|
| I 内容即事实源 | 演示页正文只写导语与用法，任务数据由组件实时渲染。 |
| III 内容契约可执行 | 新组件页走既有内容契约与门禁（V7–V22）。 |
| IV 受控中文与机械门禁 | 新增文档与代码注释遵守受控中文；门禁保持全绿。 |
| VI 组件按生产级交付 | 组件页含设计说明、使用文档、三种引用方式与测试。 |
| IX 官方依据 | 服务实现依据官方文档（`http.server`、`subprocess`、`selectors`、`resource`），演示页标注版本。 |
| X 导航层级与接口覆盖 | 组件页进入组件查询；接口按分档讲清阻塞与误区。 |

新增约束：**本特性引入服务端执行能力**，因此 MUST 遵守 §安全边界（白名单、无 `shell=True`、限额）。

## Project Structure

```
service/
  __init__.py
  app.py            # HTTP 路由 + SSE
  registry.py       # 任务注册表、状态机、环形缓冲
  executor.py       # 线程池调度 + 子进程管理（进程组、超时、取消）
  limits.py         # 限额与白名单加载
  config.json       # 白名单与限额默认值
tests/
  test_task_service.py   # 服务核心用例
docs/.vitepress/theme/components/TaskConsole.vue
docs/backend/components/03-task-console.md
scripts/entrypoint.sh      # 同时拉起服务与 Caddy
Caddyfile                  # 增加 /api 反代
Dockerfile                 # 运行阶段加 python3 与服务
```

## Interfaces（前后端契约）

| 端点 | 方法 | 请求 | 响应 |
|---|---|---|---|
| `/api/health` | GET | — | `{ok, version, running, limits}` |
| `/api/tasks` | POST | `{command, args[], cwd?, timeout_s?}` | 201 `Task`；400 校验失败；429 并发超限 |
| `/api/tasks` | GET | `?limit=` | `{tasks: TaskSummary[], limits}` |
| `/api/tasks/{id}` | GET | — | `{task, metrics}`；404 |
| `/api/tasks/{id}/cancel` | POST | — | 200 `{id, status}`；409 已结束 |
| `/api/tasks/{id}/stream` | GET | `?from=N` 或 `Last-Event-ID` | SSE：`output` / `status` / `end` 事件 |

## Risks

| 风险 | 处置 |
|---|---|
| 任意命令执行 | 白名单 + 参数校验 + 无 `shell=True` + 工作区限定 |
| 输出把内存打满 | 输出上限截断并标记 `truncated`；环形缓冲 |
| 取消不彻底 | 进程组 `SIGTERM` → 宽限 3 秒 → `SIGKILL` |
| 长任务拖住线程 | 线程池上限 + 单任务超时上限 |
| 与静态站同容器冲突 | Caddy 反代 `/api`；入口脚本负责信号转发与优雅退出 |
