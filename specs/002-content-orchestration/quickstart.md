# Quickstart: 内容编排与教学法技能（002-content-orchestration）

验收剧本。每条给出前置、命令与期望结果；设计细节见 [plan.md](./plan.md)、
[data-model.md](./data-model.md) 与 [contracts/](./contracts/skill-contract.md)。

## 计时口径

本节的用时按下列口径记录。执行者全程一人，不中途换手。

- 计时器用 `date +%s` 打点。记录起止时刻与秒数。
- SC-001 起点是打开 `.dsh/skills/docs-authoring/SKILL.md` 的瞬间。
- SC-001 终点是知识点页 `npm run check:content` 退出码为 0 的瞬间。
- SC-006 起点同上。终点是知识域含首讲通过门禁的瞬间。
- 夹具一律建在临时路径。验证后删除。不留残余文件。

## S0 前置

```bash
cd docs-1
node -v                                 # 期望 v22.x
grep -n "^\.dsh" .gitignore             # 期望只忽略 .dsh/skills/speckit-*
test -f .dsh/skills/docs-authoring/SKILL.md && echo "技能在位"
test -f ledger/orchestration-decisions.tsv && echo "台账在位"
```

**期望**：技能与台账均可入库（`git status` 能看到它们，未被忽略）。

## S1 技能可加载并按模板产出内容

1. 打开 `.dsh/skills/docs-authoring/SKILL.md`，确认九节齐全且顺序正确。
2. 按第 5 节模板，在临时夹具里新建一个知识点页与对应 `teach` 块条目。
3. 跑内容门禁。

```bash
npm run check:content
```

**期望**：夹具页通过校验（四要素齐全、登记双向完整）。删除夹具后回到基线。

## S2 四要素的机械判据会红

```bash
# 负例 1：删掉任一知识点页的 「### 常见误区」
# 负例 2：把某页面试追问链改成 2 条 <details>
npm run check:content
```

**期望**：退出码 1，输出 `❌ [V16] <文件>:<行> …`，明确列出缺失标题或「实际 2 条，需 3–5 条」。
恢复后归零。

## S3 登记块与页面双向完整

```bash
# 负例 1：删掉某知识域 teach.audience
# 负例 2：在 teach.lessons 留一条指向不存在 slug 的条目
npm run check:content
```

**期望**：V15 输出缺失字段；V17 输出「幽灵条目」与「未登记页面」两份清单。恢复后归零。

## S4 迭代台账与连续三次规则

```bash
# 在 ledger/orchestration-decisions.tsv 追加三条 decision=no-writeback、review=-
npm run check:orchestration
```

**期望**：S3 判错，提示「连续三次判定无需回写，缺少复核记录」。
补一条 `review=recheck:valid` 后归零。

## S5 导出一致性与指纹

```bash
node scripts/export-skill.mjs
head -12 build/skill-export/docs-authoring/SKILL.md      # 期望看到 exported-from 等字段
npm run check:orchestration                              # 期望 S5 通过
sed -i 's/。/./' build/skill-export/docs-authoring/SKILL.md   # 手改一个字符
npm run check:orchestration                              # 期望 S5 判错
```

**期望**：指纹一致时通过；任何手工改动都被判错，并提示重新导出。

## S6 技能自身健康检查

```bash
# 负例 1：把内容契约的字段清单粘进技能正文
# 负例 2：调换技能第 3 节与第 4 节顺序
npm run check:orchestration
```

**期望**：S1 列出疑似复制的片段位置；S2 列出错序章节。恢复后归零。

## S7 既有内容收口到零缺失

```bash
npm run check:content
```

**期望**：8 个知识点页（Python 并发 4 讲 + 前端工程化 4 讲）四要素齐全；
2 个知识域（`concurrency`、`engineering`）有 `teach` 块且 `lessons` 与实际页面双向一致；
输出中 `V15/V16/V17/V18` 的错误数为 0，且不保留该批内容的基线。

## S8 跨仓可用性

```bash
# 在 dev/skill 仓（或本地检出）中加载 skills/docs-authoring/SKILL.md
# 确认：无需打开本仓契约即可拿到判据、模板与自检命令
# 且该文件头部 body-sha256-16 与本仓源一致
```

**期望**：其他仓可独立使用判据；改判据只改本仓源，重新导出后指纹重新对齐；
`dev/skill/skills/index.tsv` 含 `docs-authoring` 一行。

## 验收对照

| 场景 | 覆盖需求 |
|---|---|
| S1 | FR-004、FR-013、SC-001 |
| S2 | FR-006、FR-007、FR-009、SC-009 |
| S3 | FR-025、SC-003 |
| S4 | FR-010、FR-012、SC-004 |
| S5 | FR-013、FR-015、SC-007、SC-010 |
| S6 | FR-014、FR-015、SC-005 |
| S7 | FR-024、SC-003、SC-006 |
| S8 | FR-013、SC-007 |
