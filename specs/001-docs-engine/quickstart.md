# Quickstart: 技术面试备考文档引擎（001-docs-engine）

本文件是**验收剧本**：每条场景给出前置、命令与期望结果。实现细节见
[plan.md](./plan.md)、[data-model.md](./data-model.md) 与 [contracts/](./contracts/)。

## 0. 环境与准备

```bash
cd docs-1
node -v            # 期望 v22.x
npm ci             # 依据 package-lock.json 精确安装
```

图解重建才需要 Archify 检出（日常构建不需要）：

```bash
git clone --depth 1 https://github.com/tt-a1i/archify .tools/archify
export ARCHIFY_DIR="$PWD/.tools/archify"
```

## S1 站点可构建、可预览

```bash
npm run build
npm run preview    # 监听 0.0.0.0:4173
```

**期望**：构建输出 `build complete`；产物包含 2 个领域、3 个入口页、8 个知识点页、1 个组件页、
7 张图解；下列路由全部 200：

```bash
for u in / /backend/ /backend/learn/ /backend/components/ \
         /backend/learn/concurrency/thread-basics /backend/components/safe-queue \
         /frontend/ /frontend/learn/engineering/vite-dev-and-build \
         /diagrams/gil-workflow.html; do
  printf '%-56s ' "$u"; curl -sS -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:4173$u"
done
```

## S2 内容契约门禁

```bash
npm run check:content          # 期望：错误 0 项
```

**负例**（验证门禁真的会红）：删掉任一知识点页的 `## 关键对比` 标题，再跑一次。

**期望**：退出码 1，输出 `❌ [V7] <文件>:<行> 缺必需小节：## 关键对比 → 修法：…`。恢复后再跑应为 0。

## S3 受控中文门禁

```bash
npm run check:zh               # 期望：硬违规不超过基线（退出码 0）
```

**负例**：在任一知识点页写一句含分号的长句（如「先建队列；再投任务」，长度超过 40 字）。

**期望**：退出码 1，报告 `semicolon` 与 `long-sentence` 规则、文件与行号。恢复后为 0。

## S4 零配置扩展（宪法 II / FR-010）

```bash
node scripts/new-content.mjs domain test-domain
node scripts/new-content.mjs knowledge quick-check --domain test-domain --knowledge-domain 01-basics
npm run build
git status --porcelain | grep -E 'config\.mts|plugins/|theme/'   # 期望：无输出
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/test-domain/
```

**期望**：新领域出现在顶部导航与侧边栏；其知识点页可访问；引擎与配置文件零改动。
验证后删除该夹具（或由 `assert-extensibility.mjs` 在临时目录完成，不污染仓库）。

## S5 图解可重建

```bash
ARCHIFY_DIR="$PWD/.tools/archify" bash scripts/gen-diagrams.sh
npm run build
```

**期望**：7 张图各自 `ok=true`；`docs/public/diagrams/*.html` 更新；构建通过；
被引用图解的页面正常渲染 iframe。

## S6 组件按生产级交付（宪法 VI / FR-041）

```bash
python3 -m pytest tests/ -q
```

**期望**：全部通过。负例：把组件源码里的哨兵投递循环改成只投一个，测试应失败。

## S7 双入口与双向链接（FR-037 / FR-042 / SC-012）

- 打开 `/backend/`：期望两张入口卡片（渐进式学习、组件查询）与各自计数。
- 打开 `/backend/learn/`：期望知识域卡片、`path` 分段标签、按序知识点列表与推荐起点。
- 打开 `/backend/components/`：期望组件卡片与按 `tags_index` 的标签索引。
- 打开 `/backend/learn/concurrency/queue-pipe`：底部「关联与复用」应显示依赖它的组件
  （进程安全队列）。
- 打开 `/backend/components/safe-queue`：右栏为引用方式；左栏为简介/知识点/图解/源码。

**机械判据**：`npm run check:content` 的 V11 断言入口页条目数等于实际页面数。

## S8 千页预算（宪法 VII / FR-040 / SC-009 / SC-013）

```bash
node scripts/check-budget.mjs --pages 1000
```

**期望**：解析与构建时长、导航数据体积均在 `contracts/engine-contract.md` §9 的预算内；
超预算时脚本给出具体超出的指标与数值。

## S9 CI 与部署（FR-026…FR-031 / SC-005）

```bash
git push origin main
```

**期望**：本仓 Actions 出现 Run；`build` 阶段日志含三条门禁的通过行与 `build complete`；
`deploy` 阶段完成后：

```bash
kubectl -n docs get deploy docs-1-docs -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
curl -sS -o /dev/null -w '%{http_code}\n' -H 'Host: docs1.minilab.uzibird.cn' http://192.168.2.203/health
```

DNS 生效后（前置见 `contracts/deploy-contract.md` §5）：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://docs1.minilab.uzibird.cn/
curl -sS https://docs1.minilab.uzibird.cn/backend/learn/concurrency/thread-basics | grep -c '多线程基础'
```

**期望**：镜像标签等于本次提交短 hash；`/health` 为 200；首页与知识点页 200；页面含本次提交内容。

## S10 跨领域类型契约（FR-015，示例内容延后）

在临时目录构造一份 `cross-domain/*.md`（`type: cross-component`，`depends_on` 含两个领域），
跑一次 `npm run build`，确认：

- 该页出现在「跨领域组件」分组；
- 顶部渲染「依赖汇聚」，按领域聚合依赖项；
- 双栏切分与组件页一致。

临时文件 MUST NOT 提交（本里程碑只交付契约，不交付示例内容）。

## 验收对照

| 场景 | 覆盖需求 |
|---|---|
| S1 | FR-006 / FR-007 / FR-016 |
| S2 | FR-034 / FR-017 |
| S3 | FR-022 / FR-023 |
| S4 | FR-009 / FR-010 |
| S5 | FR-018 / FR-019 / FR-020 |
| S6 | FR-041 / SC-016 |
| S7 | FR-037 / FR-038 / FR-042 / SC-012 |
| S8 | FR-040 / SC-009 / SC-013 |
| S9 | FR-026…FR-031 / SC-005 |
| S10 | FR-015 |
