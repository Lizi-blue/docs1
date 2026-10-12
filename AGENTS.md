# AGENTS.md —— 本仓协作与写作约定

本文件面向人，也面向 AI Agent。改内容或改引擎前，先读这一页。

## 1. 受控中文规则

中文正文遵守下列规则。规则正文来自上游 `lemonhall/asd-ste100-skill-zh`。

- 一句一动作。
- 说明句不超过 40 字。
- 指令句不超过 25 字。
- 用主动语态，写清动作主体。
- 同一概念全篇用同一个词。
- 不用虚动词（例如 `进行分析`）。
- 不用套话，不用营销形容词，不用含糊词。
- 不用分号连接两个动作。
- 不改情态词的置信度（可能、也许、大概）。
- 代码块、命令、专有名词与 API 名称不参与判定。

局部停用规则走 `--disable` 显式清单，并在提交信息里写理由。
文件级忽略标记一律不接受。

## 2. 机械校验命令

```bash
npm run check:content       # 内容契约 V1–V23
npm run check:zh            # 受控中文（封装：scripts/lint-zh.mjs）
npm run check:orchestration # 编排自检 S1–S7（技能与台账）
npm run test:component      # 组件自测（tests/，源码从组件页提取）
npm run selftest:gates      # 门禁自测（定向破坏夹具，证明会红）
npm run check:extensibility # 零配置扩展断言（新增领域不改配置）
npm run check:component     # 组件页契约：方向纯净、知识索引、复用清单
npm run check:experience    # 体验断言：令牌、状态、焦点、对比度、响应式
npm run check:responsive    # 响应式布局（需先构建）
npm run check:nav           # 导航层级 N1–N6（需先构建）
npm run build               # 站点构建
```

十一条命令退出码都为 0 才算通过。
CI 在镜像构建阶段跑全部门禁，失败即构建失败。

中文门禁的封装负责四类「代码不算散文」的遮蔽：

- 组件载荷 `<ApiTable :items='…' />` 与 `<CodeTabs :tabs='…' />` 的属性值。
- `TL;DR` 这个缩写里的分号。
- HTML 实体结尾的分号（`&quot;`、`&#39;`、`&amp;`）。
- 契约强制的标题文本（例如 `### 运行方式`），只参与结构判定，不参与用词判定。

遮蔽规则写在 `scripts/lint-zh.mjs`。要改规则，先改脚本注释与本节。
上游脚本不接受目录入参，封装已按文件清单调用。

## 3. 豁免与基线规则

- 基线在 `scripts/ste-lint-zh.baseline`，文件里只放一个整数。
- 基线只减不增。
- 硬违规超过基线时退出码 1。
- 建议类规则只报告，永不判失败。
- 下调基线要在提交信息里写理由。
- 基线变动要同步台账 `ledger/orchestration-decisions.tsv`。
- 豁免要写进特性任务，并给出恢复计划。

## 4. 新增内容

- 新增内容走脚手架 `scripts/new-content.mjs`，作者只填正文与取值。
- 引用必须指向已存在的页面。未建的页面用行内代码标注。
- 导航、侧边栏与入口索引由引擎派生，作者不手写条目清单。
- 每讲必须齐四段式，并补四个教学要素。
- 每个知识点必须给「官方依据与版本差异」：至少两条官方文档链接，每条标适用版本与差异（门禁 V19）。
- 深度与广度以官方内容现状与业界实践为准，定位中高级面试（宪法 IX）。只讲 API 用法的页面不合格。
- API 手册的必会与常用条目必须给全七字段（含 `pitfall`），覆盖清单见 `scripts/data/module-api-index.json`（门禁 V20）。
- 常用方法不得一句话带过：要写阻塞语义、异常与误区。
- 未开写知识域只落目录与登记，`teach.status: outline`，不建空页面（门禁 V22）。
- 层级由引擎派生：作者只写元数据与正文，不手写侧边栏与入口清单。
- 组件先在本仓成型（宪法 XI）：组件页 MUST 带 `direction`、`knowledge_index` 与 `reuse_manifest`，
  复用四件套写进 `reuse/<component>/manifest.json`，页面渲染而不手写。
- 组件 MUST 按方向归属：后端页只讲后端实现，前端页只讲前端实现，两端互相链接。
- 组件页契约正文见 `specs/004-component-hub-console/contracts/component-page-contract.md`。
- `## API 手册` 必须按方法组拆成 ≥2 个 H3，每组紧跟一张 `<ApiTable>`（门禁 V23）。
- 核心方法必须各自成条并写全七字段；不得只塞进 `methods` 数组一句话带过。
- 导航层级到 `1.1.1`：侧边栏与学习入口都列出方法组，锚点由引擎按标题生成。

## 5. 响应式布局

改动布局或样式后，跑 `npm run check:responsive`。它守住五件事：

- 每个页面有 viewport 声明。
- 产物样式含小屏（≤480px）、手机（≤640px）、平板（≤1024px）与窄桌面（≤768px）四档断点。
- 宽内容（Markdown 表格、API 参数表）在窄屏自滚动。
- 自定义样式不含固定大宽度。
- 每页恰有一个 viewport 声明。

真实视口体验（375 / 768 / 1280）由人在浏览器里复核，机械门禁只守可判定的部分。

## 6. 图解

- 交互图解由 Archify 产出。源在 `diagrams/src/`，产物在 `docs/public/diagrams/`。
- 图解必须自包含，不得引用外部网络资源。
- 图注要写清这张图回答什么问题。
- 静态拓扑图用 `mingrammer/diagrams` 的 `.py` 源产出。

## 7. 提交与协作

- 提交信息用中文，并带特性编号。
- 内容改动与引擎改动分开提交。
- 门禁未过的改动不要提交。
- 本仓由 Lead 统一提交。Agent 不要自行推送。
