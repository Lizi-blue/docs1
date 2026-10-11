# 本地验收证据（001 剩余验收 · task-7）

> 每次验收把命令与真实输出摘要追加到本文件。禁止只写结论不写命令。
> 本轮补 001 里尚未验收的五项：FR-008、FR-028、FR-030、FR-040、FR-015。

## 环境

| 项 | 值 |
|---|---|
| 仓库 | `/root/docs-1`（`dev/docs-1`，分支 `main`） |
| Node | v22.23.2（原生类型剥离，可直接加载 `doc-engine.ts`） |
| Python | 3.13 |
| 站点构建产物 | `docs/.vitepress/dist`（本轮实测 22:42 至 22:48 期间被并行任务重建过） |
| 预览 | `4173` 已被并行任务占用；本轮另起 `4174` 做 HTTP 断言，用后即收 |
| 浏览器 | Playwright Chromium 不可用（缺 `libglib-2.0.so.0`），搜索验收改用产物断言加 HTTP 断言 |
| 日期 | 2026-10-11 |

## FR-008 全站搜索

### 命令

```bash
cd /root/docs-1
ls docs/.vitepress/dist/assets/chunks | grep -iE 'search'
curl -sS -o /dev/null -w '%{http_code} %{size_download}\n' \
  "http://127.0.0.1:4174/assets/chunks/@localSearchIndexroot.AnvaypP4.js"
curl -sS -o /dev/null -w '%{http_code} %{size_download}\n' \
  "http://127.0.0.1:4174/assets/chunks/VPLocalSearchBox.xtcU9rdI.js"
node /tmp/fr008-search-assert.mjs    # 临时断言脚本，不提交
```

临时脚本做三件事：读取索引 chunk、用 VitePress 同款 MiniSearch 参数建索引、跑两条真实查询。
参数取自 `node_modules/vitepress/dist/client/theme-default/components/VPLocalSearchBox.vue:72-83`。

### 真实输出

```text
chunk=@localSearchIndexroot.AnvaypP4.js box=VPLocalSearchBox.xtcU9rdI.js
4174 index chunk HTTP 200 90774B
4174 search box HTTP 200 64029B
PASS 查询「多线程」→ 命中 30 条；top=/backend/learn/concurrency/process-basics, /, /backend/learn/concurrency/async-io；期望包含 /backend/learn/concurrency/thread-basics
PASS 查询「Vite」→ 命中 31 条；top=/frontend/learn/engineering/vite-dev-and-build, ...；期望包含 /frontend/learn/engineering/vite-dev-and-build
索引统计：documentCount=180 terms=0 chunk=@localSearchIndexroot.AnvaypP4.js
documentCount=180 顶层路径段=['#两个入口', '#本次示例覆盖', 'backend', 'frontend']
含 thread-basics: True 含 vite-dev-and-build: True
```

配置侧证据：`docs/.vitepress/config.mts:121` 为 `search: { provider: 'local' }`。
索引在构建阶段生成，无运行时服务，符合 FR-008。

### 结论

PASS。索引 chunk 与搜索框 chunk 都在产物里，预览服务返回 200。
索引含 180 个文档片段，两个领域各有一条查询命中目标页。
浏览器 UI 点击未做，原因见「未完成项」。

## FR-028 tag 发布路径（vX.Y.Z → 版本号 + latest）

不实际打 tag，只做静态核对。

### 命令

```bash
cd /root/docs-1
grep -nE "tags:|release:|ref:|project:" .gitea/workflows/ci.yaml
grep -nE "tags:|release:" /root/ci/scripts/register-project.sh
sed -n '206,213p' /root/ci/.gitea/workflows/template.yaml
sed -n '176,182p;197,203p' /root/ci/scripts/lib/env.sh
sed -n '107,121p' /root/ci/scripts/build-and-test.sh
sed -n '373p;382p' /root/ci/docs/CAPABILITIES.md
```

### 真实输出（节选）

