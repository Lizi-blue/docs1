# 契约：设计令牌与体验（design-tokens-contract）

适用对象：站点主题与所有可复用前端组件。判据来源：`spec.md` 的 FR-010…FR-016；
机械断言脚本：`scripts/check-experience.mjs`（`npm run check:experience`）。

## 1. 令牌层

令牌定义在 `docs/.vitepress/theme/styles/tokens.css`，命名前缀 `--docs1-*`，
并在 VitePress `--vp-*` 变量之上派生（保证与站点主题、深色模式一致）。

| 类别 | 最少令牌 | 示例 |
|---|---|---|
| `space` | 5 档 | `--docs1-space-1` … `--docs1-space-5`（4/8/12/16/24） |
| `font` | 4 档 | `--docs1-font-xs` / `sm` / `md` / `lg` |
| `radius` | 3 档 | `--docs1-radius-sm/md/lg` |
| `shadow` | 2 档 | `--docs1-shadow-1/2` |
| `color` | 语义色 | `--docs1-color-accent` / `success` / `warn` / `danger` / `muted` |
| `focus` | 1 档 | `--docs1-focus-ring`（`outline` 宽度 + 颜色 + offset） |
| `state` | 5 档 | `--docs1-state-hover` / `active` / `disabled` / `loading` / `selected` |

规则：

- 组件与站点样式 MUST 通过令牌取值；MUST NOT 出现原始色值（`#rgb`、`rgb()`、`hsl()`）。
- 间距、字号、圆角、描边宽度与颜色 MUST 走令牌，MUST NOT 写裸值。
- 裸 `px` 白名单（可机械校验）：令牌定义文件本身；结构尺寸属性（`width`、`height`、
  `min-width`、`min-height`、`max-width`、`max-height`）；媒体查询断点；`env()` 安全区表达式。
  白名单之外的裸 `px` MUST 判错。
- 每个令牌 MUST 在深色模式有对应值（`html.dark` 覆盖块或 `--vp-c-*` 派生）。

## 2. 交互状态矩阵

| 状态 | 要求 |
|---|---|
| 默认 | 可读、可点，光标与语义元素匹配 |
| 悬停 | 有可见反馈（背景/边框/颜色变化之一） |
| 焦点 | MUST 用 `:focus-visible` 呈现 `--docs1-focus-ring`，MUST NOT 移除 outline |
| 按下 | 有反馈（`--docs1-state-active`） |
| 禁用 | 用 `disabled`/`aria-disabled`，视觉降级且不可触发 |
| 加载 | 有 `--docs1-state-loading` 呈现与文案，操作入口禁用避免重复提交 |
| 空态 | 有明确文案说明「为什么空、下一步做什么」 |
| 错误 | 文案含原因与下一步动作，不只报错码 |
| 降级 | 依赖不可用时给替代说明，不白屏、不抛未捕获错误 |

## 3. 可访问性

- 表单控件 MUST 有可关联标签（`<label for>` 或 `aria-label`）。
- 状态变化区域 MUST 用 `aria-live`（日志面板 `polite`，错误 `assertive` 或 `role="alert"`）。
- 主要操作 MUST 可键盘完成：Tab 可达、Enter/Space 触发、顺序合理。
- 前景与背景对比 MUST ≥ 4.5:1（正文）与 ≥ 3:1（大字与图形边界）。

## 4. 响应式

- 三档断点：≤640px（手机）、641–1024px（平板）、>1024px（桌面）。
- 正文与面板 MUST NOT 横向溢出；宽内容（表格、代码、日志）MUST 在自身容器内滚动。
- 触控目标 MUST ≥ 32px。

## 5. 机械断言与人工项

| 检查 | 类型 | 断言 |
|---|---|---|
| X1 令牌文件存在且类别齐全 | mechanical | 每个类别 ≥1 个 `--docs1-*` |
| X2 深色模式覆盖 | mechanical | 深色块存在且覆盖同一批令牌名 |
| X3 无原始色值 | mechanical | 组件与站点样式扫描为 0（令牌文件除外） |
| X4 焦点环 | mechanical | 存在 `:focus-visible` 规则且引用 `--docs1-focus-ring` |
| X5 状态类齐备 | mechanical | hover/active/disabled/loading/empty/error/degraded 均有规则 |
| X6 对比度 | mechanical | 关键前景/背景对按 WCAG 公式 ≥ 4.5 或 ≥ 3（大字/图形） |
| X7 响应式与滚动 | mechanical | 三档断点存在；宽内容容器有 `overflow-x: auto` |
| X8 键盘完成提交与取消 | manual | quickstart S6 人工步骤 |
| X9 真实视口观感与深色可读 | manual | quickstart S7 人工步骤 |
| X10 屏幕阅读器朗读顺序 | manual | quickstart S7 人工记录 |
