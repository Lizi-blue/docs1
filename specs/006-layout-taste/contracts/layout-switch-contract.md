# 契约：布局档位切换（layout-switch-contract）

适用对象：`docs/.vitepress/config.mts`、`theme/styles/*`、`theme/components/LayoutSwitch.vue`。
判据来源：`spec.md` 的 FR-001…FR-005、FR-006、FR-023、FR-024。

## 1. 档位取值

| 档位 | 含义 | 默认 |
|---|---|---|
| `taste` | 优化后布局（本轮成果） | 是 |
| `classic` | 改造前布局（与基线标签逐字一致） | 否 |

- 构建期：`DOCS1_LAYOUT`，取值非 `taste`/`classic` 时构建 MUST 报错终止。
- 运行期：读者可切换，选择写入 `localStorage`，刷新后保持。
- 优先级：运行期选择 > 构建期默认。

## 2. 类名与作用域

- 根元素 MUST 带 `layout-taste` 或 `layout-classic`，二者互斥。
- 优化层规则 MUST 全部限定在 `html.layout-taste`（或其后代）之下，MUST NOT 影响经典档。
- 经典档 MUST 不依赖任何优化层规则即可完整呈现。

## 3. 首屏无闪烁

- MUST 在样式生效前设置根类名（内联脚本，位于 `head`）。
- 脚本 MUST 容错：`localStorage` 不可用时回退到构建期默认档，MUST NOT 抛错中断渲染。

## 4. 切换控件

- MUST 可键盘操作，带可见焦点与可读标签（含当前档位）。
- MUST 使用设计令牌取色取尺寸；样式 MUST `scoped`。
- MUST NOT 依赖外部资源；MUST NOT 触发网络请求。

## 5. 机械断言（`npm run check:layout`）

| 编号 | 断言 |
|---|---|
| L1 | `classic.css` 与基线标签中的样式文件逐字一致（冻结未被破坏） |
| L2 | 断点含 640 / 768 / 1024 / 1280 |
| L3 | 顶栏高度上限存在且 ≤ 80px；MUST NOT 使用 `100vh`（用 `100dvh`） |
| L4 | 优化层规则全部限定在 `html.layout-taste` 之下 |
| L5 | 切换机制齐备：根类名、localStorage 键、控件组件、构建期变量校验 |
| L6 | MUST NOT 出现 flex 百分比栅格写法（`width: calc(N% - …)`） |
