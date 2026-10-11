# Contract: 交付契约（CI 与线上形态）

适用对象：接入 CI 的维护者、运维评审者。与 `ci` 中心仓的能力口径冲突时，以 ci 仓
`docs/CAPABILITIES.md` 与脚本为准。

## 1. 仓内 `ci.env`（唯一能力开关文件）

| 变量 | 取值 | 理由 |
|---|---|---|
| `PROJECT_NAME` | `docs-1` | 与仓名一致，供 ci 账务与命名 |
| `REPO_OWNER` / `REPO_NAME` | `dev` / `docs-1` | clone 来源 |
| `IMAGE_NAME` | `dev/docs-1-docs` | 静态站镜像，与文档仓命名习惯一致 |
| `DOCKERFILE_PATH` / `CONTEXT_PATH` | `Dockerfile` / `.` | 构建入口 |
| `MANIFEST_DIR` | `deploy` | 业务自带清单唯一生效目录 |
| `DEPLOY_TO_K8S` | `true` | 需要部署 |
| `K8S_NAMESPACE` | `docs` | 与既有文档站 `dev-roadmap` 同命名空间 |
| `DEPLOYMENT_NAME` | `docs-1-docs` | 工作负载名 |
| `INGRESS_HOST` | `docs1.minilab.uzibird.cn` | 用户指定域名（不含连字符，符合 OpenWrt DNS 限制） |
| `CONTAINER_PORT` | `80` | Caddy 监听端口 |
| `ROLLOUT_WAIT` | `true` | 部署后等待就绪 |
| `DB_ENABLED` | `false` | 静态站无数据库 |
| `CONF_ENABLED` | `false` | 无配置中心 |
| `IAM_REPORT` | `false`（或省略） | 无鉴权接口，不上报权限 |
| `INSTALL_CMD` / `TEST_CMD` | 不设 | 依赖安装与门禁都在镜像构建内完成（runner 镜像只有 Python 3.13，无 Node） |

**MUST NOT**：写 `IMAGE_TAG`（由 ci 按分支/tag 派生）；把凭据写进 `ci.env`（走组织级 Secrets）。

## 2. `Dockerfile` 契约

```text
阶段 1  build   ：node:22-alpine + apk add python3
                  → npm ci（--no-audit --no-fund）
                  → npm run check:content      # 内容契约，失败即失败
                  → npm run check:zh           # 受控中文，失败即失败
                  → python3 -m pytest tests/ -q   # 组件自测
                  → npm run build              # 站点构建，产物 docs/.vitepress/dist
阶段 2  runtime ：caddy:2-alpine
                  → 拷贝阶段 1 的 dist 到 /usr/share/caddy
                  → 拷贝 Caddyfile
                  → EXPOSE 80 + HEALTHCHECK 打 /health
```

**约束**：镜像 MUST NOT 含 `node_modules`、源码、图解源 JSON；运行时不启动 Node 进程。

## 3. `Caddyfile` 契约

```text
:80 {
  root * /usr/share/caddy
  file_server
  try_files {path} {path}.html {path}/index.html /index.html
  respond /health 200
}
```

- `try_files` 是 `cleanUrls` 生效的必要条件（我们所有页面 URL 都不带 `.html`）。
- `/health` MUST 返回 200，且 MUST NOT 依赖任何后端。

## 4. `deploy/` 清单契约

| 文件 | 作用 | 消费变量 |
|---|---|---|
| `deployment.yaml` | 单副本；`/health` 就绪与存活探针；`requests 20m/32Mi`、`limits 200m/128Mi`；`APP_VERSION` 环境变量 | `${DEPLOYMENT_NAME}` `${K8S_NAMESPACE}` `${IMAGE_FULL}` `${CONTAINER_PORT}` `${APP_VERSION}` |
| `service.yaml` | ClusterIP:80 → 容器端口 | `${DEPLOYMENT_NAME}` `${K8S_NAMESPACE}` `${CONTAINER_PORT}` |
| `ingress.yaml` | `docs1.minilab.uzibird.cn` → Service:80；TLS 由 Traefik 通配符证书按 SNI 下发 | `${INGRESS_HOST}` `${DEPLOYMENT_NAME}` `${K8S_NAMESPACE}` |

清单 MUST 使用 `${VAR}` 占位并由 ci 渲染；MUST NOT 在清单里写死镜像标签或命名空间。

## 5. 外部前置（仓库外，需要人工/用户侧完成）

| 前置 | 现状（2026-10-11 实测） | 责任方 | 验证方式 |
|---|---|---|---|
| DNS A 记录 `docs1.minilab.uzibird.cn` → `192.168.2.203` | **不存在**（公网 223.5.5.5 与内网均无记录；`docs.minilab.uzibird.cn` 正常，说明是逐条记录而非通配符） | 用户侧（阿里云 DNS + 内网 OpenWrt） | `dig +short @223.5.5.5 docs1.minilab.uzibird.cn` 返回 192.168.2.203 |
| TLS 证书覆盖该域名 | cert 服务按 `a.b.c` 派生 `*.b.c`，登记后应自动覆盖 | 平台已有能力 | `curl -sSI https://docs1.minilab.uzibird.cn/ \| head -1` |
| ci 仓"协作所有者"含 `dev` | 平台既有配置 | 平台 | 推送后本仓 Actions 出现 Run |
| 组织级 Secrets（`REPO_*`、`REGISTRY_*`、`KUBECONFIG`、`CI_REPO_TOKEN`） | 平台既有配置 | 平台 | 构建与部署阶段不因缺凭据判红 |

**域名未生效时的等价验收**：用带 `Host` 头的请求验证路由与内容。

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -H 'Host: docs1.minilab.uzibird.cn' http://192.168.2.203/
```

## 6. 触发与发布行为

| 触发 | 镜像标签 | 部署目标 |
|---|---|---|
| push `main` | 短 commit hash | 命名空间 `docs` |
| push `dev` | 短 commit hash | 仅构建，不部署（`DEPLOY_BRANCHES` 默认 `master main`） |
| tag `vX.Y.Z` | 版本号 + `latest` | release 逻辑（生产命名空间） |
| `workflow_dispatch` 且 `deploy=true` | 短 hash | 强制部署 |

## 7. 验收证据（缺一不可）

1. 构建日志里三条门禁各自的通过行（`check:content` / `check:zh` / `pytest`）与 `build complete`。
2. 部署后 `kubectl -n docs get deploy docs-1-docs -o jsonpath='{.spec.template.spec.containers[0].image}'`
   的镜像标签等于本次提交的短 hash。
3. `/health` 返回 200。
4. 首页与一个知识点页返回 200，且页面 HTML 含本次提交的内容标记（例如新页面的标题）。
5. 图解 iframe 资源返回 200（`/diagrams/<name>.html`）。

## 8. 回滚

```bash
kubectl -n docs rollout undo deploy/docs-1-docs
```

静态站无状态、无数据迁移，回滚 MUST NOT 需要额外步骤。

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| runner 镜像无 Node，`TEST_CMD` 跑不了前端工具链 | 全部门禁放进镜像构建阶段；`ci.env` 不设 `TEST_CMD` |
| DNS 未就绪导致验收卡住 | 用 `Host` 头等价验证，并把 DNS 登记列为外部前置 |
| 镜像体积随图解增长 | 单图 ≤1.5 MB、站点资源总量 ≤20 MB，由预算检查断言 |
| 构建时长随页面数增长 | 千页夹具测量（T08），超预算告警 |