```text
### 1) 本仓触发与 release 传参
16:    tags: ['v*']
33:      project: ${{ github.event.repository.name }}
34:      ref: ${{ github.ref_name }}
36:      release: ${{ github.ref_type == 'tag' }}

### 2) ci 仓 register-project 生成的规范 workflow
199:    tags: ['v*']          # 打 vX.Y.Z 版本 tag 时触发发布（IMAGE_TAG=tag，latest 同步更新）
219:      release: ${{ github.ref_type == 'tag' }}         # 版本 tag 发布走 release 逻辑

### 3) ci 模板 release 分支置位
if [ "${IS_RELEASE:-false}" = "true" ]; then
  # 版本 tag 发布：IMAGE_TAG=ref(如 v1.1.1)、推送 latest、部署 production
  echo "INPUT_IMAGE_TAG=${GIT_REF}" >> "$GITHUB_ENV"
  echo "INPUT_PUSH_LATEST=true" >> "$GITHUB_ENV"
  echo "INPUT_K8S_NAMESPACE=${RELEASE_NAMESPACE:-production}" >> "$GITHUB_ENV"

### 4) env.sh tag 派生与 latest 别名
# - 显式 IMAGE_TAG（非 latest）优先（如发布 tag v1.2.0）
PUSH_LATEST="${PUSH_LATEST:-false}"
IMAGE_FULL="${REGISTRY_URL%/}/${IMAGE_NAME}:${IMAGE_TAG}"
IMAGE_FULL_LATEST="${REGISTRY_URL%/}/${IMAGE_NAME}:latest"

### 5) build-and-test.sh 打两个 tag 并推
docker build ... -t "$IMAGE_FULL" -t "$IMAGE_FULL_LATEST" ...
echo "==> Pushing latest alias: $IMAGE_FULL_LATEST"

### 6) CAPABILITIES 口径
IS_RELEASE=true（版本 tag 发布）可放行 deploy。
`PUSH_LATEST` 默认 false，仅 tag 发布由模板置 true。
```

### 结论

PASS（书面证据）。链路闭合：

1. 本仓 `.gitea/workflows/ci.yaml:16` 用 `tags: ['v*']` 接版本 tag。
2. 同文件 `:36` 把 `release: ${{ github.ref_type == 'tag' }}` 传给 ci 模板。
   该行与 ci 仓规范模板逐字一致（`register-project.sh:219`）。
3. 模板 release 分支置 `IMAGE_TAG=vX.Y.Z` 与 `PUSH_LATEST=true`（`template.yaml:209-210`）。
4. `env.sh` 只用非 latest 的显式 `IMAGE_TAG`，于是 `IMAGE_FULL=...dev/docs-1-docs:vX.Y.Z`
   （`env.sh:182`、`:202`）。
5. `build-and-test.sh:108-121` 打 `:vX.Y.Z` 与 `:latest` 两个 tag，并各推一次。

发现的口径差异：模板把 release 的 `K8S_NAMESPACE` 默认置 `production`（`RELEASE_NAMESPACE` 默认）。
本仓 `ci.yaml` 未传 `release_namespace`。所以打 tag 会部署到 `production` 命名空间。
`push main` 仍部署在 `docs`。建议 Lead 决定是否在 `ci.yaml` 显式传 `release_namespace: docs`。

## FR-030 回滚剧本

落点：`contracts/deploy-contract.md` §8（改写为命令 + 7 步验收表 + 前置 + 命名空间口径）。
`quickstart.md` 的 S9 增加了回滚验收命令行。

要点：

| 项 | 内容 |
|---|---|
| 命令 | `kubectl -n docs rollout undo deploy/docs-1-docs` |
| 期望输出 | `deployment.apps/docs-1-docs rolled back` |
| 就绪 | `rollout status --timeout=60s` 输出 `successfully rolled out`，副本 1/1 |
| 镜像 | 步骤 4 的标签等于上一 revision，且与回滚前不同 |
| 探活 | 带 `Host` 头请求 `/health` 返回 200 |
| 前置 | 清单未设 `revisionHistoryLimit`，用默认 10，历史 ReplicaSet 足够 |
| 无需额外步骤 | 无持久卷、无数据库、无配置中心 |

本轮未在真实集群执行（集群侧由并行任务与外部条件决定），只交付可执行剧本。

## FR-040 / SC-009 千页预算（`scripts/check-budget.mjs`）

### 命令

```bash
cd /root/docs-1
node scripts/check-budget.mjs --pages 1000
```

