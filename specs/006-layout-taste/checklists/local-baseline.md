# 验收证据（006 布局/目录/内容布局优化）

> 环境：Node v22.23.2 / Python 3.13；日期 2026-10-13；仓库 `/root/docs-1`。

## 一、双档与回滚（US1）

| 项 | 结果 |
|---|---|
| 默认档构建 | `npm run build` 成功；产物根元素 `class="layout-taste"` |
| 经典档构建 | `DOCS1_LAYOUT=classic npm run build` 成功；根元素 `class="layout-classic"` |
| 非法档位 | `DOCS1_LAYOUT=nope npm run build` 命中 2 处「DOCS1_LAYOUT 只允许」报错并终止 |
| 切换控件 | 产物首页含 2 个 `.layout-switch-btn` 与 `aria-label="布局档位"`（SSR 渲染，键盘可达） |
| 首屏无闪烁 | `transformHtml` 输出默认档类名；`head` 内联脚本按 localStorage 覆盖并容错 |
| 经典样式冻结 | `classic.css` 指纹 `9ece161d185a5045…` 记录在 `scripts/data/classic-css.sha256` |
| 回滚链路 | 标签 `layout-baseline-pre-taste` 在远端；`scripts/restore-layout.mjs --dry-run` 可运行且不改工作区 |

## 二、布局与目录与内容（US2–US4）

优化层 `docs/.vitepress/theme/styles/taste.css` 全部规则限定在 `html.layout-taste` 之下：

| 面 | 落点 |
|---|---|
| 布局 | 顶栏高度上限 64px（窄屏 56px）与单行不换行；整页容器 1440/1200px 居中；入口页首屏留白收紧；卡片列表改网格 |
| 目录 | 侧栏三级缩进与字号分级；当前项左侧强调条与强调色；悬停与 `:focus-visible` 焦点环；页内目录选中态 |
| 内容 | 正文列宽 46rem（约 65–75 字符）；h2/h3/h4 阶梯走令牌；表格加密且表头吸顶；卡片圆角描边阴影统一；动效仅 transform/opacity 并尊重减少动效 |
| 折叠 | 1280 / 1024 / 768 / 640 四档逐段声明 |

## 三、门禁（US5）

十三条命令本地全绿：`check:content`、`check:zh`、`check:component`、`check:experience`、`check:layout`、
`check:orchestration`、`test:component`、`selftest:gates`、`check:extensibility`、`build`、`check:responsive`、`check:nav`、`check:pages`。

新增 `check:layout`（L1–L6）：
- 负例演练：向 `classic.css` 追加一行 → `[L1] 经典样式被改动（指纹 f498f6a8… ≠ 记录 9ece161d…）` 判红；
  恢复后 0 错。
- 其余断言：断点标准、顶栏高度上限与禁止 `100vh`、优化层作用域、切换机制齐备、禁止 flex 百分比栅格。

**过程中修补的三处既有问题**

1. `custom.css` 末尾「按下态」规则在选择器列表后被截断（缺声明块）。此前 Vite 管线容忍，分档 `@import` 后严格解析报错。已补回声明块。
2. `check:experience`（X7）与 `check:responsive`（R7）只读单一 `custom.css`，分档后误报。已改为按样式目录读取全部 CSS（单一事实源不重复规则）。
3. X3 把 `--docs1-*` 令牌定义当魔法值、且属性正则不含数字导致误判。已把令牌命名空间列入白名单并修正正则。

## 四、第二轮细化（Round 3）

| 面 | 新增规则 | 机械证据 |
|---|---|---|
| 内容版面 | 宽内容外扩：代码块、表格、图框、代码页签相对正文阅读栏外扩 `--docs1-bleed`；正文仍守 46rem | 产物 CSS 命中 `--docs1-bleed: 6rem` 与外扩 `margin-inline: calc(-1 * var(--docs1-bleed) / 2)` |
| 窄屏安全 | ≤1024px 外扩归零，避免横向溢出 | 产物 CSS 命中 `--docs1-bleed: 0rem`；`check:responsive` 通过 |
| 组件页双栏 | 网格比例 `minmax(0,1fr) minmax(16rem,22rem)`；主栏守阅读栏；侧栏卡片化（圆角 + 描边 + 表面色，替代单条分隔线）；≤1024 折叠单列 | 产物 CSS 命中 `minmax(16rem,22rem)` 与 `.cmp-aside` 圆角规则 |
| 入口层次 | 主入口卡标题升到 `--docs1-font-lg`、卡片网格 18rem；知识域卡去阴影、圆角收窄，形成主次 | 产物 CSS 命中 `.entry-card-title` 与 `.kd-card` |
| 移动端顶栏 | ≤768px 压缩顶栏分组标签与标题字号、收窄列间距，保持单行 | 产物 CSS 命中 `.VPNavBarMenuGroup .text` 与列间距规则 |
| 门禁扩展 | `check:layout` 增 L7（外扩与窄屏归零）、L8（双栏网格与折叠、侧栏卡片化）、L9（入口主次）；L6 收窄为「纯百分比算术」并验证负例 | L6 负例：注入 `width: calc(33% - 1rem)` → 判红；恢复后 0 错 |

