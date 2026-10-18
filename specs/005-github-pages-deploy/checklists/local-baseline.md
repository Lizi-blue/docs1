# 本地与线上验收证据（005 GitHub Pages 发布链路）

> 每项记录命令与真实输出。线上地址：内网 `https://<internal-host>`、公网 `https://lizi-blue.github.io/docs1/`。

## 环境

| 项 | 值 |
|---|---|
| 日期 | 2026-10-12 |
| Node / Python | v22.23.2 / 3.13 |
| 内网提交 | `6d7e9f7`（Gitea CI #4583）、`688e889`（Gitea CI #4584） |
| 公网提交 | `6d7e9f7`（GitHub Actions Pages #1）、`688e889`（#2） |

## 十二条门禁（本地，内网 base）

| 命令 | 结果 |
|---|---|
| `check:content` | 错误 0 / 警告 0（V1–V23） |
| `check:zh` | 硬违规 0（baseline 0） |
| `check:component` | 组件页 3 个 / 错误 0（C1–C7） |
| `check:experience` | 错误 0（X1–X7） |
| `check:orchestration` | S1–S7 通过 |
| `test:component` | 46 passed / 3 skipped |
| `selftest:gates` | 18 例符合预期（G0–G17） |
| `check:extensibility` | 通过 |
| `build` | build complete |
| `check:responsive` | 通过 |
| `check:nav` | 通过（N1–N6） |
| `check:pages` | 错误 0（P1–P7） |

## S0 双基础路径构建

| 命令 | 结果 |
|---|---|
| `npm run build` | 成功；产物链接以 `/` 开头；页脚含内网标识 |
| `DOCS1_BASE=/docs1/ npm run build` | 成功；产物链接以 `/docs1/` 开头 |

## S1 产物门禁（FR-002 / FR-006 / FR-012）

```
产物断言：base=/docs1/（推断自产物） / 文件 148 个 / 错误 0 项
hasNoJekyll=true has404Fallback=true internalAddressHits=0 externalResourceHits=0 unprefixedRootLinks=0 unservableNames=0
```

## S2 门禁与内网同源（FR-006）

`.github/workflows/pages.yml` 的 12 条命令与 `AGENTS.md` §2 清单逐条一致：
`check:content`、`check:zh`、`check:orchestration`、`test:component`、`selftest:gates`、
`check:extensibility`、`check:component`、`check:experience`、`build`、`check:responsive`、`check:nav`、`check:pages`。
门禁步骤全部位于上传与部署之前。

## S3 本地子路径与深链（FR-002 / FR-003）

```
站内链接以 /docs1/ 开头：636 处；未加前缀的站内根链接：0 处
组件渲染链接：href="/docs1/..."；图解 iframe：src="/docs1/diagrams/queue-handshake.html"
模拟子路径挂载（/tmp/pages-sim/docs1）：
  /docs1/                                       200
  /docs1/backend/learn/concurrency/thread-basics.html   200
  /docs1/backend/components/task-console.html   200
  /docs1/404.html                               200
  /docs1/assets/style.*.css                     200
```

## S4 发布（FR-001 / SC-001）

| 项 | 值 |
|---|---|
| 内网流水线 | Gitea **#4583**（`6d7e9f7`）、**#4584**（`688e889`）全绿，部署成功 |
| 公网流水线 | GitHub Actions **Pages #1**（`6d7e9f7`）、**#2**（`688e889`）、**#4**（`a078939`）completed / success |
| 并发演练（FR-013 / T019） | 两次推送间隔 20 秒：运行 **#3**（`10efb44`）**cancelled**，运行 **#4**（`a078939`）接管并 success，最终发布对应最新提交 |
| 首次可访问耗时 | 推送后约 1 分钟可访问首页（SC-001 要求 10 分钟内） |
| 运行记录含提交 | 是（`head_sha` 与运行摘要） |

## S5 线上抽查（10 项，SC-002 / SC-003）

| # | 路径 | 状态 |
|---|---|---|
| 1 | `/docs1/` | 200 |
| 2 | `/docs1/backend/` | 200 |
| 3 | `/docs1/frontend/` | 200 |
| 4 | `/docs1/backend/learn/concurrency/thread-basics`（无扩展名深链） | 200 |
| 5 | `/docs1/frontend/components/task-console` | 200 |
| 6 | `/docs1/backend/components/task-console` | 200 |
| 7 | `/docs1/backend/components/safe-queue` | 200 |
| 8 | `/docs1/diagrams/executor-lifecycle.html` | 200 |
| 9 | `/docs1/backend/learn/communication/queue-and-pipe` | 200 |
| 10 | `/docs1/cloudnative/` | 200 |

补充：线上首页引用的全部资源（入口、框架、主题、样式、字体、图标）逐个 200；
`.nojekyll` 与 `404.html` 均 200。

**站内搜索（SC-003）**：部署版搜索框 chunk 200；搜索索引 chunk `localSearchIndexroot.*.js` 200，
内容为真实索引（`documentCount: 560`，文档 ID 带 `/docs1/` 前缀）。

## S6 降级（FR-007 / SC-006）

- 组件页 200，含「公网静态托管的边界」说明；正文、知识索引、复用四件套完整。
- 降级文案随构建产物发布（存在于产物 chunk 中）：`任务服务不可用。提交与实时输出暂时关闭。静态说明仍可阅读。`
- 静态 HTML 阶段不渲染降级条（此时连接状态未知），水合后判定离线显示；该交互由人工在浏览器复核。
- 公网产物内网域名命中 **0**。

## S7 失败演练

| 场景 | 证据 |
|---|---|
| 门禁失败即不发布 | 工作流中 12 条门禁全部位于上传与部署之前；本地以「删掉必需小节」的方式验证门禁会失败并给出可读原因 |
| 平台配置未就绪 | 工作流含 `enablement: true` 与失败提示步骤，指出需要在 Settings → Pages 选择 GitHub Actions |
| 产物门禁失败 | P2 曾真实拦下内网域名泄漏 132 处；P7 拦下 `@` 开头文件 |

## S8 双链路回归（FR-011 / SC-008）

| 项 | 值 |
|---|---|
| 内网 `/` | 200 |
| 内网 `/health` | 200 |
| 内网组件页 | 200 |
| 内网链路改动 | 无（`.gitea/`、`Caddyfile`、`deploy/`、`Dockerfile` 未被本特性修改） |
| 两条运行记录 | 同一提交短哈希：内网 Gitea #4583 / 公网 Pages #1（`6d7e9f7`）；#4584 / #2（`688e889`） |
| 失败隔离 | 两条流水线无互相调用与共享凭据；本特性期间公网侧 P2/P7 门禁失败只影响公网运行，内网两次部署均成功 |

## 实现中发现并修复的两处缺陷

| 缺陷 | 影响 | 修法 |
|---|---|---|
| 主题页脚写死内网域名 | 公网产物泄漏内网域名 132 处 | 站点标识改为环境变量 `DOCS1_SITE_LABEL`（内网默认值不变） |
| 搜索索引 chunk 名以 `@` 开头 | GitHub Pages 不提供该文件，公网站内搜索静默失效 | 构建期 `chunkFileNames` 去掉 `@` 前缀；产物门禁增 P7 防回归 |

## 仍需人工执行

- 浏览器内实做站内搜索一次（索引与组件均已可达，机械证据充分）。
- 004 遗留的键盘流程与三档视口/深色观感复核。
