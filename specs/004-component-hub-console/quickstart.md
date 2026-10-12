# Quickstart：组件首发仓与前后端双端任务控制台

可执行验收剧本。每条给出命令与期望；不可机械化的体验项在 S6/S7 以人工步骤给出。
契约细节见 `contracts/component-page-contract.md`、`contracts/design-tokens-contract.md`、
`contracts/task-console-api.md`、`contracts/reuse-manifest.schema.json`；实体见 `data-model.md`。

## 前置

```bash
node -v            # ≥ 22
python3 -V         # 3.13
npm ci
npm run check:content && npm run check:zh && npm run build   # 基线三连应全绿
```

## S0 组件文档结构就位

```bash
ls docs/backend/components/01-safe-queue.md docs/backend/components/03-task-console.md
ls docs/frontend/components/01-task-console.md
ls reuse/task-console/manifest.json
```

期望：后端页（任务服务）与前端页（控制台）各一份，清单存在，两页互链。

## S1 方向纯净（FR-002 / SC-002）

```bash
npm run check:component
```

期望：0 错。抽检命令（可作为人工复核）：

```bash
grep -nE "\.vue|EventSource|document\.|window\." docs/backend/components/03-task-console.md   # 期望 0 命中
grep -nE "killpg|SIGTERM|/proc/|白名单" docs/frontend/components/01-task-console.md           # 期望 0 命中
```

例外：各自的「对应另一端」一节允许出现对方名词。

## S2 依赖知识索引可达（FR-003 / FR-004 / SC-001）

```bash
npm run check:component           # 校验 knowledge_index 链接命中、role 非空、outline 标「待补」
```

人工复核：从任一组件页出发，两次点击内到达每个依赖知识点；`outline` 知识域显示「待补」而非 404。

## S3 复用清单与实际文件一致（FR-005 / FR-006 / FR-007 / SC-003 / SC-004）

```bash
npm run check:component
python3 -m pytest tests/test_reuse_manifest.py -q
```

期望：清单里每个 `path` 都存在；`page` 与组件页互指；`verify.command` 可在目标项目直接执行。

## S4 空项目复用（10 分钟，SC-003）

按组件页「复用四件套」操作（以后端为例）：

1. 复制清单 `sides.backend.files` 列出的文件到新项目；
2. 按 `external_deps` 安装依赖（后端为「无第三方依赖」）；
3. 按 `adaptation` 修改工作区路径与端口；
4. 执行 `sides.backend.verify` 的命令。

期望：服务启动并返回健康检查 200；提交一个白名单任务后能看到实时输出。
前端同理（复制 `TaskConsole.vue` + 令牌子集，注册全局组件后挂载）。

## S5 令牌与体验静态断言（FR-010…FR-016 / SC-005 / SC-007）

```bash
npm run check:experience
```

期望：X1–X7 全绿（令牌类别齐全、深色覆盖、无原始色值、焦点环、状态类、对比度、响应式与滚动）。

## S6 键盘流程（人工，SC-006）

1. 打开组件页，按 Tab 依次聚焦：命令选择 → 参数输入 → 提交 → 取消；
2. 焦点环清晰可见，顺序与视觉顺序一致；
3. 用 Enter/Space 完成一次提交与一次取消；
4. 提交过程中提交按钮处于禁用/加载态，取消可用。

期望：全程不碰鼠标即可完成；无焦点丢失或跳到页面外。

## S7 视口、深色与朗读顺序（人工，SC-007）

1. 375 / 768 / 1280 三档宽度下查看知识点页与组件页：无横向溢出，日志面板在自身容器内滚动；
2. 切换深色模式：令牌生效，正文对比可读，组件与站点观感一致；
3. 用屏幕阅读器或朗读顺序检查：日志面板 `aria-live` 播报新增行，错误提示被立即播报。

## S8 全量门禁与上线（SC-008）

```bash
for c in check:content check:zh check:component check:experience check:orchestration \
         test:component selftest:gates check:extensibility build check:responsive check:nav; do
  npm run $c >/dev/null 2>&1 && echo "OK  $c" || echo "FAIL $c"
done
```

期望：全部 OK。随后推送并观察 CI：

```bash
git push origin main        # 由 Lead 执行；CI 构建 + 部署
curl -sS -o /dev/null -w '%{http_code}\n' https://docs1.minilab.uzibird.cn/backend/components/task-console
curl -sS -o /dev/null -w '%{http_code}\n' https://docs1.minilab.uzibird.cn/frontend/components/task-console
```

期望：两个端点均 200；后端页不再出现前端内容；经域名提交 `cp` 任务可看到实时输出。
