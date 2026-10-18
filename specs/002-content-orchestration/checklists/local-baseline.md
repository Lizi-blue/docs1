# 本地验收证据（001 + 002）

> 每次验收把命令与真实输出摘要追加到本文件。禁止只写结论不写命令。

## 环境

| 项 | 值 |
|---|---|
| 仓库 | `/root/docs-1`（`dev/docs-1`，分支 `main`） |
| Node | v22.23.2（`check:content` 走 `--experimental-strip-types` 直载引擎） |
| Python | 3.13（`ste-lint-zh.py` 仅标准库） |
| 预览 | `npm run preview` → `0.0.0.0:4173`（容器内回环；仓外访问见 deploy 契约） |

## 提交轨迹

| 提交 | 内容 |
|---|---|
| `f44820b` | 引擎骨架 + 7 张 Archify 图解 + 两个方向示例内容（WIP 基线） |
| `0969beb` | 门禁地基：schemas 三份 + `check-content.mjs`（V1–V18）+ 忽略规则收窄 + 脚本别名 |
| `f079597` | 内容编排技能 + 自检 S1–S7 + 跨仓导出 + 迭代台账 |
| 本次收口 | 中文门禁封装、内容收口、CI 与交付物 |

## 门禁实测（本次收口，2026-10-11）

| 命令 | 结果 | 证据 |
|---|---|---|
| `npm run check:content` | **错误 0 项 / 警告 0 项** | V1–V18 全过；含 2 个知识域 `teach` 块、8 页四要素、9 页链接与图解 |
| `npm run check:zh` | **硬违规 0 处**（baseline 0） | 12872 字，13 条建议类提示；遮蔽四类代码型内容后归零 |
| `npm run check:orchestration` | **S1–S7 通过，警告 0 条** | 含 S3 连续三次、S6 版本一致、S7 基线单调 |
| `npm run test:component` | 1 passed / 3 skipped | 跳过原因：本容器沙箱禁止 `sem_open`；CI 镜像内会真实执行 |
| `npm run build` | **build complete** | 24 个页面与资源，含 7 张图解 |

### 路由冒烟（`vitepress preview`）

| 路由 | 状态 |
|---|---|
| `/`、`/backend/`、`/backend/learn/`、`/backend/components/` | 200 |
| `/backend/learn/concurrency/thread-basics` | 200 |
| `/backend/components/safe-queue`（组件页改名后 URL 不变） | 200 |
| `/frontend/learn/engineering/vite-dev-and-build` | 200 |
| `/diagrams/gil-workflow.html`、`/diagrams/queue-handshake.html` | 200 |

## 本轮修复的真实缺陷

| 缺陷 | 发现方式 | 处置 |
|---|---|---|
| 两页写成 `<ApiTable ::items=…>`（多一个冒号）→ 组件静默不渲染 | 中文门禁遮蔽规则未命中，暴露异常行 | 修正为 `:items`；预览确认 3 张参数表恢复渲染 |
| `check-content` 的 V17 用错知识域路径（`learn/<kd>` 而非 `<domain>/learn/<kd>`）→ 8 页全判「幽灵条目」 | 门禁自检报 9 项 V17 | 改用 `parseSegment` 从目录解析领域与知识域，再按模型匹配 |
| `npm run check:zh` 把目录传给上游脚本 → `Is a directory` 退出码 2 | 队友实测 | 改为封装 `scripts/lint-zh.mjs` 按文件清单调用 |
| 上游脚本把载荷代码、`TL;DR`、HTML 实体、契约强制标题当散文 → 69 处假阳性 | 按规则分布统计 | 封装遮蔽四类；基线 69 → **0** |
| 组件自测里 `dataclass` 报 AttributeError | 首次运行 | 执行前把模块注册进 `sys.modules` |

## 基线变更记录

| 时间 | 基线 | 理由 |
|---|---|---|
| 首次登记 | 69 | 未遮蔽代码型内容时的实测值 |
| 本次 | **0** | 遮蔽四类假阳性后真实硬违规为 0；台账已记 `baseline:0`，只减不增 |

## 待外部条件完成的验收

| 项 | 依赖 |
|---|---|
| 组件跨进程用例真实执行 | CI 镜像（Docker 内 `/dev/shm` 可用） |
| `<internal-host>` 访问 | 用户侧添加 A 记录（阿里云 + OpenWrt），见 deploy 契约 §5 |
| 流水线首次 Run 与线上内容断言 | 推送后由 `ci` 模板执行，见 deploy 契约 §7 |