脚本行为：复制 `docs/` 到系统临时目录，排除 `dist`、`cache` 与未跟踪的并行夹具。
再按 10 个领域合成 1000 页，计时解析，跑一次 `vitepress build`，量载荷与资源体积。
临时目录跑完即删，不写入仓库。

### 真实输出

```text
临时目录：/tmp/docs1-budget-zKrkq7
合成页：1000（10 个领域）
页面模型：1009 页 / 12 个顶层分组；解析 0.16 s

指标                                 实测         预算         结论
解析时长（合成页）                               0.16 s         60 s  PASS
构建时长（合成页）                              29.67 s        180 s  PASS
导航数据体积（virtual:doc-tree）               1.24 MB      5.00 MB  PASS
站点静态资源总量（非 HTML）                      11.39 MB     20.00 MB  PASS
单张图解 HTML                              0.73 MB      1.50 MB  PASS

补充指标（不参与判错）：
  dist 总量              272.19 MB（3108 个文件）
  HTML 页面文档总量       260.79 MB（1027 页，均值 260.0 KB）
  图解产物                7 张，合计 5.07 MB
  导航载荷人均            1.3 KB/页
预算检查通过（1009 页）
```

判定口径：`站点静态资源总量` 只算非 HTML 资源，图解算资源（契约 §9 写「含图解」）。
HTML 页面文档量单列报告，不参与判错，理由见下。

### 结论

PASS。解析 0.16 s、构建 29.67 s、导航载荷 1.24 MB、静态资源 11.39 MB，四项都在预算内。

超预算路径已验证：脚本对 `over` 集合打印「超预算：<指标> 实测 > 上限」，判错项退出码 1。
开发过程中先误把 HTML 文档算进静态资源，脚本给出 265.46 MB 与退出码 1，证明判错有效。

风险登记：HTML 页面文档总量 260.79 MB，均值 260 KB/页。
探针实验（20 页夹具）显示每页都含其他领域的页面链接。
成因：VitePress 把整份 `themeConfig.sidebar` 注入每页，页面文档量随总页数线性增长。
影响：千页时首屏 HTML 更大（gzip 约 28 KB/页，内网可接受），镜像含约 261 MB HTML。
建议：后续把侧边栏改为按作用域客户端计算，或给每页 HTML 设独立预算。
本轮只登记，不改引擎（超出 task-7 写域）。

## FR-015 跨领域契约夹具

### 命令

```bash
cd /root/docs-1
# 夹具写在 docs/cross-domain/task-scheduler-ui.md（临时，验证后删除）
node /tmp/fr015-cross-domain.mjs      # 临时断言脚本，不提交
rm -f docs/cross-domain/task-scheduler-ui.md && rmdir docs/cross-domain
```

临时脚本在隔离副本里跑 `buildDocTree` 与 `vitepress build`，共 17 条断言。

### 真实输出

```text
PASS  夹具进入页面模型 — cross-domain/task-scheduler-ui.md type=cross-component
PASS  type = cross-component — cross-component
PASS  归属分组「跨领域组件」 — cross-domain/跨领域组件
PASS  depends_on 汇聚 backend 与 frontend — 4 条链接
PASS  依赖项可解析到目标页面 — Queue 通信 | 多进程基础 | Vite 开发与构建 | npm 与模块
PASS  依赖汇聚按领域分成两组 — {"Python 后端":["Queue 通信","多进程基础"],"前端工程化":["Vite 开发与构建","npm 与模块"]}
PASS  跨领域分组出现在 domains — backend,frontend,cross-domain
PASS  反链：知识点被本组件复用 — reusedByComponents 含 /cross-domain/task-scheduler-ui
PASS  反链：本组件记录 usedKnowledge — 4 条
PASS  无未命中链接告警
PASS  vitepress build 成功 — exit=0
PASS  产物 HTML 存在 — dist/cross-domain/task-scheduler-ui.html (19462 B)
PASS  双栏切分与组件页一致 — cmp-grid/cmp-main/cmp-aside
PASS  渲染依赖汇聚标题
PASS  汇聚分组含两个领域名 — Python 后端 / 前端工程化
PASS  汇聚含可点击依赖项
PASS  侧边栏含跨领域条目 — 任务看板跨端组件

汇总：17/17 通过
```

