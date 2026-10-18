# Phase 0 Research: 技术面试备考文档引擎（001-docs-engine）

本文件记录每个 NEEDS CLARIFICATION 与关键选型的结论。格式：**决策 / 理由 / 备选方案**。
「落地状态」标注该决策在仓库中是否已实现。

## R1 渲染层选型

**决策**：VitePress 1.6.4 + Vue 3.5。理由：它本质是 Vite 应用，解析层可作为 Vite 插件介入
构建管线、产出虚拟模块；默认主题可 `extends` 后只覆盖 Layout 与组件；内置本地搜索与 Markdown 扩展。

**备选方案**：Zensical（模块 API 未公开，无法定制解析流程，与「声明式解析引擎」目标冲突）；
Docusaurus（React 体系，与示例内容的前端 Vue 方向不一致）；自研 SSG（重复造轮子，无搜索与主题）。

**落地状态**：已落地。

## R2 解析层形态：两条数据通道

**决策**：构建期用 Vite 插件（`doc-engine.ts`）产出虚拟模块 `virtual:doc-tree`，
承载层级模型（领域 → 知识域 → 子主题 → 知识点/组件）与反向链接；同时用
`createContentLoader`（`pages.data.ts`）产出扁平页面索引，供标签聚合使用。

**理由**：层级导航与侧边栏需要构建期同步取数（VitePress 配置在 Node 侧求值）；
标签索引与统计是跨领域的扁平查询，数据加载器更合适。两条通道职责不重叠，避免互相复述。

**备选方案**：只用数据加载器（无法在配置期生成侧边栏）；只用虚拟模块（标签聚合要重写扫描逻辑）。

**落地状态**：已落地。

## R3 URL 空间与路由重写

**决策**：源文件与目录保留 `NN-` 前缀用于排序，URL 逐段去掉前缀。VitePress 的
`rewrites` 表由页面模型统一生成（`page.file` → 干净 URL）。同时关闭 VitePress 自带断链检查，
改由 `scripts/check-content.mjs` 用同一份 `linkMap` 判定。

**理由**：宪法 II 要求排序靠前缀，读者视角又不应看到前缀。VitePress 的断链检查基于
「URL 可映射回源文件」，与我们的重写规则不兼容；若保留它，就只能放弃前缀约定。

**备选方案**：文件名即 slug（放弃排序前缀，违反宪法 II）；自定义路由与页面组件（工作量远大于收益，
且失去 VitePress 的静态生成与搜索集成）。

**补偿措施**：链接校验必须由 `check-content.mjs` 覆盖，且校验用的 `linkMap` 与重写表同源。

**落地状态**：重写已落地；链接校验脚本待补（T02）。

## R4 侧边栏作用域（规模化导航）

**决策**：为每个领域生成 `/${domain}/` 侧边栏，并为每个知识域生成 `/${domain}/learn/${kd}/`
作用域侧边栏。依赖 VitePress 的「最长前缀匹配」选择规则，实现「进入某知识域只展开该域」。

**理由**：单个领域到数百页时，一次展开全部知识点的侧边栏不可读。作用域侧边栏在不增加层级的
前提下把可见条目压到当前知识域规模。

**备选方案**：全站单侧边栏（千页时不可用）；自研折叠式目录树（重复实现 VitePress 已有能力）。

**落地状态**：已落地。

## R5 目录层级与排序

**决策**：`<domain>/learn/<NN-knowledge-domain>/<NN-page>.md`，知识域内允许一层子主题目录
（`<NN-subtopic>/<NN-page>.md`），目录层级最多四层，侧边栏可见层级不超过三层（第四层默认折叠）。
排序由 `NN-` 前缀决定，缺前缀时回退按名称排序并告警。

**理由**：与 spec FR-003 / FR-007 / FR-040 一致；`_meta.yml` 的 `order` 可覆盖前缀。

**备选方案**：纯字典序（内容顺序受命名偶然性支配）；在 `_meta.yml` 里维护页面清单（第二份事实源，
违反宪法 I）。