## 002 验证与取证轮（T037 / T050–T057 / T059，2026-10-11）

执行者 verify-002。夹具建在临时路径。验证后删除。本轮无夹具入库。

### T037 追问链递进抽查（SC-009）

抽 3 页。逐条核对「后一问依赖前一问的结论」。

| 页面 | 条目数 | 行号 | 逐条递进判断 |
|---|---|---|---|
| `docs/backend/learn/01-concurrency/01-thread-basics.md` | 4 | 164–192（Q1 167、Q2 174、Q3 181、Q4 188） | 3/4 强。Q1→Q2 强，Q2 以「既然不能靠 daemon 收尾」承接。Q2→Q3 中，由收尾转向并发度，靠同一 Demo 的 `WORKERS=4` 承接。Q3→Q4 强，Q4 以「既然并发数有上限」承接。 |
| `docs/backend/learn/01-concurrency/03-queue-pipe.md` | 3 | 153–177（Q1 156、Q2 163、Q3 170） | 3/3 强。Q2 以「哨兵退出之后」承接 Q1。Q3 的「这些约定」复指前两问。 |
| `docs/frontend/learn/01-engineering/04-project-structure.md` | 4 | 140–168（Q1 143、Q2 150、Q3 157、Q4 164） | 3/4 强。Q1→Q2 强，Q2 以「入口定好之后」承接。Q2→Q3 强，Q3 以「资源放好之后」承接。Q3→Q4 弱，属并列式，缺连接词。 |

命令：

```bash
awk '/^### 面试追问链/,/^### 下一讲衔接/' <页面> | grep -c '<details>'
```

结论：条目数 3–5 全部命中。递进 10/11 处成立。1 处偏弱（`04-project-structure` Q3→Q4）。
该项属人工判据，弱衔接不判错。修法留待下一轮补连接词。

### T050 图解抽查 5 张（SC-008）

图型取 `diagrams/src/*.json` 的 `diagram_type`。图注取页面的 `DiagramFrame title`（渲染为 `figcaption`）。

| 图 | 图型 | 图回答的问题 | 页面与行号 | 图注 | 判定 |
|---|---|---|---|---|---|
| `gil-workflow.html` | sequence | 谁调用谁、顺序如何 | `01-thread-basics.md` 41–45 | GIL 与线程调度（Archify 交互图） | 一致 |
| `process-model.html` | architecture | 有什么组件、边界在哪 | `02-process-basics.md` 41–45 | 线程与进程的内存模型（Archify 交互图） | 一致 |
| `queue-handshake.html` | sequence | 谁调用谁、顺序如何 | `03-queue-pipe.md` 42–46 | 生产者消费者握手与哨兵（Archify 交互图） | 一致 |
| `spa-vs-bundler.html` | architecture | 有什么组件、边界在哪 | `01-single-html-entry.md` 38–40 | 单页入口与打包入口的差别（Archify 交互图） | 一致 |
| `vite-dev-vs-build.html` | architecture | 有什么组件、边界在哪 | `03-vite-dev-and-build.md` 40–42 | 开发态按需编译与生产态打包（Archify 交互图） | 一致 |

命令与输出：

```bash
python3 -c "import json;print(json.load(open('diagrams/src/<name>.json'))['diagram_type'])"
# 上面 5 张依次为 sequence / architecture / sequence / architecture / architecture
ls -l docs/public/diagrams/*.html | awk '{printf "%s %.2fMB\n", $9, $5/1048576}'
# 7 张全部 0.72–0.73 MB
grep -cE '(src|href)="https?://' docs/public/diagrams/*.html
# 7 张全部 0
```

与 001 契约对齐：

- `content-contract.md` §4：`## 原理图解` MUST 含一个 `DiagramFrame`。5 张落在 `## 原理图解` 或 `### 数据流图解`。V10 通过。
- `engine-contract.md` §7：`DiagramFrame` 在全局组件清单内。§9：单图 ≤1.5 MB，实测 0.72–0.73 MB。§3：图 src 用干净 URL，产物在 `docs/public/diagrams/`。
- 图型表：`engine-contract.md` 与 `content-contract.md` §4 都未定义图型枚举。技能表属新增判据，不冲突。
- 观察：仓内 7 张图只用到 architecture 与 sequence。dataflow、lifecycle、workflow 暂无实例。

