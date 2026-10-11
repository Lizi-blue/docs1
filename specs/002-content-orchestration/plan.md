# Implementation Plan: 内容编排与教学法技能（content-orchestration）

**Branch**: `002-content-orchestration` | **Date**: 2026-10-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-content-orchestration/spec.md`

**Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md)（v1.1.0，含原则 VIII 教学编排持续改进）

**Note**: 本文件由 `/speckit-plan` 生成。本特性是文档资产 + 三个小脚本，不新增应用、不新增依赖；
与 001（引擎）共用同一套解析层与门禁脚本。

## Summary

把「内容怎么编排、怎么讲、什么时候用哪种工具」从个人经验变成可执行资产：

1. 仓内一份可被 Agent 直接加载的编排技能（判据 + 模板 + 反例 + 自检入口 + 优先级声明）；
2. 每个知识域的编排登记随内容存放（目录级元数据的 `teach` 块），由内容机械校验核对；
3. 每讲四个教学要素（本讲要解决的问题、常见误区、面试追问链、下一讲衔接）有机械判据；
4. 每次内容迭代在独立台账留一条判定记录，连续三次「无需回写」触发复核；
5. 技能自带变更日志；跨仓形态由本仓导出，带版本与来源指纹，自检比对一致性；
6. 上线后一次收口既有 8 个知识点页与 2 个知识域，缺失数为 0。

## Technical Context

**Language/Version**: Markdown + YAML 1.2（技能正文、登记块）；Node.js 22.23.2（导出与自检脚本，
复用 001 的解析层）；Python 3.13（既有中文门禁，不改）

**Primary Dependencies**: 零新增。复用 `docs/.vitepress/plugins/doc-engine.ts`（`buildDocTree`）、
`docs/.vitepress/shared/links.ts`（`normalizeLink`）、`js-yaml`、`gray-matter`、`node:crypto`

**Storage**: 文件系统。技能 `SKILL.md`、技能变更日志 `CHANGELOG.md`、迭代台账 TSV、
知识域 `_meta.yml` 的 `teach` 块、导出物（仓库外或忽略目录）

**Testing**: 内容校验新增规则 V15–V18 的夹具负例（缺字段、缺四要素、链条目数越界、slug 不匹配）；
自检脚本 S1–S5；导出指纹比对（改一个字符即判错）；quickstart S1–S8 端到端剧本

**Target Platform**: 与 001 相同：CI 容器内 Node 22 + Python 3.13；读者侧浏览器不涉及本特性

**Project Type**: 内容规范 + 配套脚本（文档资产为主，脚本为辅），不新增可部署服务

**Performance Goals**: 自检在 1000 页规模下 ≤20 秒；导出与指纹比对 ≤2 秒；构建时长增幅 ≤5%

**Constraints**: 技能正文只放判据与指针，取值只存在 `contracts/content-contract.md`；
导出物 MUST NOT 手工编辑；台账 MUST 一行一次迭代且可机械解析；全部离线可跑

**Scale/Scope**: 判据需在 10 个领域、1000 个页面规模下仍可机械核对；本轮收口 8 页 + 2 个知识域

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 宪法条款 | 门禁问题 | 结论 | 判据 / 落点 |
|---|---|---|---|
| I 内容即事实源 | 技能是否复述了登记内容或契约取值？ | PASS | 技能只放判据与模板；登记随内容存在 `_meta.yml`；`contracts/skill-contract.md` 规定「取值零复制」，自检 S1 检出 |
| II 零配置扩展 | 登记块是否会拖慢新增内容？ | PASS（有前置改动） | 脚手架在建知识点页时自动在 `teach.lessons` 补条目骨架；作者仍 ≤3 步 |
| III 内容契约可执行 | 新增判据是否进机械门禁？ | PASS | 新增 V15–V18 进 `scripts/check-content.mjs`（fail-closed）；技能自身走独立自检 |
| IV 受控中文 | 技能与台账是否纳入中文门禁？ | PASS（有边界说明） | 技能正文按受控中文写作；台账是数据文件（不在 `docs/**`），不参与中文门禁，字段值用中文短句 |
| V 图解自包含 | 技能是否给出图型判据？ | PASS | 技能「工具选用」节含图型选择表、图注要求与 3 条反例 |
| VI 组件生产级 | 本特性是否触及组件交付？ | PASS | 不触及；技能给组件页模板，与 001 的 T024 一致 |
| VII 规模优先 | 判据在千页规模下是否仍可用？ | PASS | 判据均为脚本可核对的结构化条件，不依赖人工浏览 |
| VIII 教学编排持续改进 | 是否逐条落地原则 VIII？ | PASS | 技能落位、登记块、四要素、迭代台账、变更日志、跨仓导出逐条对应 FR-001…FR-025 |

**结论**：无违反项。三处技术取舍记入 Complexity Tracking，均有补偿措施。

## Project Structure

### Documentation (this feature)

```text
specs/002-content-orchestration/
├── plan.md              # 本文件
├── research.md          # Phase 0：8 项设计决策（含备选方案）
├── data-model.md        # Phase 1：技能/登记块/台账/导出物 四类实体与校验规则
├── quickstart.md        # Phase 1：S1–S8 端到端验收剧本
├── contracts/           # Phase 1：技能契约、台账契约、导出契约、校验契约 + 登记块 schema
│   ├── skill-contract.md
│   ├── ledger-contract.md
│   ├── export-contract.md
│   ├── check-contract.md
│   └── schemas/teach-block.schema.json
└── checklists/
    └── requirements.md  # /speckit-specify 与 /speckit-clarify 产出
```

### Source Code (repository root)

```text
.dsh/skills/docs-authoring/          # 编排技能（宪法 VIII 指定落位）
├── SKILL.md                         # 判据 + 模板 + 反例 + 自检命令 + 优先级声明
└── CHANGELOG.md                     # 技能自身变更日志（日期 / 改动 / 原因）

ledger/
└── orchestration-decisions.tsv      # 迭代台账：一行一次内容迭代（可机械解析）

scripts/
├── check-orchestration.mjs          # 独立自检入口（S1–S5）
├── export-skill.mjs                 # 导出跨仓技能 + 写入版本与来源指纹
└── check-content.mjs                # 既有内容门禁：新增 V15–V18（001 的 T006–T009 产出）

schemas/
├── dir-meta.schema.json             # 扩写：新增 teach 块（与 001 的契约同步）
└── page-frontmatter.schema.json     # 不变

docs/<domain>/learn/<NN-knowledge-domain>/_meta.yml   # 新增 teach 块（2 个既有知识域迁移）
docs/<domain>/learn/<NN-kd>/<NN-page>.md              # 8 个知识点页补四要素
```

**Structure Decision**: 技能放在项目技能目录（宪法 VIII 指定的 `.dsh/skills/docs-authoring/`）；
台账放在仓根 `ledger/`（与其它仓台账习惯一致，且不被内容门禁的 `docs/**` 范围误伤）；
导出物不进本仓（写到被忽略的 `build/skill-export/`，供复制到 `dev/skill`）。
选此结构的理由：文档资产与内容同仓，便于「技能 ↔ 内容」互相验证；脚本复用 001 的解析层，
不引入第二份目录扫描实现。

## 关键设计决策（细节见 research.md）

| 决策 | 结论 |
|---|---|
| 教学要素落位 | 三个新 H3：`### 本讲要解决的问题`（置于 `## TL;DR` 之前）、`### 常见误区`（置于 `### 面试追问链` 之前）、`### 下一讲衔接`（置于 `### 关联组件` 之前）；`### 面试追问链` 计为第四要素 |
| 登记块形态 | 知识域 `_meta.yml` 新增 `teach:` 块（audience / prerequisites / outcomes / path / lessons）；引擎按 `teach.path ?? path` 读路径（向后兼容），迁移 2 个既有知识域 |
| 台账格式 | TSV，表头固定，一行一次迭代；列：`date`、`iteration`、`scope`、`decision`、`reason`、`review` |
| 校验分工 | V15–V18 进内容门禁（fail-closed）；S1–S5 进独立自检（技能自身） |
| 导出一致性 | 源用 `<!-- export:begin -->` / `<!-- export:end -->` 锚点圈定；导出物头部写来源仓、源路径、源提交、技能版本、正文 sha256；比对前对正文做 LF 与尾空白归一化 |
| 忽略规则 | `.gitignore` 的 `.dsh/` 收窄为 `.dsh/skills/speckit-*`，使本技能可入库 |

## Phase 0 / Phase 1 输出

- Phase 0：[research.md](./research.md)（8 项决策，含备选方案）
- Phase 1：[data-model.md](./data-model.md)、[contracts/](./contracts/skill-contract.md)、
  [quickstart.md](./quickstart.md)

## Complexity Tracking

| 取舍 | 为何需要 | 更简单的替代方案为何不够 |
|---|---|---|
| 台账用 TSV 而非 Markdown 表 | 「连续三次无需回写」需要脚本统计；TSV 一行一记录，解析零歧义 | Markdown 表要写正则解析，列数一变就崩；只写提交信息无法审查 |
| 导出物带指纹并禁止手改 | 跨仓技能要能独立使用，又不能让判据出现两份正文 | 手写双份会漂移；只放指针则其他仓无法独立使用（违反 SC-007） |
| 登记块放进 `_meta.yml` | 登记与被描述的内容同处，评审与校验一次完成 | 集中台账离内容远，新增页面容易忘登记；技能文档内登记无法机械核对 |