**门禁**：十三条命令本地全绿（含 L1–L9）。

## 五、布局严重问题修复（2026-10-13 晚，方案 A）

**实测手段**：Playwright 打开线上页 `https://<internal-host>/backend/components/safe-queue`，视口 1560×766。

### 修复前实测

| 测量项 | 实测 |
|---|---|
| `.cmp-main`（正文） | **360px**（≈37 字符） |
| `.cmp-aside` | 352px（与正文 1:1） |
| VitePress 右栏容器 | **224px、内容为空** |
| 元素重叠 | **12 处**，右栏代码块/表格左侵主栏 **11px**（`margin-left:-48px; width:422px`） |
| `.content-container` | computed `max-width:1112px`，实际只有 **784px**（被父级卡住） |

### 根因与修复

| # | 根因 | 修复 |
|---|---|---|
| R1 | 宽内容外扩选择器命中 `.cmp-aside`，右栏块被撑大并左移 | 新增 `.cmp-aside` 内 `pre/table/code-tabs/diagram` 复位（`margin-inline:0; width:100%`，特异性更高）；`check:layout` 增 **L11** 断言外扩与复位成对出现 |
| R2 | 组件页只关 `outline` 未关 `aside` → 空列 224px；landing 页同理 | 引擎对 `component`/`cross-component` 与 `type: landing` 同时设 `aside: false`；新增 CSS `:has(.VPDocOutlineItem:empty)` 空目录自动收起 |
| R3 | VitePress 父级 `.container`/`.content` 默认上限 1104px，内层放宽无效 | 优化层放宽父级到 `--docs1-doc-max: 78rem`，`--docs1-layout-max: 1600px` 映射 `--vp-layout-max-width` |
| R4 | 双栏比例 `minmax(0,1fr) minmax(16rem,22rem)`，正文与侧栏等宽 | 改 `minmax(0, var(--docs1-content-measure)) minmax(18rem, 22rem)` + `justify-content: space-between` |
| R5 | **`markdown.headers` 未显式开启 → VitePress 的 `headersPlugin` 不注册，页面 headers 恒为 `[]`，全站右栏目录为空**（基线构建同样为空，属长期缺陷） | `config.mts` 显式 `headers: { level: [2,3] }`；`check:layout` **L10** 改为「有右栏容器但页面标题数据为空」判空 |

补充：`cmp-split` 的 core 规则原先两处 `return false`（markdown-it 中会中断 core 链）。
实测 `config(md)` 在 VitePress 插件注册之后执行，故该返回值并非本次空目录的成因；
已改为 `return true` 以免将来插件顺序变化时再次踩坑。

### 修复后复核（静态 + DOM）

| 项 | 结果 |
|---|---|
| 十三条门禁 | **全绿**（含 L1–L11） |
| 组件页右栏容器 | `VPDocAside` **0** 次（空列消失） |
| landing 页右栏容器 | `VPDocAside` **0** 次 |
| 知识点页 headers | 非空（此前恒为 `[]`） |
| 空目录自动收起规则 | 已进产物 CSS |
| 父级放宽与令牌 | `--docs1-doc-max:78rem`、`--docs1-layout-max:1600px` 已进产物 |

**未完成**：Playwright 在本次复核阶段无法启动浏览器（缺 `libglib-2.0.so.0`），
故「修复后主栏宽度、重叠数、利用率」三项需在有浏览器的环境量取（见第六节脚本）。

## 六、待人工复核

- 浏览器内 375 / 768 / 1280 三档观感与深色模式；顶栏切换控件的实际点击与刷新保持。
- 004 遗留的键盘流程复核。