图注口径说明：图注是主题短语。页面在 `DiagramFrame` 之前用一句话点明该图回答的问题（见各页 `## 原理图解` 首句）。
按 `skill-contract.md` §6.2 的「图注写明问题」，建议下一轮把设问写进 `title`。

### T051 技能第 6 节命令核验

命令从 `SKILL.md` 抽出（L157、L161、L229–L233、L245）。逐条真跑。

| 命令 | 输出摘要 | 退出码 |
|---|---|---|
| `npm run check:content` | 错误 0 项 / 警告 0 项 | 0 |
| `npm run check:zh` | 共 13 处发现（硬违规 0，baseline 0），12924 字 | 0 |
| `npm run check:orchestration` | ✅ 独立自检通过（S1–S7），警告 0 条 | 0 |
| `npm run export:skill` | ✅ 已导出，版本 1.0.0，指纹 0b3f41e4aeb00272 | 0 |
| `npm run build` | build complete in 5.53s | 0 |
| `node scripts/lint-zh.mjs --baseline 0 --disable passive-voice` | 共 2 处发现（硬违规 0） | 0 |

核对结论：

- 第 6 节说 `check:zh` 覆盖 `docs/**` 与本技能正文。实测输出逐文件列出两者，一致。
- 第 6 节说基线改动写台账 `baseline:<N>`。台账第 4 行即 `baseline:0`，S7 读它，一致。
- `--disable <规则>` 真跑可用。停用理由写进提交信息由 `AGENTS.md` §1 约定。
- 第 6 节的指针 `content-contract.md` §7 存在，含受控中文阈值。

### T052 降级演练

夹具领域 `docs/zzfix/`。图解 `docs/public/diagrams/zzfix-handmade.html`，内容为内联手写 SVG。

命令与输出：

```bash
node scripts/new-content.mjs domain zzfix
node scripts/new-content.mjs knowledge-domain kd --domain zzfix
node scripts/new-content.mjs knowledge demo --domain zzfix --knowledge-domain 01-kd
# 按模板填入 teach 五字段与正文，图解指向手写 HTML
npm run check:content
# 错误 0 项 / 警告 0 项        exit=0
grep -cE '(src|href)="https?://' docs/public/diagrams/zzfix-handmade.html
# 0（自包含）
rm -rf docs/zzfix docs/public/diagrams/zzfix-handmade.html
npm run check:content
# 错误 0 项 / 警告 0 项        exit=0
```

台账第 5 行记 `no-writeback`。reason 写明降级原因：无 Archify 环境。
技能第 6 节已有「手写自包含 HTML」的降级路径，故未改技能。

### T054 quickstart S0–S8

计时口径见 [quickstart.md](../quickstart.md) 的「计时口径」小节。逐条如下。

**S0 前置**

```bash
node -v                      # v22.23.2
grep -n "^\.dsh" .gitignore  # 11:.dsh/skills/speckit-*
test -f .dsh/skills/docs-authoring/SKILL.md && echo "技能在位"   # 技能在位
test -f ledger/orchestration-decisions.tsv && echo "台账在位"    # 台账在位
git check-ignore -v .dsh/skills/docs-authoring/SKILL.md          # exit=1，未被忽略
git ls-files --error-unmatch .dsh/skills/docs-authoring/SKILL.md ledger/orchestration-decisions.tsv   # exit=0，已跟踪
```

结论：技能与台账均在位、可入库。

**S1 技能可加载并按模板产出内容**

见 T052 夹具与本节计时。夹具页过门禁，撤回后回到基线 `错误 0 项 / 警告 0 项`。

**S2 四要素机械判据会红**

```text
# 负例1：删掉 ### 常见误区
❌ [V16] docs/zzfix/learn/01-kd/01-demo.md:1 缺教学要素：### 常见误区 → 修法：按 skill 的「每讲教学结构」补该小节
错误 1 项 / 警告 0 项        exit=1

# 负例2：追问链改成 2 条
❌ [V16] docs/zzfix/learn/01-kd/01-demo.md:1 追问链条目数 2 条 → 修法：保持在 3–5 条，并让后一问依赖前一问
错误 1 项 / 警告 0 项        exit=1

# 恢复后
错误 0 项 / 警告 0 项        exit=0
```

**S3 登记块与页面双向完整**

