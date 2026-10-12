# Implementation Plan: GitHub Actions 双远端发布与 GitHub Pages 站点（github-pages-deploy）

**Branch**: `005-github-pages-deploy` | **Date**: 2026-10-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-github-pages-deploy/spec.md`

## Summary

在保持内网链路不变的前提下，新增 GitHub 侧流水线：推送到主分支后，GitHub 侧执行同一套门禁、
以子路径构建站点并发布到 GitHub Pages，让读者在 `https://lizi-blue.github.io/docs1/` 直接访问。

三件事决定成败：

1. **子路径**：内网服务于根路径，Pages 服务于 `/docs1/`。构建入口读环境变量决定基础路径，
   两次构建共用同一份内容与引擎。
2. **链接正确**：组件内 15 处动态链接必须带基础路径前缀；markdown 链接由站点框架自动处理。
   产物必须零内网地址泄漏。
3. **深链可达**：产物是「无扩展名链接 + `.html` 文件」，需用确定性的兜底页保证深链不被平台行为左右。

## Technical Context

**Language/Version**: Node 22 + VitePress 1.6（站点）；Python 3.13（受控中文门禁与组件测试）
**Primary Dependencies**: 站点运行时零第三方依赖；托管侧仅用公共 CI 动作与公共包源
**Storage**: 无；Pages 只托管静态产物
**Testing**: 现有十一条门禁 + 新增产物门禁（Pages 产物断言）；发布后线上抽查
**Target Platform**: 内网 k3s（既有）+ GitHub Pages（新增，默认域名，无自定义域名）
**Project Type**: web 静态站点（同一份内容两个发布目标）
**Performance Goals**: 推送后 10 分钟内 Pages 可访问（SC-001）；发布运行时长与内网侧同量级
**Constraints**: 不得依赖内网资源与私有源；不得改变内网域名与健康检查；图解自包含（约 8MB）
**Scale/Scope**: 1 个仓库、2 个部署目标、11 条门禁、1 条新流水线

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 本计划的落实 | 结论 |
|---|---|---|
| I 内容即事实源 | 两个目标共用同一份内容与引擎；基础路径由环境变量注入，不复制内容 | PASS |
| II 零配置扩展 | 新增/调整内容不需要改流水线；路径由元数据派生 | PASS |
| III 内容契约可执行 | Pages 发布前执行与内网同一套门禁，失败不发布 | PASS |
| IV 受控中文与机械门禁 | 托管侧执行同一套门禁；新增产物门禁（内网地址零泄漏、基础路径正确） | PASS |
| V 图解自包含 | 图解已是自包含产物；发布产物断言不得外部资源 | PASS |
| VI 组件按生产级交付 | 依赖后端的组件在静态托管下降级显示，页面与依赖索引保持完整 | PASS |
| VII 规模优先 | 只新增一条流水线与一个门禁脚本；产物约 7MB，无新增服务 | PASS |
| VIII 教学编排持续改进 | 发布说明写入文档（两端地址与降级边界），台账记录本次迭代 | PASS |
| IX 内容深度与广度基线 | 内容不变，门禁不变 | PASS |
| X 导航层级与接口覆盖 | 子路径下导航与锚点必须可达（纳入发布后抽查） | PASS |
| XI 组件首发仓 | 组件页与复用清单不受影响；降级行为写进组件页使用文档 | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/005-github-pages-deploy/
├── spec.md              # 需求（已完成）
├── plan.md              # 本文件
├── research.md          # Phase 0：八个设计决策（基础路径、链接、深链、动作与权限、门禁同源、并发、降级、内网不变）
├── data-model.md        # Phase 1：部署目标、发布运行、门禁集合、降级组件、站点产物
├── quickstart.md        # Phase 1：S0–S8 验收剧本
├── contracts/
│   ├── pages-workflow-contract.md   # 流水线契约：触发、权限、门禁、产物、并发、失败提示
│   ├── base-path-contract.md        # 基础路径契约：取值规则、链接规则、校验方式
│   ├── degrade-contract.md          # 静态托管降级契约：可见文案与作用范围
│   └── dual-deploy-contract.md      # 双链路契约：互不阻塞、提交一致、失败隔离
├── checklists/requirements.md       # 规格质量清单（已完成）
└── tasks.md             # 由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
.github/workflows/pages.yml        # 新增：GitHub 侧构建 + 门禁 + 发布 Pages
scripts/check-pages-artifact.mjs   # 新增：产物门禁（基础路径、内网地址零泄漏、自包含资源）
scripts/pages-extra.mjs            # 新增：产出 .nojekyll 与深链兜底页（404.html）
docs/.vitepress/config.mts         # 改：base 读环境变量（默认 /）
docs/.vitepress/theme/components/  # 改：7 个组件的 15 处动态链接统一走 withBase
package.json                       # 改：新增 check:pages 脚本别名
AGENTS.md / README.md              # 改：两端地址、发布触发、降级边界与新增门禁命令
.gitea/workflows/ci.yaml           # 不改：内网链路保持原样
Caddyfile / deploy/ / Dockerfile   # 不改：内网交付物保持原样
```

**Structure Decision**: 内网链路（Gitea 工作流 + Caddy + K8s 清单）一律不动；
新增能力全部落在 GitHub 侧文件与两个新脚本上。基础路径通过环境变量进入同一构建入口，
避免复制内容或维护第二套配置。

## Complexity Tracking

| 复杂度来源 | 为什么需要 | 更简单的替代方案为何不够 |
|---|---|---|
| 基础路径由环境变量驱动 | 同一份内容要服务根路径与子路径两个目标 | 写死 `base`：必然牺牲其中一个目标 |
| 组件链接统一 `withBase()` | 7 个组件 15 处动态链接不受框架自动前缀保护 | 只在 Pages 侧改链接：等于维护两套组件行为 |
| 深链兜底页 | 产物是无扩展名链接，平台对深链的解析行为不由我们控制 | 只靠平台行为：一次平台差异就导致全站深链 404 |
| 产物门禁（内网地址零泄漏） | 公网产物绝不能暴露内网域名与私有地址 | 人工抽查：漏一次就是长期暴露 |
| 托管侧跑同一套门禁 | 公网内容不能比内网宽松 | 托管侧少跑门禁：内容质量在公网退化且无人发现 |

## Post-Design Constitution Re-Check（Phase 1 之后）

| 原则 | 设计产物中的落点 | 结论 |
|---|---|---|
| I 内容即事实源 | 两个目标共用同一份内容与引擎；只注入基础路径，不复制内容 | PASS |
| III 内容契约可执行 | `pages-workflow-contract.md` §3 固定步骤顺序，门禁与内网同源且失败即阻断发布 | PASS |
| IV 受控中文与机械门禁 | 新增 `scripts/check-pages-artifact.mjs`（产物门禁）并在流水线中先于发布执行 | PASS |
| V 图解自包含 | `base-path-contract.md` §3 断言产物零外部资源 | PASS |
| VII 规模优先 | 只新增一条流水线、两个脚本与一处配置改动（base 注入） | PASS |
| X 导航与接口覆盖 | 子路径下导航、锚点深链纳入发布后抽查（quickstart S3/S5） | PASS |
| XI 组件首发仓 | 组件页与复用清单不变；降级行为写进「使用文档」，不破坏组件页必需章节 | PASS |

**设计阶段确定的两条新门禁（实现阶段落地）**

- `npm run check:pages`：子路径产物的链接前缀、内网地址零泄漏、外部资源零引用、`.nojekyll` 与兜底页存在。
- `npm run check:pages` 同时作为流水线中「发布前最后一道闸门」，失败即不上传。

**留给实现阶段的验证边界**

- 平台对无扩展名深链的解析行为由兜底页接管，本地用静态服务复现（quickstart S3）；
  真实平台行为在首次发布后按 S5 抽查确认。
- 「未开启 Pages」的失败提示需在真实仓库上演练一次（quickstart S7），当前无法本地复现。
