# Implementation Plan: 参照 taste-skill 优化布局、目录与内容布局（layout-taste）

**Branch**: `006-layout-taste` | **Date**: 2026-10-13 | **Spec**: [spec.md](./spec.md)

## Summary

在**不改内容、不改 URL、不改导航层级**的前提下，把布局、目录与内容布局按 taste-skill 的适用规则重做一遍，
并把「经典样式」冻结成可切换的第二档：构建期由 `DOCS1_LAYOUT` 选默认档，运行时由页面上的切换控件即时互换。

三件事：

1. **样式双档**：`classic.css`（逐字冻结当前样式）+ `taste.css`（新增优化层，全部规则限定在 `html.layout-taste` 下）。
2. **档位开关**：构建期注入默认档（`DOCS1_LAYOUT=classic|taste`，默认 `taste`）；
   运行时切换写入 `localStorage`，并在首屏前设置根类名，避免闪烁。
3. **机械门禁**：新增 `check:layout`，断言经典样式与基线标签逐字一致、断点标准、顶栏高度上限、
   无 `100vh`、无 flex 百分比栅格、切换机制齐备。

## Technical Context

**Language/Version**: Node 22 + Vue 3.5 + VitePress 1.6；CSS（令牌 + 作用域类）
**Primary Dependencies**: 零第三方 UI 库；只用 VitePress 变量与自建令牌
**Testing**: `check:layout`（新增）+ 既有十二条门禁 + 两种档位各自构建
**Target Platform**: 内网 k3s（`/`）与 GitHub Pages（`/docs1/`）两套同源产物
**Constraints**: 内容/URL/导航层级不变；恢复能力 MUST 保持（标签 + 脚本 + 双档开关）
**Scale/Scope**: 1 套主题、2 个档位、约 300 行经典样式冻结 + 约 250 行优化层

## Constitution Check

| 原则 | 落点 | 结论 |
|---|---|---|
| I 内容即事实源 | 只改样式与开关，不触碰内容与元数据 | PASS |
| III/IV 契约与机械门禁 | 新增 `check:layout` 进 CI；经典样式逐字冻结可机械断言 | PASS |
| VII 规模优先 | 只加 1 个样式层、1 个组件、1 个门禁脚本，零新依赖 | PASS |
| X 导航层级 | 导航层级与 URL 不变；仅调密度与选中态 | PASS |
| XI 组件首发仓 | 切换控件按组件规范实现（scoped、令牌、键盘可达） | PASS |

## Project Structure

```text
docs/.vitepress/theme/styles/classic.css     # 冻结：当前 custom.css 逐字搬家
docs/.vitepress/theme/styles/taste.css       # 新增：优化层（html.layout-taste 作用域）
docs/.vitepress/theme/styles/custom.css      # 保留为入口：@import classic + 档位相关基础规则
docs/.vitepress/theme/components/LayoutSwitch.vue  # 新增：运行时切换控件（键盘可达）
docs/.vitepress/theme/Layout.vue             # 挂载切换控件
docs/.vitepress/config.mts                   # 读 DOCS1_LAYOUT，注入首屏根类名脚本
scripts/check-layout.mjs                     # 新增门禁
specs/006-layout-taste/contracts/layout-switch-contract.md  # 切换契约
AGENTS.md / README.md                        # 档位与门禁说明
```

## Complexity Tracking

| 复杂度来源 | 为什么需要 | 简单替代为何不够 |
|---|---|---|
| 双档样式层 | 用户要求随时可回现有样式，且外部读者不应受影响 | 只靠 git 回滚：需重新构建与部署，恢复慢 |
| 首屏前设类的内联脚本 | 运行时切档若不预设类名会闪烁 | 纯 CSS 无法读 localStorage |
| 经典样式逐字冻结断言 | 防止改造顺手改坏经典档 | 人工比对：一次疏忽就破坏恢复能力 |
