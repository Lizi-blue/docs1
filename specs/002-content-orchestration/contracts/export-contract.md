# Contract: 技能导出契约（export）

适用对象：技能维护者与自检脚本。目标是「其他仓可独立使用判据」与「两份正文不可能悄悄漂移」
同时成立。

## 1. 源与锚点

| 项 | 约定 |
|---|---|
| 源文件 | `.dsh/skills/docs-authoring/SKILL.md` |
| 导出区 | `<!-- export:begin -->` 与 `<!-- export:end -->` 之间的正文（含九个章节） |
| 锚点约束 | 两个锚点 MUST 成对出现，`begin` 在 `end` 之前，且各自独占一行 |
| 锚点之外 | frontmatter 与版本行由导出脚本从源文件头部**原样带出**，放在导出物头部注释之后；它们不计入指纹，指纹只覆盖锚点之间的正文 |

## 2. 归一化（指纹计算前）

```text
1. 统一为 LF 换行
2. 去掉每行行尾空白
3. 去掉首尾空行
4. 末尾补一个换行
```

归一化的目的：避免换行风格与尾空白造成假警报。

## 3. 指纹

| 项 | 约定 |
|---|---|
| 算法 | `sha256`（`node:crypto`） |
| 取值 | 十六进制前 16 位，字段名 `body-sha256-16` |
| 计算对象 | 归一化后的导出区正文（不含头部注释） |

## 4. 导出物头部

导出物 = 头部注释 + 归一化正文。头部逐字如下（字段顺序固定）：

```markdown
<!--
exported-from: dev/docs-1
source-path: .dsh/skills/docs-authoring/SKILL.md
source-commit: <40 位十六进制提交 sha>
skill-version: <x.y.z>
body-sha256-16: <16 位十六进制>
exported-at: <ISO 8601，含时区>
do-not-edit: 本文件由 scripts/export-skill.mjs 生成，手改会被自检判错
-->
```

## 5. 落地与发布

| 步骤 | 约定 |
|---|---|
| 生成 | `node scripts/export-skill.mjs` → `build/skill-export/docs-authoring/SKILL.md`（`build/` 已忽略） |
| 发布 | 复制到 `dev/skill` 仓的 `skills/docs-authoring/SKILL.md` |
| 注册 | 在 `dev/skill` 的 `skills/index.tsv` 追加一行：`docs-authoring`、描述、`docs/docs-authoring`（与既有行同格式） |
| 发布时机 | 技能版本变更时。本仓 CI MUST NOT 自动推送到 `dev/skill`（跨仓写入需显式操作） |

## 6. 一致性校验（自检 S5）

```text
读取导出物头部 body-sha256-16
对当前源的导出区重新归一化并计算指纹
不一致 → 判错，提示「源已变更，请重新导出」
导出物不存在 → 跳过 S5（本地未导出属正常状态），并打印一行提示
```

### 6.1 `--export-path <file>`

| 项 | 约定 |
|---|---|
| 实现点 | `scripts/check-orchestration.mjs`（S5 的路径参数，唯一实现点） |
| 用法 | `npm run check:orchestration -- --export-path <file>` |
| 缺省值 | `build/skill-export/docs-authoring/SKILL.md` |
| 仓内相对路径 | 以仓库根为基准解析，MUST 落在仓内 |
| 仓外绝对路径 | 允许（用于校验已发布到 `dev/skill` 的副本） |
| 目标存在 | 读头部 `body-sha256-16`，按 §6 的比对流程执行 |
| 目标不存在（显式传入） | 退出码 `1`，提示 `❌ 导出物不存在：<file> → 修法：先运行 npm run export:skill` |
| 目标不存在（用缺省值） | 跳过 S5 并打印一行提示，退出码按其它规则项决定 |
| 参数缺值 | 退出码 `1`，打印用法提示 |

**边界**：仓外绝对路径只读。脚本 MUST NOT 写入、移动或改写目标文件。

## 7. 禁止项

- MUST NOT 手工编辑导出物（头部已声明）。
- MUST NOT 让导出区包含内容契约的取值清单（那会构成第二事实源，自检 S1 同时会拦）。
- MUST NOT 把导出物提交进本仓（它是跨仓发布产物，本仓只保留生成脚本与源）。
