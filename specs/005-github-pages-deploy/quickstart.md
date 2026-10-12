# Quickstart：GitHub Actions 双远端发布与 GitHub Pages 站点

可执行验收剧本。契约见 `contracts/`（流水线、基础路径、降级、双链路）；实体见 `data-model.md`。

## 前置

```bash
node -v            # ≥ 22
python3 -V         # 3.13
npm ci
```

用户侧前置（一次性）：

1. GitHub 仓库 → Settings → Pages → Source 选 **GitHub Actions**（或允许流水线自动开启）。
2. 确认 Gitea → GitHub 的镜像推送把主分支推到了 `Lizi-blue/docs1`。

## S0 双基础路径本地构建

```bash
npm run build                                  # 内网：根路径
DOCS1_BASE=/docs1/ npm run build               # 公网：子路径
```

期望：两次都构建成功；产物内链接前缀分别以 `/` 与 `/docs1/` 开头。

## S1 产物门禁

```bash
DOCS1_BASE=/docs1/ npm run build
npm run check:pages
```

期望：0 错。断言覆盖：站内链接带前缀、无未加前缀的站内根链接、无内网地址字符串、无外部资源、
`.nojekyll` 与深链兜底页存在。

## S2 门禁同源

```bash
for c in check:content check:zh check:component check:experience check:orchestration \
         test:component selftest:gates check:extensibility build check:responsive check:nav; do
  npm run $c >/dev/null 2>&1 && echo "OK  $c" || echo "FAIL $c"
done
```

期望：全部 OK。托管侧执行同一套命令（外加 `check:pages`）。

## S3 子路径深链与兜底页（本地）

```bash
DOCS1_BASE=/docs1/ npm run build
python3 -m http.server 4180 -d docs/.vitepress/dist >/dev/null 2>&1 &
curl -sS -o /dev/null -w 'home  %{http_code}\n' http://127.0.0.1:4180/
curl -sS -o /dev/null -w 'deep  %{http_code}\n' http://127.0.0.1:4180/backend/learn/concurrency/thread-basics.html
curl -sS -o /dev/null -w 'asset %{http_code}\n' http://127.0.0.1:4180/assets/$(ls docs/.vitepress/dist/assets | grep '\.css$' | head -1)
```

期望：首页与资源 200；无扩展名深链在本地静态服务下由兜底页接管（不是白屏）。

## S4 发布（公网）

推送主分支后观察 GitHub Actions：

```bash
git push origin main        # 由 Lead 执行
```

期望：运行成功；页面地址可打开；运行记录可见提交短哈希与页面地址。

## S5 线上抽查（至少 10 项）

| 项 | 期望 |
|---|---|
| 首页 | 200，样式正常 |
| 两个领域入口 | 200 |
| 一个知识点页 | 200，正文与图解正常 |
| 两个组件页（后端/前端） | 200，知识索引渲染 |
| 两张图解 HTML | 200，自包含渲染 |
| 站内搜索 | 返回非空结果 |
| 任一深链 | 可直接打开（兜底页生效） |

## S6 降级验证

1. 打开 Pages 上的任务控制台组件页；
2. 期望：出现「服务不可用」降级提示并说明原因与影响范围；
3. 期望：正文、知识索引、复用四件套完整；浏览器控制台无未捕获错误；
4. 期望：提交控件为禁用或提示态，且带文案。

## S7 失败演练

1. 临时删除某知识点页的必需小节 → 推送 → 期望：运行在门禁步骤失败，**Pages 不发布**，上一版本仍可访问；
2. 临时在内容里写入内网域名 → 构建后 `npm run check:pages` 期望判错并列出命中样本；
3. 在未开启 Pages 的仓库上运行 → 期望：失败信息指出需要开启的配置项。

## S8 双链路回归

```bash
curl -sS -o /dev/null -w 'internal home   %{http_code}\n' https://docs1.minilab.uzibird.cn/
curl -sS -o /dev/null -w 'internal health %{http_code}\n' https://docs1.minilab.uzibird.cn/health
curl -sS -o /dev/null -w 'pages home      %{http_code}\n' https://lizi-blue.github.io/docs1/
```

期望：三处均成功；两条运行记录对应同一提交；内网域名、健康检查与镜像标签规则与改动前一致。
