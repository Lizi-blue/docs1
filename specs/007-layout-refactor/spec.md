# Feature Specification: 布局专题 —— 不修改内容，重构布局（layout-refactor）

**Feature Branch**: `007-layout-refactor`

**Created**: 2026-10-13

**Status**: Draft

**Input**: User description: 「依然不理想，创建专题1 不修改内容 重构布局。」

**约束前提**：本专题**只改布局**。正文、元数据、URL 与导航层级 MUST NOT 变化（用 git diff 证明内容零改动）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 桌面屏幕真正用起来（Priority: P1）

在 1440–1920 宽的桌面上打开任意页面，正文占据屏幕的主要宽度，两侧没有空列，元素之间没有重叠。
读者不需要横向滚动，也不需要忍受每行只有三十几字。

**Why this priority**: 用户两次反馈「屏幕利用率很低、排版重叠」，这是本专题的核心目标。

**Independent Test**: 在 1440、1560、1920 三档宽度打开领域首页、知识点页、组件页各一个，
量取正文宽度、空列宽度、重叠元素数，并按阈值判定。

**Acceptance Scenarios**:

1. **Given** 1560 宽视口，**When** 打开知识点页，**Then** 正文宽度 ≥ 46rem，页面无空列。
2. **Given** 1560 宽视口，**When** 打开组件页，**Then** 正文宽度 ≥ 46rem，引用栏不与正文重叠。
3. **Given** 1440 / 1920 宽视口，**When** 打开同一组页面，**Then** 正文至少占视口 45%，且无横向滚动。
4. **Given** 任意宽度，**When** 统计元素重叠，**Then** 重叠元素数为 0。

### User Story 2 - 组件页不再挤压正文（Priority: P1）

组件页有「正文 + 引用方式」两块内容。布局按可用宽度决定形态：宽屏并列，窄屏堆叠，
任何情况下正文都保持可读行宽。

**Why this priority**: 组件页是目前破版最严重的页面类型。

**Independent Test**: 在 1024 / 1280 / 1560 / 1920 四档宽度打开组件页，量取正文列宽与是否堆叠。

**Acceptance Scenarios**:

1. **Given** 1560 宽，**When** 打开组件页，**Then** 正文 ≥ 46rem 且引用栏完整可见。
2. **Given** 1280 及以下，**When** 打开组件页，**Then** 两块内容堆叠为单栏，正文占满阅读栏。
3. **Given** 任一宽度，**When** 查看引用栏，**Then** 栏内代码与表格不越出栏边界。

### User Story 3 - 随时可回到当前样式（Priority: P1）

布局重构期间与完成后，都能一键回到重构前的样子：运行时切换、构建期切换、标签回滚三条路都可用。

**Why this priority**: 用户在 006 就明确提出「随时切回原版」，重构期间更需要。

**Independent Test**: 分别执行运行时切换、`DOCS1_LAYOUT=classic` 构建、`restore-layout` 预演，确认三者可用。

**Acceptance Scenarios**:

1. **Given** 重构后的站点，**When** 顶栏切到经典版，**Then** 版式回到重构前且刷新后保持。
2. **Given** 仓库，**When** 执行 `DOCS1_LAYOUT=classic npm run build`，**Then** 构建成功且产物为经典版。
3. **Given** 仓库，**When** 执行 `restore-layout --dry-run --prune`，**Then** 列出全部将被恢复与删除的布局文件。

### User Story 4 - 借成熟主题的版式度量（Priority: P2）

布局参数（整页上限、文档区宽度、栏宽比例、顶栏高度、间距与圆角节奏）参考成熟 VitePress 主题的通行做法，
但**保留本仓自研引擎与全部门禁**。

**Why this priority**: 用户提出可借用开源主题；直接换主题会牵动引擎与门禁，借度量收益接近而风险最低。

**Independent Test**: 对照 `specs/006-layout-taste/reference/oss-theme-layout-notes.md` 的度量表，
逐项确认本仓令牌取值落在通行区间。

**Acceptance Scenarios**:

1. **Given** 本仓令牌，**When** 对照度量表，**Then** 文档区、阅读栏、顶栏、间距均在通行区间内。
2. **Given** 重构后的站点，**When** 运行全部门禁，**Then** 全绿（引擎与门禁未被替换）。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 内容 MUST 零改动：`docs/**` 的正文与元数据 MUST NOT 被修改（以 git diff 证明）。
- **FR-002**: URL、导航层级与组件页章节结构 MUST NOT 变化。
- **FR-003**: 桌面视口下正文 MUST 达到可读行宽（46rem 上下），MUST NOT 出现每行三十几字的情况。
- **FR-004**: 页面 MUST NOT 出现空列：有右栏容器时其内容 MUST 非空，否则 MUST 自动收起。
- **FR-005**: 元素 MUST NOT 重叠：宽内容外扩只在主栏生效，侧栏内 MUST 复位。
- **FR-006**: 组件页布局 MUST 按可用宽度自适应：宽屏并列，窄屏单栏。
- **FR-007**: 单页布局参数 MUST 由令牌表达，MUST NOT 在规则里散落魔法值。
- **FR-008**: 布局 MUST 在 640 / 768 / 1024 / 1280 / 1440 / 1536 六档下逐段声明折叠形态。
- **FR-009**: 三条回退路径 MUST 保持可用（运行期切换、构建期切换、标签回滚）。
- **FR-010**: 现有十三条门禁 MUST 继续通过；布局断言 MUST 扩展为可量取（重叠、空列、正文宽度、利用率）。
- **FR-011**: 量取 MUST 可重复执行：提供审计命令，输出每页的正文宽度、空列宽度、重叠数、利用率。
- **FR-012**: 布局参数 MUST 依据成熟主题的通行度量，并在文档中标注来源与区间。

### Key Entities

- **LayoutMetric**：布局度量；名称、取值、来源区间、对应令牌。
- **LayoutProfile**：布局档位；`classic` / `taste`（重构后）；默认值来自构建期变量。
- **LayoutAudit**：布局审计结果；页面、视口、正文宽度、空列宽度、重叠数、利用率、判定。
- **RegressionGuard**：内容零改动断言；内容目录、期望 diff 为空。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 1560 宽视口下抽查 3 类页面，正文宽度均 ≥ 46rem。
- **SC-002**: 上述页面重叠元素数为 0，空列宽度为 0。
- **SC-003**: 1440 / 1560 / 1920 三档下正文占视口比例均 ≥ 45%，无横向滚动。
- **SC-004**: 组件页在 1280 及以下为单栏，在 1560 及以上为并列，两档都满足 SC-001。
- **SC-005**: `docs/**` 的内容 diff 为空（仅主题、配置与脚本发生变化）。
- **SC-006**: 十三条门禁全绿，且新增的可量取断言在同一次运行中给出数值。
- **SC-007**: 三条回退路径各验证一次，均可用。
- **SC-008**: 内网与公网两端发布成功，抽查页面正常。

## Assumptions

- 允许修改：主题样式、站点配置、门禁脚本与文档；不允许修改内容、元数据与 URL。
- `classic` 档保持 006 的冻结样式不变，作为回退目标。
- 量取依赖浏览器；无浏览器环境以静态断言替代，并在证据中标注差异。
- 度量参考社区主题通行区间，使用前复核许可；本仓保持零第三方运行时依赖。
