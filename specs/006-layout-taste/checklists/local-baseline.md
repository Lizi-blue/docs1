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

## 四、待人工复核

- 浏览器内 375 / 768 / 1280 三档观感与深色模式；顶栏切换控件的实际点击与刷新保持。
- 004 遗留的键盘流程复核。