清理证据：`ls docs/` 输出 `_meta.yml backend frontend index.md public`，无 `cross-domain`。
`git status --porcelain docs` 无输出。夹具未提交。

### 结论

PASS。跨领域类型进入页面模型、依赖汇聚按两个领域分组、双栏切分与组件页一致。
`quickstart.md` S10 已补成可复制的完整剧本。

## 未完成项

| 项 | 原因 | 后续 |
|---|---|---|
| 搜索的浏览器 UI 断言 | 容器缺 `libglib-2.0.so.0`，Playwright Chromium 起不来 | 由 CI 镜像或带桌面库的环境补 |
| 真实打 `vX.Y.Z` tag | 任务明确要求不实际打 tag | 发布时按 FR-028 证据链观察 Run |
| 回滚在真实集群演练 | 需集群访问与已部署版本 | 首次部署后按 deploy 契约 §8 执行 |
| tag release 的命名空间 | `ci.yaml` 未传 `release_namespace`，默认落 `production` | 待 Lead 决定是否钉成 `docs` |

## S1–S10 剧本执行记录（2026-10-11 收口轮）

| 场景 | 命令 | 实际结果 | 结论 |
|---|---|---|---|
| S1 构建与预览 | `npm run build` + `npx vitepress preview docs --port 4173` | build complete（24 页）；12 条路由 200（含 `/backend/learn/concurrency/thread-basics`、`/backend/components/safe-queue`、7 张图解） | PASS |
| S2 内容契约门禁 | `npm run check:content` | 错误 0 项 / 警告 0 项（V1–V18 全过） | PASS |
| S3 受控中文门禁 | `npm run check:zh` | 硬违规 0 处（baseline 0），13 条建议类提示 | PASS |
| S4 零配置扩展 | `npm run check:extensibility` | E1–E10 全过：新领域进模型、URL 去前缀、子主题四层、组件进模型、链接容错、引擎与配置指纹未变 | PASS |
| S5 图解可重建 | `ARCHIFY_DIR=.tools/archify bash scripts/gen-diagrams.sh` | exit 0，7 张图重建；与提交版逐字节一致（`git diff` 无变化） | PASS |
| S6 组件按生产级交付 | `npm run test:component` | 2 passed / 3 skipped（跳过原因：本沙箱禁 `sem_open`，CI 镜像内真实执行） | PASS |
| S7 双入口与双向链接 | 线上 DOM 断言 | `/backend/` 两张入口卡；`/backend/learn/` 知识域卡 + 4 段路径；组件页列出依赖知识点、知识点页列出复用组件 | PASS |
| S8 千页预算 | `node scripts/check-budget.mjs --pages 1000` | 解析 0.21s/60s、构建 33.97s/180s、导航 1.24MB/5MB、静态资源 11.40MB/20MB、单图 0.73MB/1.5MB，五项 PASS | PASS |
| S9 CI 与部署 | 推送后 Run #4377 | 全绿（build + deploy）；镜像 tag `c94c52f` = main 短 SHA；`/health` 200；域名实测 9 条路由 200 | PASS |
| S10 跨领域类型契约 | 临时 `docs/cross-domain/<fixture>.md` | 进入模型、依赖汇聚渲染、双栏切分与组件页一致；夹具已删除 | PASS |

### 收口轮修复的缺陷

| 缺陷 | 影响 | 处置 |
|---|---|---|
| 入口页重复渲染索引 | 6 个入口页各出现两份索引，观感与滚动都异常 | Layout 依 `frontmatter.entry` 渲染；正文禁止 `<EntryIndex>`；V11 改为断言「正文不得出现」；契约同步 |
| `checkDiagrams` / `checkEntryPages` 拼相对路径 | `--root` 传绝对路径时脚本异常 | 统一把已解析的绝对 docs 传给各检查函数 |
| 站点首页豁免写死 `docs/index.md` | 非默认扫描根的正例被误判 V2 | 改为「扫描根下的 index.md」 |
| V15/V17 按固定段数解析领域 | 任意扫描根下领域定位错误 | 改为按 `learn` 段定位 |
