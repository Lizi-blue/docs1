# Implementation Plan: 组件面向对象重构与教学专题（oo-component-teaching）

**Branch**: `008-oo-component-teaching` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

## Summary

按宪法原则 XII，把三个组件改成「对象模型驱动」：源码以对象为单位组织，页面先给对象清单，
再逐对象成节，然后讲对象间调用与关键流程（含失败与取消路径），最后让图解与对象模型一一对应。
同时删掉重复的知识点章节，知识点只登记一处。**先后端任务服务打样**，跑通后再复制到另外两个组件。

## Technical Context

**语言/运行时**：Python 3.13 标准库（后端服务）、Vue 3.5 + VitePress（前端组件与页面）
**依赖**：零第三方运行时依赖不变
**测试**：既有 `tests/test_task_service.py`（真起服务真跑子进程）作为对象化重构的安全网；
新增断言：对象清单与对象节数量一致、方法名与源码一致
**影响面**：`service/*`（拆分为对象模块）、`docs/*/components/*.md`（按对象重排）、
组件页契约与 `check:component`、`reuse/*/manifest.json`（文件清单随源码变化）
**约束**：URL 与导航层级不变；三档布局不受影响

## Constitution Check

| 原则 | 落点 | 结论 |
|---|---|---|
| I 内容即事实源 | 对象清单来自源码实际结构；页面渲染清单而不是另写一份 | PASS |
| III/IV 契约与门禁 | 组件页契约章节表更新为 15 节，门禁按新表校验并新增对象断言 | PASS |
| VI 组件按生产级交付 | 重构期间既有 44 个服务用例持续作为回归网 | PASS |
| XI 组件首发仓 | 对象化在本仓完成后再复制到生产项目 | PASS |
| **XII 组件以对象建模并逐对象讲解** | 本专题的全部内容；FR-001…FR-013 逐条对应 | PASS |

## Project Structure

```text
service/output.py                     # 已完成：OutputBuffer（缓冲、序号、截断、分发）
service/registry.py                   # TaskRegistry + Task（持有 OutputBuffer）
service/limits.py                     # 拆出 Allowlist（命令白名单与参数校验）
service/executor.py                   # 拆出 Executor / ChildProcess / MetricsSampler
service/app.py                        # 组合根 TaskService + StreamHub（SSE 订阅）
docs/backend/components/03-task-console.md   # 按对象模型重写（打样页）
docs/frontend/components/01-task-console.md  # 第二阶段
docs/backend/components/01-safe-queue.md     # 第三阶段
specs/004-.../contracts/component-page-contract.md  # 章节表 16 → 15 节
scripts/check-component.mjs           # C2 章节顺序 + 新增对象断言
reuse/*/manifest.json                 # 文件清单随源码更新
```

## Complexity Tracking

| 复杂度来源 | 为什么需要 | 简单替代为何不够 |
|---|---|---|
| 源码拆成对象模块 | 宪法 XII 要求以对象为单位组织，且要能按对象讲解 | 保留单文件：讲不清对象边界，也画不出稳定对象图 |
| 页面按对象重排 | 用户要求「分别讲解每个对象，再讲对象之间如何调用」 | 按功能罗列：读者记不住调用关系 |
| 契约与门禁同步改 | 章节表从 16 节变 15 节，必须机械校验 | 只改页面：门禁会按旧表判错或放过 |