**落地状态**：已落地（子主题渲染路径已实现，示例内容暂未使用）。

## R6 内容契约的落地形态

**决策**：JSON Schema（draft 2020-12）描述两类元数据：目录级 `_meta.yml` 与页面 frontmatter。
校验脚本 `check-content.mjs` 手写规则并复用同一份 schema 语义（字段白名单、枚举、必填、类型），
不引入 ajv 依赖。

**理由**：内容仓库的依赖越少，CI 越快、越不容易因供应链变化而红。手写校验能满足当前字段规模，
且能给出「文件:行:修法」级别的可读诊断（ajv 的报错需要二次翻译）。

**备选方案**：引入 ajv（依赖 + 报错翻译成本）；用 Zod（同为额外依赖）；只写文档不写脚本
（违反宪法 III）。

**落地状态**：待落地（T01/T02）。

## R7 受控中文门禁

**决策**：vendored `lemonhall/asd-ste100-skill-zh` 的 `scripts/ste-lint-zh.py`（仅标准库，
Python 3.8+），以 `--baseline N` 支持存量容忍，硬违规超过基线即退出码 1。基线文件入库，只减不增。

**理由**：上游脚本已实现机械可判规则（分号连动作、长句、名词化、营销形容词、空话、同义词轮换），
自研等于重写一套规则且无法与上游对齐。

**备选方案**：自研 linter（规则会漂移）；只靠人工评审（违反宪法 IV）。

**落地状态**：脚本已取到（`/tmp/ste-lint-zh.py` 获取自上游，20 KB），入库与基线待补（T04）。

## R8 图解链路

**决策**：Archify 的 JSON IR 为可编辑源，存 `diagrams/src/*.json`；用其离线 CLI
`node archify/bin/archify.mjs deliver <type> <src> <out> --quality showcase` 生成自包含交互 HTML，
存 `docs/public/diagrams/` 并入库。页面用 `<DiagramFrame src=... />` 以 iframe 嵌入。CI 只校验
「被引用的图解产物存在且自包含」，不联网生成。

**理由**：交互图解的价值在离线可用；把生成放在创作期、把校验放在 CI，既保住可重建性，
又避免流水线依赖外网与 Node 工具链版本漂移。

**关键约束（实测）**：`meta.output` 必须是可移植的 POSIX 相对路径（绝对路径直接判错）；
sequence 类型的消息 `y` 必须 ≥160、相邻消息间距 ≥28px、画布高度需为图例留出约 98px；
architecture 的连线 `variant` 只接受 `default|emphasis|security|dashed`。

**备选方案**：Mermaid（静态图，无路径追踪与聚焦交互）；手写 HTML（不可批量重建）；CI 内联网生成
（违反宪法 V）。

**落地状态**：已落地（7 张图解全部通过 showcase 质量门）。

## R9 组件页双栏的自动切分

**决策**：markdown-it core 规则（`cmp-split.ts`）查找二级标题「其他项目如何引用」或「引用方式」，
在该标题前插入 `</div><div class="cmp-aside">`，把正文包进 `.cmp-grid` 两列栅格。
组件页在 `transformPageData` 中默认关闭右侧目录，避免三栏拥挤。

**理由**：FR-014 把双栏定为页面契约。由渲染管线统一切分，作者只写内容，切分规则可机械校验。

**备选方案**：作者手写 `<div>` 分栏（会漂移）；在主题里做固定右侧栏（无法承载长引用说明）。

**落地状态**：已落地。

## R10 结构化 props 的传递方式

**决策**：`<ApiTable>` 与 `<CodeTabs>` 的数据以**单引号属性 + HTML 实体转义**传递：
`<ApiTable :items='[{...}]' />`，其中 `&`、`'`、`<`、`>` 转成实体。载荷由脚手架/校验器生成。

**理由**：示例代码同时含单双引号，裸写会破坏 HTML 属性或 JS 字符串；实体转义后属性可安全承载
任意代码片段，同时保持页面自包含（不需要额外数据文件）。

