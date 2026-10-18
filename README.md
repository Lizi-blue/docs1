# docs-1 技术面试备考文档引擎

内容即事实源，导航是派生视图。放 Markdown 与 YAML 元数据，引擎产出导航、学习路径与组件索引。

## 1. 目录结构

```text
docs/
├── _meta.yml                    # 站点根元数据
├── index.md                     # 首页
├── <domain>/                    # 领域
│   ├── _meta.yml                # name / icon / order / description / entry_type
│   ├── index.md                 # 领域入口页，entry: domain
│   ├── learn/                   # 渐进式学习入口
│   │   ├── _meta.yml
│   │   ├── index.md             # entry: learn
│   │   └── <NN-knowledge-domain>/
│   │       ├── _meta.yml        # 含 teach 五字段
│   │       └── <NN-page>.md     # 知识点，四段式
│   └── components/              # 组件查询入口
│       ├── _meta.yml
│       ├── index.md             # entry: components
│       └── <NN-name>.md         # 组件页
└── cross-domain/<NN-name>.md    # 跨领域组件
```

## 2. 新增内容的最少步骤

### 2.1 新增领域

```bash
node scripts/new-content.mjs domain backend
npm run check:content
```

一趟产出 `_meta.yml`、`index.md` 与两个入口页。填好名称、图标与描述就能用。

### 2.2 新增知识域

```bash
node scripts/new-content.mjs knowledge-domain concurrency --domain backend
```

产出的 `_meta.yml` 含 `teach` 五字段骨架。

### 2.3 新增知识点

```bash
node scripts/new-content.mjs knowledge thread-basics --domain backend --knowledge-domain concurrency
```

页面骨架含四段式与四个教学要素。
命令同时把 `{ slug, goal }` 追加进知识域 `teach.lessons`。

### 2.4 新增组件

```bash
node scripts/new-content.mjs component safe-queue --domain backend
```

组件页骨架含三种引用方式标题。

### 2.5 另外两种 kind

```bash
node scripts/new-content.mjs cross-component task-scheduler --domain backend
node scripts/new-content.mjs entry learn --domain backend
```

加 `--dry-run` 只打印将写入的文件。
加 `--order N` 指定排序号。
目标已存在时命令退出码 1，并打印冲突路径。

## 3. 提交前门禁

```bash
npm run check:content       # 内容契约 V1–V22
npm run check:zh            # 受控中文
npm run check:component     # 组件页契约（方向纯净、知识索引、复用清单、样式作用域）
npm run check:experience    # 体验断言（令牌、状态、焦点、对比度、响应式）
npm run selftest:gates      # 门禁自测（定向破坏夹具）
npm run test:component      # 组件与服务自测
npm run check:extensibility # 零配置扩展断言
npm run build               # 站点构建
npm run check:responsive    # 响应式（构建后）
npm run check:nav           # 导航层级 N1–N5（构建后）
```

十三条命令退出码都为 0 才算通过。CI 在镜像构建阶段全跑。

## 布局档位（优化版 / 经典版）

站点有三套布局档位，默认 `teek`（主题版）。顶栏可随时切换，选择记在本地。

```bash
npm run build                      # 主题版（默认）
DOCS1_LAYOUT=taste npm run build   # 优化版（方案 A）
DOCS1_LAYOUT=classic npm run build # 经典版（改造前）
npm run check:layout               # 布局门禁：冻结未被破坏、断点标准、顶栏上限、作用域
```

## 样式回滚（布局改造随时可退）

布局改造前的状态已打成注解标签 `layout-baseline-pre-taste`。

```bash
node scripts/restore-layout.mjs --dry-run    # 预演：列出有差异的布局文件，不改工作区
node scripts/restore-layout.mjs              # 实做：从基线恢复布局文件
npm run check:content && npm run check:experience && npm run build
```

只恢复布局面文件（站点配置、主题布局、样式、组件、取数）。内容、URL 与引擎不在范围内。
也可指定其它基线：`node scripts/restore-layout.mjs --tag <标签或提交>`。
加 `--prune` 会同时删除基线中不存在的新增布局文件，做精确回滚。
改造规则与验收见 `specs/006-layout-taste/`。

## 发布

