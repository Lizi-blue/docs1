# 本地验收证据（004 组件首发仓与前后端双端任务控制台）

> 每项记录命令与真实输出摘要。无法机械化的体验项在 S6/S7 以人工步骤列出。

## 环境

| 项 | 值 |
|---|---|
| 日期 | 2026-10-12 |
| Node / Python | v22.23.2 / 3.13 |
| 仓库 | `/root/docs-1`（`dev/docs-1`，main） |

## 门禁实测（十一条）

| 命令 | 结果 |
|---|---|
| `npm run check:content` | 错误 0 项 / 警告 0 项（V1–V23） |
| `npm run check:zh` | 硬违规 0（baseline 0），36639 字 |
| `npm run check:component` | 组件页 3 个 / **错误 0**（C1–C7） |
| `npm run check:experience` | **错误 0**（X1–X7） |
| `npm run check:orchestration` | S1–S7 通过，警告 0 |
| `npm run test:component` | `pytest tests/ -q` → 46 passed / 3 skipped（既有 safe-queue 用例受沙箱限制跳过） |
| `npm run selftest:gates` | 18 例全部符合预期（G0–G17） |
| `npm run check:extensibility` | E1–E10 通过 |
| `npm run build` | build complete |
| `npm run check:responsive` | 通过（R1–R7） |
| `npm run check:nav` | 通过（N1–N6） |

## S0 结构与复用资产

```
services: service/{app,registry,executor,limits,config.json,__init__}.py
组件页: docs/backend/components/01-safe-queue.md, 03-task-console.md；docs/frontend/components/01-task-console.md
复用清单: reuse/task-console/manifest.json（backend + frontend 两端）、reuse/safe-queue/manifest.json
约定与模板: reuse/README.md、templates/component/page.md.tmpl
```

## S1 方向纯净（FR-002 / SC-002）

- 机械：`check:component` 的 C3 对三页判 0 错；`selftest:gates` 的 G11 证明「后端页注入 `.vue`」会判红。
- 抽检：后端页 `grep -E "\.vue|EventSource|document\.|window\.|fetch\("` 命中 0；前端页 `grep -E "killpg|SIGTERM|/proc/|进程组|白名单"` 命中 0（豁免节除外）。
- 互链：后端页 `cross_link: /frontend/components/task-console` 与前端页回链双向一致；`safe-queue` 单方向不写该字段。

## S2 依赖知识索引（FR-003 / FR-004 / SC-001）

- 后端页 `knowledge_index` 4 条、前端页 4 条、safe-queue 3 条；`role` 均 10–80 字。
- 渲染实测：两页产物各出现 4 行知识索引；`KnowledgeIndex.vue` 对 `status: outline` 目标渲染「待补」而不产生死链。
- 机械：C4 通过（链接命中链接表或为 outline 入口）。

## S3 复用清单一致（FR-005 / FR-006 / FR-007 / SC-003 / SC-004）

- `python3 -m pytest tests/test_reuse_manifest.py -q` → **11 passed**（字段齐备、`files[].path` 存在、与组件页互指、适配点与验收命令非空、外部依赖不含私有源）。
- `check:component` C5 通过：三页的 `reuse_manifest` 与清单 `page` 互指。

## S4 空项目复用（SC-003）

```bash
mkdir -p /tmp/reuse-check/service
cp service/*.py service/config.json /tmp/reuse-check/service/
cd /tmp/reuse-check && DOCS1_WORKSPACE=/tmp/reuse-check/ws DOCS1_PORT=8799 python3 -m service.app
curl -sS http://127.0.0.1:8799/api/health          # → {"ok": true, ...}
POST /api/tasks {"command":"cp","args":["-v","/etc/hostname","h.copy"]}
```

实测：健康检查返回 200；任务 `succeeded`、退出码 0、输出 28 字节。复制文件仅 6 个，耗时约 1 分钟（人工验收清单要求 10 分钟内跑通）。

## S5 令牌与体验（FR-010…FR-016 / SC-005 / SC-007）

- `tokens.css`：space-0…9、font-xs…2xl、radius-sm/md/lg/pill、border-1/2/3、color-accent/info/success/warn/danger/on-accent、focus-ring、state-* 齐备，`html.dark` 覆盖同批令牌。
- `custom.css`：原始色值 **0**、令牌引用 152 处；裸 px 仅剩结构尺寸与安全区（契约白名单内）。
- `check:experience` X1–X7 → 0 错。

## S6 键盘流程（人工，SC-006）

机械代理证据：`TaskConsole.vue` 含 `<label for>` ×4、`aria-live="polite"`、`role="log"`、`role="alert"`、`aria-disabled`、`:focus-visible` 引用 `--docs1-focus-ring`；产物 `style.css` 含焦点环规则。
**待人工执行**：Tab 顺序（命令 → 参数 → 提交 → 取消）、Enter/Space 完成一次提交与取消、焦点环可见。

## S7 视口、深色与朗读顺序（人工，SC-007）

机械代理证据：`check:responsive` 通过（四档断点、宽内容自滚动、无固定大宽度）；`check:experience` X2（深色覆盖）与 X7（断点与滚动）通过。
**待人工执行**：375 / 768 / 1280 三档观感与横向溢出检查、深色模式可读性、屏幕阅读器朗读顺序。

## S8 门禁与上线（SC-008）

见下方「部署验收」小节。