```text
# 负例1：删掉 teach.audience
❌ [V15] docs/zzfix/learn/01-kd/_meta.yml teach 块缺字段或类型不符：audience → 修法：按 data-model.md E2 的约束补齐
错误 1 项 / 警告 0 项        exit=1

# 负例2：lessons 留一条幽灵 slug
❌ [V17] docs/zzfix/learn/01-kd/_meta.yml lessons 指向不存在的页面：ghost → 修法：删除幽灵条目或补页面
❌ [V17] docs/zzfix/learn/01-kd/_meta.yml 页面未登记进 lessons：demo → 修法：在 teach.lessons 补一条 slug 与 goal
错误 2 项 / 警告 0 项        exit=1

# 恢复后
错误 0 项 / 警告 0 项        exit=0
```

**S4 迭代台账与连续三次规则**

```text
# 追加三条 no-writeback、review=- 后
❌ [S3] ledger/orchestration-decisions.tsv:4 连续 4 次判定无需回写，缺少复核记录（第 4–7 行） → 修法：补一条 review=recheck:valid 或 recheck:update 的记录
❌ 独立自检未通过，错误 1 条，警告 0 条        exit=1

# 补复核记录后
✅ 独立自检通过（S1–S7），警告 0 条        exit=0

# 撤回夹具行后
✅ 独立自检通过（S1–S7），警告 0 条        exit=0
```

**S5 导出一致性与指纹**

```text
$ npm run export:skill
✅ 已导出 build/skill-export/docs-authoring/SKILL.md
   版本 1.0.0，指纹 0b3f41e4aeb00272，提交 520e42c56e78

$ head -8 build/skill-export/docs-authoring/SKILL.md
exported-from: dev/docs-1
source-path: .dsh/skills/docs-authoring/SKILL.md
source-commit: 520e42c56e7831a9056d0909433f2b2ee868a9c1
skill-version: 1.0.0
body-sha256-16: 0b3f41e4aeb00272
exported-at: 2026-10-11T22:42:18+08:00
do-not-edit: 本文件由 scripts/export-skill.mjs 生成，手改会被自检判错

$ npm run check:orchestration
✅ 独立自检通过（S1–S7），警告 0 条        exit=0

$ sed -i 's/。/./' build/skill-export/docs-authoring/SKILL.md
$ npm run check:orchestration
❌ [S5] build/skill-export/docs-authoring/SKILL.md 导出物正文与头部指纹不符：头部 0b3f41e4aeb00272，正文 234bd8c44c940efa → 修法：导出物禁止手改，请重新导出
❌ 独立自检未通过，错误 1 条，警告 0 条        exit=1

$ npm run export:skill && npm run check:orchestration
✅ 独立自检通过（S1–S7），警告 0 条        exit=0
```

**S6 技能自身健康检查**

```text
# 负例1：把内容契约字段清单粘进技能正文
❌ [S1] .dsh/skills/docs-authoring/SKILL.md:271 技能正文成组出现 4 个内容契约字段名（第 271 行） → 修法：删掉字段清单，改为指向 content-contract.md 的指针

# 负例2：调换技能第 3 节与第 4 节顺序
❌ [S2] .dsh/skills/docs-authoring/SKILL.md:10 技能章节顺序有误：## 编排判据 → ## 每讲教学结构 → 修法：按 skill-contract.md §2 固定顺序排列

# 恢复后
✅ 独立自检通过（S1–S7），警告 0 条        exit=0
```

**S7 既有内容收口到零缺失**

```bash
npm run check:content
# 错误 0 项 / 警告 0 项        exit=0
```

V15/V16/V17/V18 错误数均为 0。8 个知识点页四要素齐备。
2 个知识域（`concurrency`、`engineering`）有 `teach` 块，`lessons` 双向一致。未保留该批内容基线。

说明：22:44 复跑时出现 3 项 `cross-domain/*` 错误。该文件由并发队友 verify-001 在建（22:43 创建）。
与本任务夹具无关。用 `grep -c zz` 核对，本任务夹具相关行数为 0。
收尾复跑（22:48）该批错误已修复，`check:content` 回到 0 错 0 警。

**S8 跨仓可用性**