**备选方案**：外置 JSON（每个组件多一个文件）；base64（不可读，评审困难）；限制示例引号
（约束作者，等于把复杂度转嫁给内容）。

**落地状态**：已落地（首个版本曾因转义缺失导致构建失败，已修正并纳入契约）。

## R11 搜索

**决策**：VitePress 内置本地搜索（`themeConfig.search.provider = 'local'`），索引在构建期生成。

**理由**：无运行时服务，符合静态站约束；满足 FR-008 与 SC-013 的「1 次搜索触达」。

**备选方案**：Algolia DocSearch（需要外网与账号）；自研全文索引（收益低）。

**落地状态**：已落地。

## R12 入口页索引自动生成

**决策**：领域根、`learn/`、`components/` 三类入口页在 frontmatter 标 `entry: domain|learn|components`，
主题的 `<EntryIndex>` 从虚拟模块取数渲染索引区（条目、计数、推荐起点、学习路径、标签索引）。
作者可在同一页写导语，导语不被覆盖。

**理由**：满足 FR-037「新增页面不需要编辑入口页」。

**备选方案**：构建期生成整页（作者无法写导语，降低「怎么学」的引导质量）；手工维护索引
（千页时必然漏更新）。

**落地状态**：已落地。

## R13 部署形态

**决策**：多阶段镜像 `node:22-alpine` 构建 → `caddy:2-alpine` 托管；Caddy 用
`try_files {path} {path}.html {path}/index.html /index.html` 支持 `cleanUrls` 与前端路由回落；
K8s 单副本 Deployment + ClusterIP Service + Traefik Ingress（TLS 由通配符证书按 SNI 下发）。

**理由**：静态站无状态、可重建；Caddy 的 `try_files` 是 `cleanUrls` 生效的必要条件。

**备选方案**：nginx（配置更长）；Node 运行时服务（把静态站变成有状态服务，违反约束）。

**落地状态**：待落地（T09）。

## R14 CI 接入方式

**决策**：完全复用 `ci` 中心仓模板 —— 仓内只保留薄触发工作流（一行 `uses: dev/ci/.../template.yaml@main`）、
`ci.env` 开关文件、`Dockerfile`、`Caddyfile` 与 `deploy/` 清单。关闭 `DB_ENABLED`、`CONF_ENABLED`、
`IAM_REPORT`，`K8S_NAMESPACE=docs`，`CONTAINER_PORT=80`，`MANIFEST_DIR=deploy`。

**理由**：宪法「技术约束与交付约束」明令禁止复制中心仓编排；`dev-roadmap` 是同类纯文档仓的
既有先例，可直接对齐其变量口径。

**备选方案**：仓内自写 workflow（违反约束且随中心仓演进漂移）。

**落地状态**：待落地（T09）。

## R15 域名与 DNS 前置

**决策**：仓库按 `<internal-host>` 配置；DNS A 记录由用户侧在阿里云与内网 OpenWrt 添加。
DNS 生效前用带 `Host` 头的请求（`curl -H 'Host: <internal-host>' http://<internal-ip>/`）
作为等价验收证据。

**理由（实测）**：`<internal-host>` 当前在公网（223.5.5.5）与内网均无记录；
`<internal-host>` 正常解析到 `<internal-ip>`，说明是逐条记录而非通配符。

**备选方案**：先部署到已存在域名（不满足用户给定的域名要求）；等 DNS 再加（阻塞验收）。

**落地状态**：待落地（T09 的验收步骤已写入 quickstart）。

## R16 组件测试

**决策**：组件源码保持纯标准库，测试用单个 pytest 文件（`tests/test_safe_queue.py` 形态），
可在 CI 直接执行；`ci.env` 的 `TEST_CMD` 追加该测试与内容门禁。

**理由**：宪法 VI 要求组件测试进 CI；纯标准库让测试无需额外依赖，跑得快。

**备选方案**：只做代码评审（无法证明「可运行」）；引入 pytest 之外的测试框架（无必要）。

**落地状态**：待落地（T05）。
