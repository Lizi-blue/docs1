# Contract: 工具契约（脚本接口）

适用对象：脚本维护者与 CI 接线者。命令契约一旦发布，MUST NOT 在特性内静默变更。

## 1. 门禁入口

```bash
npm run check:content   # 内容契约（V1–V13）
npm run check:zh        # 受控中文
npm run build           # 站点构建
```

三者 MUST 全部退出码为 0 才算通过。CI 中三者都在镜像构建阶段执行（见 `deploy-contract.md`），
MUST NOT 静默跳过；失败即构建失败。

## 2. `scripts/check-content.mjs`

```bash
node scripts/check-content.mjs [--root docs] [--json] [--max-pages N]
```

| 项 | 约定 |
|---|---|
| 退出码 | `0` 全部通过 · `1` 存在错误 · `2` 脚本自身异常（读取失败、依赖缺失） |
| 人类输出 | 每行 `❌ [V<编号>] <文件>:<行> <问题> → 修法：<建议>`；末尾汇总 `错误 N 项 / 警告 M 项` |
| JSON 输出 | `{ ok, errors: [{code, file, line, message, fix}], warnings: [], stats: {domains, knowledgeDomains, pages, components, diagrams} }` |
| 规则 | V1–V12 见 `data-model.md`；V13 结构化载荷可解析；V14 未知字段 |
| 链接判定 | 用虚拟模块同一份 `linkMap`（MUST 复用 `docs/.vitepress/shared/links.ts` 的归一化规则） |
| 图解判定 | 扫描 `docs/**` 里的 `<DiagramFrame src="/diagrams/x.html">`，断言 `docs/public/diagrams/x.html` 存在且不含外部 `http(s)://` 资源引用 |
| 入口页判定 | 断言每个领域有 `learn/index.md` 与 `components/index.md`，`entry` 与目录一致，且正文不手写条目清单或 `<EntryIndex>` |

**MUST NOT**：修改任何文件（只读校验）。`--fix` 类能力不提供，修复由脚手架或作者完成。

## 3. `scripts/new-content.mjs`（脚手架）

```bash
node scripts/new-content.mjs <kind> <name> [options]

kind ∈ domain | knowledge-domain | knowledge | component | cross-component | entry
options:
  --domain <slug>               # 目标领域（除 domain 外必填）
  --knowledge-domain <slug>     # 知识点必填
  --order <n>                   # 排序前缀，缺省取该目录下一个可用序号
  --dry-run                     # 只打印将创建的文件
  --force                       # 允许覆盖（默认拒绝，见下）
```

| 项 | 约定 |
|---|---|
| 退出码 | `0` 创建成功 · `1` 目标已存在或参数非法（打印冲突路径） · `2` 脚本异常 |
| 命名 | `name` 必须是 `kebab-case` 或中文标题；文件的数字前缀由 `--order` 或自动序号决定 |
| 生成内容 | 元数据齐全的最小合规骨架：`knowledge` 生成四段式全部必需标题；`component` 生成双栏所需全部标题 |
| 目录副作用 | `domain` MUST 同时创建 `learn/`、`components/`、两个 `index.md` 与两份 `_meta.yml` |
| 输出 | 打印每个新文件的仓库相对路径与「下一步」提示（填哪些字段、跑哪条校验） |
| **MUST NOT** | 覆盖已存在文件（除非显式 `--force`）；改动引擎代码或站点配置 |

## 4. `scripts/gen-diagrams.sh`

```bash
ARCHIFY_DIR=/path/to/archify bash scripts/gen-diagrams.sh
```

| 项 | 约定 |
|---|---|
| 前置 | Node ≥18；`ARCHIFY_DIR` 下存在 `archify/bin/archify.mjs` |
| 输入 | `diagrams/src/*.json`（每份 MUST 含 `diagram_type` 与 `meta.output`） |
| 输出 | 按 `meta.output` 写入 `docs/public/diagrams/<name>.html` |
| 失败 | 任一张图的 `ok != true` 即非零退出，并打印 `diagnostics` 的 code / message / subject |
| **MUST NOT** | 联网（除本地 CLI 自身的更新检查，可用 `ARCHIFY_UPDATE_CHECK_DISABLED=1` 关闭） |

## 5. `scripts/ste-lint-zh.py`（vendored）

```bash
python3 scripts/ste-lint-zh.py <文件或目录...> [--baseline N] [--json] [--disable <规则,...>]
```

| 项 | 约定 |
|---|---|
| 来源 | `lemonhall/asd-ste100-skill-zh` 的 `scripts/ste-lint-zh.py`，逐字节入库 |
| 硬违规 | `semicolon` / `long-sentence` / `nominalization` / `marketing-adjective` / `empty-phrase` / `synonym-rotation` 超过基线即退出码 1 |
| 建议类 | `passive-voice` / `compound-aspect` / `vague-word` / `halfwidth-punct` / `dash-join` 只报告，永不失败 |
| 基线 | `scripts/ste-lint-zh.baseline` 存一个整数；只减不增，改动 MUST 在提交信息里说明 |
| 情态 | 永不改动情态词置信度（宪法 IV） |

## 6. 扩展性与预算断言

```bash
node scripts/assert-extensibility.mjs   # 零配置扩展断言（T06）
node scripts/check-budget.mjs [--pages 1000]   # 千页预算检查（T08）
```

| 脚本 | 断言内容 | 失败条件 |
|---|---|---|
| `assert-extensibility.mjs` | 在临时目录构造最小领域（`_meta.yml` + 1 页），调用同一解析层，断言该领域出现在 `domains`、其页面出现在 `pages`、且 `git status` 中引擎与配置文件的改动数为 0 | 断言不成立 |
| `check-budget.mjs` | 合成 N 个页面到临时目录，测量解析 + 构建时长与导航数据体积 | 超过 `engine-contract.md` §9 的目标 |

## 7. 组件测试

```bash
python3 -m pytest tests/test_safe_queue.py -q
```

| 项 | 约定 |
|---|---|
| 被测对象 | `safe-queue` 组件源码（纯标准库，无第三方依赖） |
| 覆盖 | 正常路径结果正确、子进程异常回传、哨兵数量与消费者数量一致、`workers < 1` 抛错 |
| 执行位置 | 镜像构建阶段（与内容门禁同阶段），随构建失败而红 |

## 8. CI 映射

| 阶段 | 执行内容 |
|---|---|
| `build`（镜像构建） | `npm ci` → `check:content` → `check:zh` → `pytest`（组件）→ `npm run build` |
| `deploy` | 渲染 `deploy/*.yaml` 并 apply、等待 rollout、健康检查 |

`ci.env` 不设 `INSTALL_CMD` / `TEST_CMD`（依赖安装与门禁都在镜像内完成），
这与同类纯文档仓 `dev-roadmap` 的做法一致。

## 导航层级门禁（N1–N5）

`scripts/check-nav.mjs` 在构建后校验层级，进入 CI：

| 断言 | 内容 |
|---|---|
| N1 | 学习入口页列出每个已开写知识域的全部讲 |
| N2 | 含子主题的知识域：入口页出现子主题分组与其页面 |
| N3 | 未开写知识域在入口页标「待补」 |
| N4 | 知识点页侧边栏含所属知识域名与至少两条同域链接 |
| N5 | 领域首页顶栏下拉含该域全部知识域 |
| N6 | 有页内 H3 分组的知识点页：侧边栏出现 1.1.1 级锚点链接，且锚点真实存在 |