```bash
head -8 build/skill-export/docs-authoring/SKILL.md      # 七字段头齐全
grep -c "specs/001-docs-engine/contracts/content-contract.md\|specs/002-content-orchestration" build/skill-export/docs-authoring/SKILL.md
# 9
node scripts/check-orchestration.mjs --export-path /tmp/verify002/published-copy.md
# ✅ 独立自检通过（S1–S7），警告 0 条        exit=0
sed -i 's/。/./' /tmp/verify002/published-copy.md
node scripts/check-orchestration.mjs --export-path /tmp/verify002/published-copy.md
# ❌ [S5] ... 导出物正文与头部指纹不符 → 修法：导出物禁止手改，请重新导出
grep -c docs-authoring /root/skill/skills/index.tsv     # 0
ls /root/skill/skills/docs-authoring                    # No such file or directory
```

本仓侧：导出物自包含，含 9 处仓内指针，`--export-path` 可校验仓外副本。
跨仓侧：`/root/skill` 检出内无 `docs-authoring`。T047/T048 未完成，S8 只完成本仓侧。

#### T054 计时（SC-001 / SC-006）

| 指标 | 起 | 止 | 用时 | 上限 | 判定 |
|---|---|---|---|---|---|
| SC-001 知识点页过门禁 | 22:44:15 | 22:44:35 | 20 秒 | 30 分钟 | 通过（作上界） |
| SC-006 知识域含首讲过门禁 | 22:44:15 | 22:44:35 | 20 秒 | 60 分钟 | 通过（作上界） |

打点命令：

```bash
T0=$(date +%s)   # 22:44:15，打开技能 §5 模板
node scripts/new-content.mjs domain zztime                               # +0s
node scripts/new-content.mjs knowledge-domain timekd --domain zztime     # +1s
node scripts/new-content.mjs knowledge first --domain zztime --knowledge-domain 01-timekd
# 按模板填值：teach 四处字段与图解 src
npm run check:content   # 22:44:35，夹具相关错误 0
```

限定说明：执行者是本会话 Agent，不是「未读过本仓历史的作者」。20 秒只作机械路径上界。
人工判读耗时另见 T055。夹具已删除。

### T055 评审取证（SC-002）

抽 2 页。判据取 `SKILL.md` §4 教学结构表（L82–L87）与 §3 编排判据（L62–L76）。

| 页面 | 判据定位 | 结论定位（页面行号） | 结论 | 用时 |
|---|---|---|---|---|
| `docs/frontend/learn/01-engineering/02-npm-and-modules.md` | SKILL L82–L87、L62–L76 | 问题 L24、TL;DR L29、误区 L128、追问链 L134、衔接 L157、关联组件 L161 | 四要素齐、位置对、误区 3 条、追问链 3 条且 3/3 递进 | 低于 1 分钟 |
| `docs/backend/learn/01-concurrency/04-async-io.md` | SKILL L82–L87、L62–L76 | 问题 L25、TL;DR L30、误区 L132、追问链 L138、衔接 L161、关联组件 L165 | 四要素齐、误区 3 条、追问链 3 条且 3/3 递进 | 低于 1 分钟 |

命令：

```bash
grep -n "^### 本讲要解决的问题\|^## TL;DR\|^### 常见误区\|^### 面试追问链\|^### 下一讲衔接\|^### 关联组件" <页面>
awk '/^### 常见误区/,/^### 面试追问链/' <页面> | grep -c '^- '
awk '/^### 面试追问链/,/^### 下一讲衔接/' <页面> | grep -c '<details>'
```

两页用时均低于 SC-002 的 5 分钟。结论可按小节与行号定位。
发现：`04-async-io.md` 是知识域末讲，衔接句指向关联组件。
技能 §4 未写「末讲无下一讲」的写法。建议下一轮补一句。

### T056 一致性回归（技能 ↔ 001 契约 ↔ 宪法 VIII）

机械证据（负例与正例）：

```text
# S1
❌ [S1] .dsh/skills/docs-authoring/SKILL.md:271 技能正文成组出现 4 个内容契约字段名（第 271 行） → 修法：改为指针
✅ 独立自检通过（S1–S7），警告 0 条

# S6
❌ [S6] .dsh/skills/docs-authoring/SKILL.md 技能版本 1.0.1 与变更日志最新条目 1.0.0 不一致 → 修法：同步两处版本号并追加变更记录
✅ 独立自检通过（S1–S7），警告 0 条

# S7
❌ [S7] scripts/ste-lint-zh.baseline 基线由 0 增到 1，与台账第 4 行记录不符 → 修法：基线只减不增。回退基线，或补正式豁免记录
✅ 独立自检通过（S1–S7），警告 0 条
```

