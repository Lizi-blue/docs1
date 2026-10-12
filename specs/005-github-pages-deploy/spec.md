# Feature Specification: GitHub Actions 双远端发布与 GitHub Pages 站点（github-pages-deploy）

**Feature Branch**: `005-github-pages-deploy`

**Created**: 2026-10-12

**Status**: Draft

**Input**: User description: 「当前 gitea 仓库我已经设置自动推送到 github https://github.com/Lizi-blue/docs1.git 这是 github 地址，现在需要增加 github actions 适配，实现推送后 gitea 和 github 分别自动部署到本机 k3s 和 github pages 我需要在 github pages 直接访问到我们的页面」（承宪法 1.5.0 原则 XI 组件首发仓与原则 III 内容契约可执行、原则 VII 规模优先）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 在 GitHub Pages 直接访问站点（Priority: P1）

读者拿到 GitHub Pages 地址就能打开站点：首页、导航、知识点页、组件页与图解全部可用，样式与脚本正常，站内搜索能出结果。不需要内网、不需要任何本机服务。

**Why this priority**: 这是本次需求的直接目标：把站点发布到公网可访问的地址。

**Independent Test**: 打开 Pages 地址，抽查首页、两个领域入口、一个知识点页、两个组件页与两张图解，断言全部打开且无资源加载失败；站内搜索返回结果。

**Acceptance Scenarios**:

1. **Given** 一次推送到主分支，**When** 托管侧构建发布完成，**Then** Pages 地址的首页可打开，样式与脚本正常。
2. **Given** Pages 上的任一页面，**When** 点击导航与正文内的内部链接，**Then** 全部可达，不出现 404 或样式丢失。
3. **Given** Pages 上的站点，**When** 使用站内搜索，**Then** 返回与内容对应的结果。
4. **Given** 图解页面，**When** 打开任一图解，**Then** 图解自包含渲染，不请求外部网络资源。

### User Story 2 - 一次推送，两条部署链路各自独立（Priority: P1）

提交推送到 Gitea 后镜像到 GitHub。Gitea 侧照旧部署到本机集群，GitHub 侧构建并发布到 Pages。两侧来自同一提交，任一侧失败不影响另一侧。

**Why this priority**: 用户要求两套部署并存；单点失败不能拖垮另一条链路。

**Independent Test**: 观察同一次推送触发的两条运行记录：两侧都成功，产物对应同一提交；人为让一侧失败，另一侧仍成功。

**Acceptance Scenarios**:

1. **Given** 一次推送到主分支，**When** 两条流水线执行完毕，**Then** Gitea 侧部署成功且域名可访问，GitHub 侧发布成功且 Pages 可访问。
2. **Given** 托管侧构建失败，**When** 查看 Gitea 侧运行，**Then** 内网部署仍成功，域名内容保持上一版本可用。
3. **Given** 两条流水线，**When** 对比产物来源，**Then** 指向同一提交。

### User Story 3 - 静态托管下的能力降级（Priority: P1）

Pages 上只有静态内容，后端任务服务不可用。受影响的交互组件给出明确降级提示，说明服务不可用与原因；文档正文完整可读，不白屏、不出现死链。

**Why this priority**: 站点里有依赖后端服务的组件；不处理会让公网读者看到坏页面。

**Independent Test**: 在 Pages 上打开任务控制台组件页，断言出现降级提示、页面其余部分完整；全站抽查无死链。

**Acceptance Scenarios**:

1. **Given** Pages 上的任务控制台组件页，**When** 打开页面，**Then** 显示「服务不可用」降级提示并给出排查方向，正文与依赖索引完整。
2. **Given** Pages 全站，**When** 抽查内部链接，**Then** 全部可达，无指向内网地址的链接。
3. **Given** 后端不可用，**When** 打开任一文档页，**Then** 阅读不受影响，不出现未捕获错误。

### User Story 4 - 发布前门禁与现有部署保持不变（Priority: P2）

发布只在质量门禁通过后发生；门禁失败则不发布，上一版本继续可用。现有内网部署链路、域名与镜像规则不变。

**Why this priority**: 公网发布不能降低质量门槛，也不能影响已有可用链路。

**Independent Test**: 故意破坏内容门禁（例如删除必需小节），断言托管侧不发布且上一版本仍可访问；核对内网域名与健康检查仍正常。

**Acceptance Scenarios**:

1. **Given** 内容门禁失败，**When** 流水线执行，**Then** 不发布新版本，Pages 仍为上一版本。
2. **Given** 一次正常发布，**When** 检查门禁步骤，**Then** 与内网侧同一套门禁全部通过。
3. **Given** 本特性上线后，**When** 访问内网域名，**Then** 页面、健康检查与镜像标签规则与之前一致。

### User Story 5 - 发布可追溯、失败可定位（Priority: P2）

每次发布能对应到提交与运行记录；失败时能从运行日志直接看出是哪一步、什么原因，并给出可操作提示。

**Why this priority**: 公网发布出问题时，需要快速判断是内容问题、构建问题还是仓库配置问题。

