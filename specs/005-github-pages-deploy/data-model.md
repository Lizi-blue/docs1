# Phase 1 数据模型：GitHub Actions 双远端发布与 GitHub Pages 站点

字段来源：`specs/005-github-pages-deploy/spec.md` 的 FR-001…FR-014；
约束口径与宪法 1.5.0 对齐。所有实体都能被本地命令或运行记录观测，便于机械校验。

## E1 DeploymentTarget（部署目标）

| 字段 | 类型 | 约束 |
|---|---|---|
| `name` | string | 必填，`internal-k3s` / `public-pages` |
| `trigger` | string | 必填，`push main` 为两者共同触发条件 |
| `basePath` | string | 必填，内网 `/`、公网 `/docs1/`；MUST 以 `/` 开头并以 `/` 结尾 |
| `artifact` | string | 必填，内网为容器镜像，公网为静态产物目录 |
| `accessUrl` | string | 必填，内网域名与公网 Pages 地址 |
| `healthCheck` | string | 内网为 `/health`；公网为首页与抽查页可打开 |
| `unchanged` | boolean | 内网目标 MUST 为真（本特性不改动其交付物） |

**校验规则**：两个目标的 `basePath` MUST 不同；`artifact` MUST 与实际产物一致
（容器镜像标签规则不变；静态产物含 `.nojekyll` 与深链兜底页）。

## E2 PublishRun（发布运行）

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | string | 必填，运行标识 |
| `target` | DeploymentTarget | 必填 |
| `commit` | string | 必填，短哈希；两条运行的 `commit` MUST 相同 |
| `status` | enum | `queued` / `building` / `gated` / `publishing` / `success` / `failure` / `canceled` |
| `failedStep` | string | 失败时必填，指向具体步骤 |
| `artifactUrl` | string | 成功时必填 |
| `startedAt` / `finishedAt` | timestamp | 必填 |

**状态迁移**：`queued → building → gated → publishing → success`；
任一环节失败进入 `failure`（`failedStep` 非空），**上一版本 MUST 保持可用**；
被更新运行取代时进入 `canceled`。

## E3 GateSet（门禁集合）

| 字段 | 类型 | 约束 |
|---|---|---|
| `commands` | string[] | 必填，与内网侧同一套十一条命令 |
| `pagesCommand` | string | 必填，产物门禁（基础路径、内网地址、自包含、兜底页） |
| `phase` | enum | `before-build` / `after-build` |
| `failPolicy` | enum | 固定 `block-publish`：任一失败 MUST NOT 发布 |

**校验规则**：两条目标执行的 `commands` MUST 完全一致；`pagesCommand` 只在公网目标追加。

## E4 PageBase（基础路径）

| 字段 | 类型 | 约束 |
|---|---|---|
| `value` | string | 必填，`/` 或 `/docs1/` |
| `source` | enum | `env` / `default`；`env` 优先 |
| `componentLinkPolicy` | enum | 固定 `prefix-all`：组件内动态链接 MUST 加前缀 |
| `markdownLinkPolicy` | enum | 固定 `framework-auto`：markdown 链接由框架自动处理 |
| `assertions` | string[] | 必填：产物中不得出现未加前缀的站内根链接 |

## E5 DegradedComponent（静态托管下降级的组件）

| 字段 | 类型 | 约束 |
|---|---|---|
| `name` / `page` | string | 必填，任务控制台组件与其页面 |
| `reason` | string | 必填：公网无后端服务 |
| `visibleText` | string | 必填，必须说明「不可用」与影响范围，MUST NOT 只显示错误码 |
| `intact` | string[] | 必填：正文、知识索引、复用四件套、图解必须完整 |
| `forbidden` | string[] | 必填：白屏、未捕获错误、死链、静默失败 |

## E6 SiteArtifact（站点产物）

| 字段 | 类型 | 约束 |
|---|---|---|
| `path` | string | 必填，静态产物目录 |
| `base` | string | 必填，随构建注入 |
| `hasNoJekyll` | boolean | 公网产物 MUST 为真 |
| `has404Fallback` | boolean | 公网产物 MUST 为真 |
| `internalAddressHits` | number | MUST 为 0（内网域名与私有地址字符串） |
| `externalResourceHits` | number | MUST 为 0（外部资源引用） |
| `unprefixedRootLinks` | number | MUST 为 0（未加基础路径的站内根链接） |
| `sizeBytes` | number | 应小于托管限制（当前约 7–8MB） |

## E7 DeployConflictRule（并发规则）

| 字段 | 类型 | 约束 |
|---|---|---|
| `group` | string | 必填，按分支分组 |
| `cancelInProgress` | boolean | 必填为真 |
| `finalSource` | enum | 固定 `latest-commit`：最终发布 MUST 对应最新提交 |

## 关系与不变量

```text
DeploymentTarget 1 ── * PublishRun
DeploymentTarget 1 ── 1 GateSet（内容命令一致，公网追加产物门禁）
DeploymentTarget 1 ── 1 PageBase
DeploymentTarget 1 ── * SiteArtifact
DegradedComponent * ── 1 DeploymentTarget（公网）
PublishRun 之间：同分支受 DeployConflictRule 约束
```

**跨实体不变量**

1. 两条 `PublishRun.commit` 必须相同（同一次推送两条链路）。
2. 任何一条链路失败 MUST NOT 改变另一条链路的结果（互不阻塞）。
3. `SiteArtifact.internalAddressHits` 与 `unprefixedRootLinks` 恒为 0 才允许发布。
4. 内网 `DeploymentTarget.unchanged` 恒为真：域名、健康检查与镜像标签规则不得变化。
