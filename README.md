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
npm run check:content   # 内容契约 V1–V18
npm run check:zh        # 受控中文
npm run build           # 站点构建
```

三条命令退出码都为 0 才算通过。

## 4. 交付与验收

CI 走 `dev/ci` 中心仓模板。仓内只留薄工作流与交付文件。

| 文件 | 作用 |
|---|---|
| `ci.env` | 能力开关 |
| `Dockerfile` | 构建镜像：三条门禁加站点构建 |
| `Caddyfile` | 静态托管与 `/health` |
| `deploy/*.yaml` | K8s 清单，ci 渲染后 apply |
| `.gitea/workflows/ci.yaml` | 薄触发工作流 |

部署后验收：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://docs1.minilab.uzibird.cn/health
curl -sS -o /dev/null -w '%{http_code}\n' https://docs1.minilab.uzibird.cn/
kubectl -n docs rollout undo deploy/docs-1-docs
```

域名未生效时用 Host 头等价验收。

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -H 'Host: docs1.minilab.uzibird.cn' http://192.168.2.203/
```

DNS 与证书属外部前置，责任方与验收方式见部署契约 §5。

## 5. 规范与指针

| 主题 | 正文位置 |
|---|---|
| 内容契约 | `specs/001-docs-engine/contracts/content-contract.md` |
| 工具契约 | `specs/001-docs-engine/contracts/tooling-contract.md` |
| 交付契约 | `specs/001-docs-engine/contracts/deploy-contract.md` |
| 编排数据模型 | `specs/002-content-orchestration/data-model.md` |
| 协作与写作约定 | `AGENTS.md` |
| 项目宪法 | `.specify/memory/constitution.md` |

## 6. 本地预览

```bash
npm run dev       # 本地开发服务器
npm run preview   # 预览构建产物
```
