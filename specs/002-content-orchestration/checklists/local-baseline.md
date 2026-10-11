# 本地验收证据（001 + 002）

> 每次验收把命令与真实输出摘要追加到本文件。禁止只写结论不写命令。

## 环境

| 项 | 值 |
|---|---|
| 仓库 | `/root/docs-1`（`dev/docs-1`，分支 `main`） |
| Node | v22.23.2（`check:content` 走 `--experimental-strip-types` 直载引擎） |
| Python | 3.13（`ste-lint-zh.py` 仅标准库） |
| 预览 | `npm run preview` → `0.0.0.0:4173`（容器内回环；仓外访问见 deploy 契约） |

## 提交轨迹

| 提交 | 内容 |
|---|---|
| `f44820b` | 引擎骨架 + 7 张 Archify 图解 + 两个方向示例内容（WIP 基线） |
| `0969beb` | 门禁地基：schemas 三份 + `check-content.mjs`（V1–V18）+ 忽略规则收窄 + 脚本别名 |
| `f079597` | 内容编排技能 + 自检 S1–S7 + 跨仓导出 + 迭代台账 |
| 本次收口 | 中文门禁封装、内容收口、CI 与交付物 |

## 门禁实测（本次收口，2026-10-11）

| 命令 | 结果 | 证据 |
|---|---|---|
| `npm run check:content` | **错误 0 项 / 警告 0 项** | V1–V18 全过；含 2 个知识域 `teach` 块、8 页四要素、9 页链接与图解 |
| `npm run check:zh` | **硬违规 0 处**（baseline 0） | 12872 字，13 条建议类提示；遮蔽四类代码型内容后归零 |
| `npm run check:orchestration` | **S1–S7 通过，警告 0 条** | 含 S3 连续三次、S6 版本一致、S7 基线单调 |
| `npm run test:component` | 1 passed / 3 skipped | 跳过原因：本容器沙箱禁止 `sem_open`；CI 镜像内会真实执行 |
| `npm run build` | **build complete** | 24 个页面与资源，含 7 张图解 |

### 路由冒烟（`vitepress preview`）

| 路由 | 状态 |
|---|---|
| `/`、`/backend/`、`/backend/learn/`、`/backend/components/` | 200 |
| `/backend/learn/concurrency/thread-basics` | 200 |
| `/backend/components/safe-queue`（组件页改名后 URL 不变） | 200 |
| `/frontend/learn/engineering/vite-dev-and-build` | 200 |
| `/diagrams/gil-workflow.html`、`/diagrams/queue-handshake.html` | 200 |

## 本轮修复的真实缺陷

| 缺陷 | 发现方式 | 处置 |
|---|---|---|
| 两页写成 `<ApiTable ::items=…>`（多一个冒号）→ 组件静默不渲染 | 中文门禁遮蔽规则未命中，暴露异常行 | 修正为 `:items`；预览确认 3 张参数表恢复渲染 |
| `check-content` 的 V17 用错知识域路径（`learn/<kd>` 而非 `<domain>/learn/<kd>`）→ 8 页全判「幽灵条目」 | 门禁自检报 9 项 V17 | 改用 `parseSegment` 从目录解析领域与知识域，再按模型匹配 |
| `npm run check:zh` 把目录传给上游脚本 → `Is a directory` 退出码 2 | 队友实测 | 改为封装 `scripts/lint-zh.mjs` 按文件清单调用 |
| 上游脚本把载荷代码、`TL;DR`、HTML 实体、契约强制标题当散文 → 69 处假阳性 | 按规则分布统计 | 封装遮蔽四类；基线 69 → **0** |
| 组件自测里 `dataclass` 报 AttributeError | 首次运行 | 执行前把模块注册进 `sys.modules` |

## 基线变更记录

| 时间 | 基线 | 理由 |
|---|---|---|
| 首次登记 | 69 | 未遮蔽代码型内容时的实测值 |
| 本次 | **0** | 遮蔽四类假阳性后真实硬违规为 0；台账已记 `baseline:0`，只减不增 |

## 待外部条件完成的验收

| 项 | 依赖 |
|---|---|
| 组件跨进程用例真实执行 | CI 镜像（Docker 内 `/dev/shm` 可用） |
| `docs1.minilab.uzibird.cn` 访问 | 用户侧添加 A 记录（阿里云 + OpenWrt），见 deploy 契约 §5 |
| 流水线首次 Run 与线上内容断言 | 推送后由 `ci` 模板执行，见 deploy 契约 §7 |