| 目标 | 地址 | 触发 | 基础路径 |
|---|---|---|---|
| 内网 k3s | `<内网站点地址>` | 推送到主分支（Gitea 流水线） | `/` |
| GitHub Pages | `https://lizi-blue.github.io/docs1/` | 推送到主分支（GitHub 流水线） | `/docs1/` |

两条链路互不阻塞。公网侧无后端服务，任务控制台显示降级提示；产物不得包含内网信息。

## 4. 交付与验收

CI 走 `dev/ci` 中心仓模板。仓内只留薄工作流与交付文件。

| 文件 | 作用 |
|---|---|
| `ci.env` | 能力开关 |
| `Dockerfile` | 构建镜像：九条门禁加站点构建，运行阶段装 python3 |
| `Caddyfile` | 静态托管、`/api` 反代与 `/health` |
| `service/` | 任务服务（Python 标准库）：下发、取消、监控与 SSE 输出 |
| `scripts/entrypoint.sh` | 容器入口：同时拉起任务服务与 Caddy |
| `deploy/*.yaml` | K8s 清单，ci 渲染后 apply |
| `.gitea/workflows/ci.yaml` | 薄触发工作流 |

部署后验收：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' "$SITE/health"
curl -sS -o /dev/null -w '%{http_code}\n' "$SITE/"
kubectl -n docs rollout undo deploy/docs-1-docs
```

域名未生效时用 Host 头等价验收。

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -H "Host: $SITE_HOST" "$SITE_IP/"
```

DNS 与证书属外部前置，责任方与验收方式见部署契约 §5。

## 5. 任务服务（任务下发与实时输出）

同源部署：Caddy 把 `/api/*` 反代到 `127.0.0.1:8787`，浏览器用 `EventSource` 实时读输出。
演示入口在组件查询的「任务控制台」组件页。

```bash
# 本地起服务（默认 127.0.0.1:8787）
DOCS1_WORKSPACE=/tmp/docs1-tasks python3 -m service.app

# 下发一个 cp 任务
curl -sS -X POST http://127.0.0.1:8787/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"command":"cp","args":["-v","src.txt","dst.txt"]}'

# 实时看输出（SSE）
curl -N http://127.0.0.1:8787/api/tasks/<id>/stream
```

| 端点 | 说明 |
|---|---|
| `GET /api/health` | 版本、运行中任务数与限额 |
| `POST /api/tasks` | 下发。400 校验失败，429 并发超限 |
| `GET /api/tasks` | 任务列表与限额（含白名单） |
| `GET /api/tasks/{id}` | 单任务状态与指标 |
| `POST /api/tasks/{id}/cancel` | 取消。已结束返回 409 |
| `GET /api/tasks/{id}/stream` | SSE：`output` / `status` / `end`，支持 `Last-Event-ID` 续传 |

环境变量：`DOCS1_PORT`、`DOCS1_WORKSPACE`、`DOCS1_MAX_CONCURRENCY`、`DOCS1_TIMEOUT_MAX_S`、
`DOCS1_OUTPUT_MAX_BYTES`、`DOCS1_KEEP`、`DOCS1_SERVICE_CONFIG`。

安全边界（务必知情）：服务只执行 `service/config.json` 里的白名单命令，
不使用 `shell=True`，参数拒绝 shell 元字符与控制字符，工作目录限定在工作区内，
输出、超时与并发都有上限。任务状态只存内存，重启即清空。**无鉴权，仅限内网实验室使用。**

## 6. 规范与指针

| 主题 | 正文位置 |
|---|---|
| 内容契约 | `specs/001-docs-engine/contracts/content-contract.md` |
| 工具契约 | `specs/001-docs-engine/contracts/tooling-contract.md` |
| 交付契约 | `specs/001-docs-engine/contracts/deploy-contract.md` |
| 编排数据模型 | `specs/002-content-orchestration/data-model.md` |
| 任务服务规格 | `specs/003-task-dispatch/spec.md` |
| 协作与写作约定 | `AGENTS.md` |
| 项目宪法 | `.specify/memory/constitution.md` |

## 7. 本地预览

```bash
npm run dev       # 本地开发服务器
npm run preview   # 预览构建产物
```
