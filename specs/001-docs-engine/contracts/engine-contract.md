# Contract: 引擎契约（解析层 → 主题 / 配置）

适用对象：引擎与主题的维护者。契约变更 MUST 同步更新本文件与 `data-model.md`。

## 1. 虚拟模块 `virtual:doc-tree`

```ts
// 由 docs/.vitepress/plugins/doc-engine.ts 提供
export interface DocTree {
  domains: DomainNode[]
  pages: PageNode[]
  linkMap: Record<string, string>
  backlinks: Record<string, { reusedByComponents: string[]; usedKnowledge: string[]; componentsOf: string[] }>
  warnings: string[]
}
export const docTree: DocTree
export default docTree
```

**保证**

1. `domains` 按 `order` 升序；同序按 `slug` 字典序。
2. `pages` 为扁平索引，MUST NOT 含入口页（`index.md`）。
3. `linkMap` 的键包含归一化形式（去 `NN-` 前缀、去 `.md`）与实际 URL 两种。
4. 生产构建 MUST NOT 因 `warnings` 中断；开发态 MUST 打印每条告警。
5. 任一 `.md` 或 `_meta.yml` 变化时 MUST 失效该模块并触发整页重载。

**字段定义**见 `data-model.md` E5–E9。

## 2. 数据加载器 `docs/.vitepress/data/pages.data.ts`

```ts
export interface PageIndexEntry {
  url: string; title: string; type?: string; domain?: string; knowledgeDomain?: string
  level?: string; tags: string[]; tagsIndex: string[]; componentType?: string
  reusability?: string; description?: string
}
declare const data: PageIndexEntry[]
export { data }
```

**保证**：只用 `createContentLoader('**/*.md')`；过滤掉无 `type` 的页面；按 `url` 排序。
用途限于扁平查询（标签索引、统计）。层级查询 MUST 走虚拟模块。

## 3. URL 与路由

| 输入 | 输出 |
|---|---|
| `backend/learn/01-concurrency/01-thread-basics.md` | URL `/backend/learn/concurrency/thread-basics` |
| `backend/learn/01-concurrency/index.md`（若存在） | URL `/backend/learn/concurrency/` |
| `backend/components/safe-queue.md` | URL `/backend/components/safe-queue` |
| `backend/index.md` | URL `/backend/` |
| `cross-domain/task-scheduler-ui.md` | URL `/cross-domain/task-scheduler-ui` |

**规则**

1. 逐段去掉 `NN-` 前缀；末段为 `index`/`README` 时整段丢弃。
2. `config.mts` MUST 用同一模型生成 VitePress `rewrites`：键为含 `.md` 的源相对路径，
   值为干净 URL 加 `.md`。
3. VitePress 自带断链检查 MUST 关闭（`ignoreDeadLinks: true`），由 `check-content.mjs` 用
   `linkMap` 判定链接可达性。该补偿是宪法 III「同源」要求的落地方式。

## 4. 链接归一化

```ts
normalizeLink('/backend/learn/01-concurrency/02-process-basics.md') === '/backend/learn/concurrency/process-basics'
```

- 实现唯一：`docs/.vitepress/shared/links.ts`（Node 与浏览器共用）。
- 作者写带前缀、带 `.md`、带尾斜杠的形式 MUST 都能命中。
- 未命中 MUST 记入 `warnings`（开发态打印）并由校验脚本判错。

## 5. 布局切换

`Layout.vue` 依据 frontmatter 决定形态：

| frontmatter | 形态 |
|---|---|
| `entry: domain \| learn \| components` | 顶部渲染 `<EntryIndex kind=...>`，正文为作者导语 |
| `type: knowledge` | 顶部 `<ProgressBar>` + `<Prerequisite>` + 元信息徽标；右栏目录；底部 `<RelatedLinks>` |
| `type: component` | 顶部元信息徽标 + `<InstallBox>`；正文双栏（左：简介/知识点/图解/源码；右：引用方式）；默认关闭右栏目录 |
| `type: cross-component` | 同组件页，另渲染「依赖汇聚」分组（按领域聚合 `depends_on`） |

**保证**：布局 MUST NOT 依赖页面手写的容器标签。组件页双栏由
`docs/.vitepress/plugins/cmp-split.ts` 在二级标题「其他项目如何引用」或「引用方式」处自动切分。

## 6. 主题侧取数

`docs/.vitepress/theme/lib/tree.ts` 暴露：`tree`、`pageByUrl`、`resolvePage`、`titleOf`、
`domainOf`、`knowledgeDomainOf`、`backlinksOf`、`positionIn`。
组件 MUST 通过这些函数取数，MUST NOT 自行扫描文档目录。

## 7. 组件清单（全局注册）

`ProgressBar`、`Prerequisite`、`ApiTable`、`InstallBox`、`CodeTabs`、`DiagramFrame`、
`EntryIndex`、`TagIndex`、`RelatedLinks`。新增组件 MUST 在 `theme/index.ts` 注册，
并在 `content-contract.md` 记录作者可用的写法。

## 8. 构建期诊断

| 情况 | 行为 |
|---|---|
| 缺 `_meta.yml` | 使用目录名作为显示名，记 warning，不中断 |
| 缺 `frontmatter.type` | 按目录推断类型，记 warning |
| 缺标题 | 用一级标题，仍缺时记 warning |
| 链接未命中 | 记 warning；`check-content.mjs` 判错 |
| `_meta.yml` YAML 解析失败 | 抛错并给文件路径与解析器信息 |

## 9. 性能预算

| 指标 | 目标 | 超出行为 |
|---|---|---|
| 构建时长（2 领域 / 24 页） | ≤30s | 由预算检查脚本告警 |
| 构建时长（1000 页，合成夹具） | ≤180s | 判错或告警（T08 决定阈值口径） |
| 站点静态资源总量 | ≤20 MB | 判错 |
| 单张图解 HTML | ≤1.5 MB | 提示（当前单图约 0.76 MB） |