**Independent Test**: 人为制造两类失败（门禁失败、仓库配置未就绪），断言日志能指出具体步骤与可操作修法。

**Acceptance Scenarios**:

1. **Given** 一次发布，**When** 查看运行记录，**Then** 能看到对应提交与产物地址。
2. **Given** 仓库配置未就绪（未开启 Pages），**When** 流水线执行，**Then** 失败信息明确指出需要开启的开关。

### Edge Cases

- 站点部署在仓库子路径下：绝对路径资源与前端路由都可能失效。
- 站内链接包含带锚点的深链与去掉数字前缀的 URL。
- 首次发布时 Pages 尚未开启。
- 大体积图解资源（每张约 0.7MB，共 11 张）与托管体积限制。
- 镜像同步存在延迟，GitHub 侧可能先于或后于 Gitea 侧构建。
- 同一分支连续推送时的并发运行。
- 依赖后端服务的组件在公网静态托管上的表现。
- 自定义域名与默认域名同时存在时的规范地址（本特性不引入自定义域名）。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 推送到主分支后，GitHub 侧 MUST 自动构建并发布站点到 GitHub Pages，MUST NOT 需要人工步骤。
- **FR-002**: 发布产物 MUST 在仓库子路径下可用：页面、样式、脚本、图片与图解资源 MUST 全部加载成功，MUST NOT 出现资源 404 或样式丢失。
- **FR-003**: 站点内部链接与导航 MUST 在子路径下可点击到达，带锚点的深链 MUST 正常跳转。
- **FR-004**: 站内搜索 MUST 在 Pages 上可用。
- **FR-005**: 同一次提交 MUST 同时驱动内网部署与 Pages 发布两条链路，二者 MUST 互不阻塞：一条失败 MUST NOT 阻止另一条完成。
- **FR-006**: 发布 MUST 以质量门禁通过为前提；门禁失败时 MUST NOT 发布新版本，且上一版本 MUST 保持可访问。
- **FR-007**: Pages 上依赖后端服务的交互组件 MUST 显示明确降级提示（说明不可用与原因），页面正文 MUST 保持完整可读。
- **FR-008**: 仓库配置未就绪时，流水线 MUST 以可操作的提示失败（指出需要开启的配置项）。
- **FR-009**: 每次发布 MUST 可追溯到提交，失败 MUST 能定位到具体步骤与原因。
- **FR-010**: 发布流程 MUST 自足完成：MUST NOT 依赖内网地址、本机集群或私有包源。
- **FR-011**: 现有内网部署链路 MUST 保持不变：域名、健康检查、镜像标签规则与部署方式 MUST NOT 因本特性改变。
- **FR-012**: 站点 MUST 保持自包含：MUST NOT 依赖外部网络资源（含图解、字体与样式）。
- **FR-013**: 同分支连续推送时，旧运行 MUST 可被取消，最终发布 MUST 对应最新提交。
- **FR-014**: 文档 MUST 说明两端访问地址、发布触发条件、门禁要求与 Pages 的能力边界（无后端服务）。

### Key Entities

- **DeploymentTarget**：内网集群与公网静态托管两个目标；各自的触发条件、产物形态与访问地址。
- **PublishRun**：一次发布运行；提交标识、状态、产物地址、失败步骤与原因。
- **GateSet**：发布前的质量门禁集合；两端共用同一套。
- **DegradedComponent**：在静态托管上不可用的交互组件；降级提示文案与作用范围。
- **SiteArtifact**：构建产物；子路径前缀、资源清单、搜索索引与图解资源。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 推送后 10 分钟内，Pages 地址首页可打开且运行状态为成功。
- **SC-002**: 抽查 10 个页面（首页、两个领域入口、知识点页、两个组件页、两张图解与两个入口页），全部打开且无资源加载失败。
- **SC-003**: 站内搜索在 Pages 上返回非空结果。
- **SC-004**: 同一次推送产生两条成功运行记录，二者对应同一提交。
- **SC-005**: 故意破坏内容门禁时，Pages 不发布，上一版本仍可访问，且运行日志指出失败步骤。
- **SC-006**: Pages 上的任务控制台显示降级提示；文档页正文完整，无未捕获错误。
- **SC-007**: 未开启 Pages 时，运行失败信息明确指出需要开启的配置项。
- **SC-008**: 特性上线后，内网域名访问与健康检查与改动前一致（抽查同一组页面与检查项）。

## Assumptions

- GitHub 仓库可公开访问（已核实匿名访问返回成功），Pages 使用默认 `github.io` 域名，本特性不引入自定义域名。
- Gitea 到 GitHub 的镜像推送已由用户配置；本特性只负责 GitHub 侧的构建发布与两条链路的协调。
- 托管环境可访问公共包源与公共镜像源；不依赖内网资源与私有源。
- Pages 只托管静态内容；后端任务服务不部署到 Pages，公网读者只读文档与图解。
- 两端执行同一套质量门禁；门禁命令在托管环境可运行。
- 内容体积在托管限制内（当前图解合计约 8MB，单文件约 0.7MB）。
