---
description: "任务清单：07 / 08 / 10 / 11 四域完整教学，一域一次推送"
---

# Tasks: Python 后端四域补齐（07 / 08 / 10 / 11）

**输入**：[catalog.md](./catalog.md)（12 域 / 105 讲）· [spec.md](../../.specify/) 无独立规格，本任务以目录方案为准

**节奏**：一域写完全部讲 → 过门禁 → 登记元数据与覆盖矩阵 → 推送一次 → 核验线上。

## 通用完成定义（每域都要满足）

1. 该域全部讲页存在，且 `_meta.yml` 从 `outline` 转 `active`，登记 `path` 与 `lessons`。
2. 每讲含：四段式、教学要素、官方依据带版本、API 手册两组、图解引用、常见误区、面试追问链。
3. `scripts/data/topic-coverage.json` 增加该域主题，且 `check:coverage` 通过。
4. 十五条门禁全绿。
5. 推送一次，流水线全绿，线上抽查该域首页与随机两讲返回 200。

---

## Phase 1: 07 语言核心机制（10 讲）

- [x] T001 [P] 产出该域 4 张图解（域地图、对象模型、属性查找、装饰器叠加）并生成产物（覆盖 FR-022）
- [x] T002 [US-07] 写 `01-data-model.md`（数据模型与魔术方法）（覆盖目录表第 1 讲）
- [x] T003 [P] [US-07] 写 `02-object-lifecycle.md`（对象创建与生命周期）
- [x] T004 [P] [US-07] 写 `03-attribute-access.md`（属性访问与 `__slots__`）
- [x] T005 [P] [US-07] 写 `04-descriptors.md`（描述符协议）
- [x] T006 [P] [US-07] 写 `05-metaclass.md`（元类编程）
- [x] T007 [P] [US-07] 写 `06-decorators-closures.md`（装饰器与闭包）
- [x] T008 [P] [US-07] 写 `07-context-managers.md`（上下文管理器）
- [x] T009 [P] [US-07] 写 `08-iterators-generators.md`（迭代器与生成器）
- [x] T010 [P] [US-07] 写 `09-exceptions.md`（异常层次与异常组）
- [x] T011 [US-07] 写 `10-modules-import.md`（模块与导入机制）
- [x] T012 [US-07] 改 `docs/backend/learn/07-language-core/_meta.yml`：status 改 active，登记 path 与 10 条 lessons
- [x] T013 [US-07] 在 `scripts/data/topic-coverage.json` 登记该域 10 个主题
- [x] T014 [US-07] 跑十五条门禁并修复
- [x] T015 [US-07] 提交并推送一次，核验流水线与线上页面

## Phase 2: 08 类型系统与类型检查（8 讲）

- [x] T016 [P] [US-08] 产出该域 3 张图解（域地图、型变、检查器流水线）
- [x] T017 [US-08] 写 `01-typing-basics.md`
- [x] T018 [P] [US-08] 写 `02-generics.md`
- [x] T019 [P] [US-08] 写 `03-protocol.md`
- [x] T020 [P] [US-08] 写 `04-callable-typing.md`
- [x] T021 [P] [US-08] 写 `05-typed-dict-dataclass.md`
- [x] T022 [P] [US-08] 写 `06-type-checkers.md`
- [x] T023 [P] [US-08] 写 `07-runtime-typing.md`
- [x] T024 [US-08] 写 `08-type-migration.md`
- [x] T025 [US-08] 该域 `_meta.yml` 转 active 并登记
- [x] T026 [US-08] 覆盖矩阵登记该域主题
- [x] T027 [US-08] 门禁 + 提交推送 + 线上核验

## Phase 3: 10 架构与领域设计（10 讲）

- [x] T028 [P] [US-10] 产出该域 3 张图解（域地图、分层依赖、接口演进）
- [x] T029 [US-10] 写 `01-pattern-selection.md`
- [x] T030 [P] [US-10] 写 `02-creational-patterns.md`
- [x] T031 [P] [US-10] 写 `03-structural-patterns.md`
- [x] T032 [P] [US-10] 写 `04-behavioral-patterns.md`
- [x] T033 [P] [US-10] 写 `05-layering.md`
- [x] T034 [P] [US-10] 写 `06-dependency-injection.md`
- [x] T035 [P] [US-10] 写 `07-domain-modeling.md`
- [x] T036 [P] [US-10] 写 `08-ddd-repository.md`
- [x] T037 [P] [US-10] 写 `09-api-design.md`
- [x] T038 [US-10] 写 `10-api-evolution.md`
- [x] T039 [US-10] 该域 `_meta.yml` 转 active 并登记
- [x] T040 [US-10] 覆盖矩阵登记该域主题
- [x] T041 [US-10] 门禁 + 提交推送 + 线上核验

## Phase 4: 11 工程化与交付（10 讲）

- [ ] T042 [P] [US-11] 产出该域 3 张图解（域地图、交付流水线、三类信号）
- [ ] T043 [US-11] 写 `01-config-management.md`
- [ ] T044 [P] [US-11] 写 `02-secrets.md`
- [ ] T045 [P] [US-11] 写 `03-logging.md`
- [ ] T046 [P] [US-11] 写 `04-observability.md`
- [ ] T047 [P] [US-11] 写 `05-unit-testing.md`
- [ ] T048 [P] [US-11] 写 `06-integration-contract.md`
- [ ] T049 [P] [US-11] 写 `07-property-testing.md`
- [ ] T050 [P] [US-11] 写 `08-packaging.md`
- [ ] T051 [P] [US-11] 写 `09-code-quality.md`
- [ ] T052 [US-11] 写 `10-deploy-container.md`
- [ ] T053 [US-11] 该域 `_meta.yml` 转 active 并登记
- [ ] T054 [US-11] 覆盖矩阵登记该域主题
- [ ] T055 [US-11] 门禁 + 提交推送 + 线上核验

## Phase 5: 收尾

- [ ] T056 四域整体复核：目录与 catalog.md 一致，无重复主题
- [ ] T057 证据归档 `specs/010-python-domain-catalog/checklists/local-baseline.md`
- [ ] T058 确认 03/04/05/06/12 仍为 outline 且无空页

## 依赖与并行

```text
一域内：讲页可并行，_meta 与矩阵登记必须等讲页齐全
跨域：四域相互独立，可任意顺序；本任务按 07 → 08 → 10 → 11
推送：每域一次（T015 / T027 / T041 / T055）
```
