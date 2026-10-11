# Phase 1 Data Model: 内容编排与教学法技能（002-content-orchestration）

四类实体：**技能（skill）**、**登记块（teach block）**、**台账（ledger）**、**导出物（export）**。
全部是文件系统上的文本资产，无运行时存储、无数据库。

## E1 技能（skill）

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| `path` | string | 是 | 固定 `.dsh/skills/docs-authoring/SKILL.md` | 仓内技能位置（宪法 VIII） |
| `version` | semver | 是 | 位于正文首部；与 `CHANGELOG.md` 最新条目一致 | 技能自身版本，与宪法版本解耦 |
| `sections` | 固定九节 | 是 | 顺序不可变，见 R2 | 自检 S2 断言章节齐全与顺序 |
| `export_begin` / `export_end` | HTML 注释锚点 | 是 | 成对出现，且 `begin` 在 `end` 之前 | 圈定导出正文 |
| `pointers` | 链接列表 | 是 | 至少一条指向 `specs/001-docs-engine/contracts/content-contract.md` | 取值只在这里指向，不复制 |
| `tool_guidance` | 三小节 | 是 | 写作规则 / 交互图解（含图型表）/ 云架构静态图，各 ≥1 条反例 | 对应 FR-016…FR-019 |
| `judgements` | 四类判据 | 是 | 知识点拆分与合并 / 知识域划分 / 路径排法与长度 / 组件与知识点对应；每类 ≥1 正例 + 1 反例 | 对应 FR-002、FR-003 |

**校验**：S1（无取值复制）、S2（章节齐全有序）、S4（指针可达）。

### E1.1 技能变更日志条目（changelog entry）

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `date` | ISO 日期 | 是 | `YYYY-MM-DD` |
| `change` | string | 是 | 一句话，说明改了什么 |
| `reason` | string | 是 | 一句话，说明为什么改 |

存放于 `.dsh/skills/docs-authoring/CHANGELOG.md`，倒序排列（最新在上）。

## E2 登记块（teach block）

写在知识域目录级 `_meta.yml` 的 `teach` 键下。schema 见 `contracts/schemas/teach-block.schema.json`。

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| `audience` | string | 是 | 10–80 字 | 目标读者 |
| `prerequisites` | string[] | 是 | ≥1 条，非空字符串 | 先修（作者视角的知识前提） |
| `outcomes` | string[] | 是 | 1–5 条 | 学完能做什么 |
| `path` | PathStep[] | 是 | ≥1 段，每段含 `from` 与 `to` | 路径分段（替代顶层 `path`） |
| `lessons` | LessonGoal[] | 是 | 与知识点页双向完整 | 每讲教学目标 |

### E2.1 PathStep

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `from` | string | 是 | 页面 slug，可带或不带 `NN-` 前缀 |
| `to` | string | 是 | 同上 |
| `label` | string | 否 | ≤60 字 |

### E2.2 LessonGoal

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `slug` | string | 是 | 对应页面 slug（可带 `NN-` 前缀） |
| `goal` | string | 是 | 10–60 字，一句话说明这一讲要达成什么 |

**兼容规则**：引擎与校验读路径时按 `teach.path ?? path` 回退；迁移完成后顶层 `path` 删除。
**校验**：V15（字段齐全与类型）、V17（slug 双向完整）。

## E3 迭代台账（iteration ledger）

`ledger/orchestration-decisions.tsv`，制表符分隔，首行表头，其后按时间顺序追加。

| 列 | 类型 | 必填 | 取值 / 约束 |
|---|---|---|---|
| `date` | ISO 日期 | 是 | `YYYY-MM-DD` |
| `iteration` | string | 是 | 特性编号或迭代标识，如 `002-content-orchestration` |
| `scope` | string | 是 | 本次迭代涉及的范围（领域 / 知识域 / 页面数） |
| `decision` | enum | 是 | `writeback` / `no-writeback` |
| `reason` | string | 是 | 中文短句，≤80 字；`-` 仅允许与 `writeback` 同时出现时表示「见变更日志」 |
| `review` | enum | 是 | `-` / `recheck:valid` / `recheck:update` |

**状态机（判定规则）**：

```text
追加一条记录
  ├─ decision = writeback      → 连续 no-writeback 计数清零
  └─ decision = no-writeback   → 计数 +1
        └─ 计数达到 3 且其后无 review=recheck:* → 判错，要求补复核记录
补一条 review=recheck:valid|update → 计数清零
```

**校验**：S3（格式合法 + 上面的状态机）。

## E4 导出物（export artifact）

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `exported-from` | string | 是 | `dev/docs-1` |
| `source-path` | string | 是 | `.dsh/skills/docs-authoring/SKILL.md` |
| `source-commit` | string | 是 | 40 位十六进制 |
| `skill-version` | semver | 是 | 与源正文首部版本一致 |
| `body-sha256-16` | string | 是 | 归一化正文的 sha256 前 16 位 |
| `exported-at` | ISO 时间 | 是 | 导出时刻 |
| `do-not-edit` | string | 是 | 固定提示语 |

**归一化**：LF 换行、去行尾空白、去首尾空行、正文末尾补一个换行。
**落地位置**：`build/skill-export/docs-authoring/SKILL.md`（已忽略），复制到 `dev/skill` 仓
`skills/docs-authoring/SKILL.md`。
**校验**：S5（指纹比对，不一致即判错）。

## E5 教学要素（teaching element）

不单独存储，是知识点页正文中的四个小节。

| 要素 | 标题（逐字） | 位置 | 机械判据 |
|---|---|---|---|
| 本讲要解决的问题 | `### 本讲要解决的问题` | `## TL;DR` 之前 | 存在 + 该标题下 ≥1 行实质文本（V18） |
| 常见误区 | `### 常见误区` | `### 面试追问链` 之前 | 存在 + ≥1 条列表项（V18） |
| 面试追问链 | `### 面试追问链` | 第四段内 | 存在 + 该节内 `<details>` 条目 3–5 条（V16） |
| 下一讲衔接 | `### 下一讲衔接` | `### 关联组件` 之前 | 存在 + 含至少一个页面链接（V18） |

## 关系

```text
技能（SKILL.md）1 ── 1 变更日志（CHANGELOG.md）
技能 1 ── 1 导出物（带指纹）
技能 ── 指针 ──> 内容契约（取值唯一来源）
知识域 1 ── 1 登记块（teach）1 ── n LessonGoal ── 1 知识点页
知识点页 1 ── 1 教学要素组（四小节）
内容迭代 1 ── 1 台账记录 ── 触发 ──> 复核记录（连续三次无需回写时）
```

## 校验规则汇总

| 编号 | 归属 | 规则 | 违反后果 |
|---|---|---|---|
| V15 | 内容门禁 | `teach` 块存在、五字段齐全、类型正确 | 判错（文件 + 行 + 修法） |
| V16 | 内容门禁 | 四要素小节存在；追问链 `<details>` 3–5 条 | 判错 |
| V17 | 内容门禁 | `lessons[].slug` 与知识点页双向完整 | 判错（列出幽灵条目与未登记页面） |
| V18 | 内容门禁 | 各要素下有实质内容（非标题占位；衔接含链接） | 判错 |
| S1 | 独立自检 | 技能内无取值复制 | 判错并列出疑似复制的片段 |
| S2 | 独立自检 | 技能九节齐全且顺序正确 | 判错 |
| S3 | 独立自检 | 台账格式 + 连续三次规则 | 判错 |
| S4 | 独立自检 | 技能到契约的指针可达 | 判错 |
| S5 | 独立自检 | 导出物指纹与源一致 | 判错（提示重新导出） |
