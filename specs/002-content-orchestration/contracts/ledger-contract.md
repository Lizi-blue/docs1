# Contract: 迭代台账契约（ledger）

适用对象：内容作者与自检脚本。台账是「持续总结改进」的证据链，MUST 一行一次迭代且可机械解析。

## 1. 文件与格式

| 项 | 约定 |
|---|---|
| 路径 | `ledger/orchestration-decisions.tsv` |
| 编码 | UTF-8，无 BOM |
| 分隔符 | 制表符（TAB），MUST NOT 使用逗号 |
| 首行 | 固定表头，逐字：`date	iteration	scope	decision	reason	review` |
| 行序 | 按时间顺序追加，最新在文件末尾 |
| 换行 | LF |

## 2. 列定义

| 列 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `date` | 日期 | 是 | `YYYY-MM-DD`，ISO 格式 |
| `iteration` | 字符串 | 是 | 特性编号或迭代标识（如 `002-content-orchestration`） |
| `scope` | 字符串 | 是 | 本次范围：领域 / 知识域 / 页面数，≤80 字 |
| `decision` | 枚举 | 是 | `writeback`（回写了技能）或 `no-writeback`（本次无需回写） |
| `reason` | 字符串 | 是 | ≤80 字中文短句；`writeback` 时允许写 `-` 表示「见技能变更日志」 |
| `review` | 枚举 | 是 | `-` / `recheck:valid`（复核后判据仍有效）/ `recheck:update`（复核后已更新判据） |

**字段内 MUST NOT 出现制表符或换行**。需要多句时用中文分号以外的分隔（逗号或句号），
避免与受控中文规则冲突。

## 3. 判定规则（自检 S3 实现）

```text
令 streak = 从表尾向前连续 decision == no-writeback 的条数
若 streak >= 3 且这 streak 条之后没有 review 以 recheck: 开头的记录：
    判错，理由「连续三次判定无需回写，缺少复核记录」
任一 review 以 recheck: 开头的记录出现：streak 清零
```

**边界**：

- 文件缺失：判错（台账是必备资产，MUST 入库）。
- 表头缺失或列数不符：判错，打印期望表头。
- `decision` 取值非法：判错，打印该行号与合法取值。
- 空行：允许出现在文件末尾，MUST NOT 出现在表头与数据之间。

## 4. 与技能变更日志的分工

| 资产 | 记什么 | 不记什么 |
|---|---|---|
| `ledger/orchestration-decisions.tsv` | 每次内容迭代的判定与复核 | 技能具体改了什么 |
| `.dsh/skills/docs-authoring/CHANGELOG.md` | 技能自身的改动（日期 / 改动 / 原因） | 内容迭代的判定 |

两者 MUST NOT 混排。`writeback` 的行与变更日志之间靠 `date` 与 `iteration` 对应，
MUST NOT 复制变更正文。

## 5. 首个条目

首个条目由本特性的实现任务写入，`iteration` 为 `002-content-orchestration`，
`decision` 为 `writeback`（技能首次落地），`review` 为 `-`。