S4 指针可达性：技能内 5 条仓内路径全部存在。

| 指针 | 状态 |
|---|---|
| `.dsh/skills/docs-authoring/CHANGELOG.md` | 存在 |
| `.specify/memory/constitution.md` | 存在 |
| `specs/001-docs-engine/contracts/content-contract.md` | 存在 |
| `specs/002-content-orchestration/contracts/check-contract.md` | 存在 |
| `specs/002-content-orchestration/contracts/skill-contract.md` | 存在 |

无冲突：

- 写作规则：技能指向 `content-contract.md` §7，不抄阈值。契约 §7 的 `≤40 字`、`≤25 字` 未出现在技能正文。
- 图解：技能要求自包含、源与产物入库、图注写问题。宪法 VIII 同义。`engine-contract.md` §9 的单图 ≤1.5 MB 未被抄入。
- 云架构静态图：技能要求 `.py` 源入库、构建前出产物。宪法 VIII 同义。
- 图型表：`engine-contract.md` 与 `content-contract.md` §4 都未定义图型枚举。技能表属新增判据，不冲突。
- 优先级：技能 §9 声明宪法 > 内容契约 > 技能。与宪法 Governance 一致。

无重复取值：`check:orchestration` 的 S1 通过。技能内阈值只剩判据本体（`≤12 讲`、`3–5 条`、`≥2 条`）。
`check-contract.md` §3 的 S1 边界允许保留这些。

### T057 规格口径对齐

| 改动 | 前 | 后 |
|---|---|---|
| FR-019 反例条数 | 至少一条 | 至少 3 条 |
| FR-002 路径阈值 | 无 | 单知识域 ≤12 讲，阈值以契约为准 |
| FR-009 与 FR-015 分工声明 | 两处各写一遍 | 保留 FR-009，FR-015 改为指针 |
| FR-024 与 SC-003 收口表述 | 两处各写一遍 | 保留 FR-024 正文，SC-003 改为度量口径，两处互指 |

命令：

```bash
git diff --no-color specs/002-content-orchestration/spec.md
grep -n "FR-002\|FR-009\|FR-015\|FR-019\|FR-024\|SC-003" specs/002-content-orchestration/spec.md
```

需求集合未变。四处均为措辞修正。

### T059 台账最近三次迭代

台账现有 7 条数据行。最近四条如下。

| 行 | iteration | decision | reason | review |
|---|---|---|---|---|
| 5 | 002-content-orchestration | no-writeback | 降级原因：无 Archify 环境，手写自包含 SVG 通过内容门禁，技能已含该降级路径，未改技能 | - |
| 6 | 002-content-orchestration | no-writeback | 规格措辞修正，技能不复制取值，判据本体未变，未改技能 | - |
| 7 | 002-content-orchestration | no-writeback | 抽查与自检全绿，判据仍有效，未改技能 | - |
| 8 | 002-content-orchestration | no-writeback | 复核结论：判据仍有效（T055 两页评审与 S1–S7 自检均过） | recheck:valid |

命令与输出：

```bash
awk -F'\t' 'NR>1{print NR": "$2" | "$4" | "$5" | "$6}' ledger/orchestration-decisions.tsv | tail -4
npm run check:orchestration
# ✅ 独立自检通过（S1–S7），警告 0 条        exit=0
```

三连 `no-writeback` 触发复核，第 8 行给出结论并置 `review=recheck:valid`。
最近三次（行 6、7、8）的 iteration、decision、reason 齐全，SC-004 覆盖 100%。

未完成：T043 迭代演练未执行，其台账记录缺失。本轮按实际发生的三轮登记。
T043 完成后 MUST 补一行。

### 本轮未完成与外部条件

| 项 | 状态 | 原因 |
|---|---|---|
| T043 迭代演练 | 未做 | 属另一任务，需改内容页并做回写判定 |
| T047/T048 跨仓发布与只读校验 | 未做 | `/root/skill` 检出内无 `docs-authoring` |
| S8 跨仓侧 | 部分完成 | 依赖 T047/T048 |
| `04-project-structure` Q3→Q4 衔接 | 偏弱 | 缺连接词，属人工判据，不判错 |
| 图注设问式写法 | 待改 | 现为短语式，设问写在图前正文 |
| `cross-domain` 门禁错误 | 已消除 | verify-001 修复后复跑归零，非本任务写域 |
