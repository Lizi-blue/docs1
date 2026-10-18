# 讲页写作模板（对齐既有方向）

> 基准：`docs/backend/learn/01-concurrency/*.md`。新增讲页按此骨架写。

## frontmatter

```yaml
title: "讲标题"
type: knowledge
domain: agent
knowledge_domain: <知识域 slug>
order: <序号>
level: basic | advanced
tags: [标签]
description: "一句话说明"
prerequisites:
  - /agent/learn/<域>/<前置讲>
related_knowledge:
  - /agent/learn/<域>/<相关讲>
```

说明：不写 `source_module` 与 `api_methods` 时，模块接口覆盖门禁不介入；
需要写接口时再补，并保证方法组与表格数量匹配。

## 小节骨架（顺序即门禁顺序）

1. `### 本讲要解决的问题`
2. `## TL;DR`
3. `## 概念定义`
4. `## 原理图解`
5. `## 关键对比`
6. `### 官方依据与版本差异`（≥2 条官方链接，每条标适用版本）
7. `## 组合用法：<场景>` + `### 组合了哪些知识？` + `### 数据流图解` + `### 分步实现` + `### 对比表格`
8. `## 完整 Demo：<场景>` + `### 场景描述` + `### 完整代码` + `### 运行方式`
9. `### 常见误区`（≥2 条）
10. `### 面试追问链`（3–5 条，每条用 `<details>` 折叠）
11. `### 下一讲衔接`
12. `### 关联组件`（可选）

## 公开安全

正文不得出现内网域名、私网地址、内网路径与凭据；
自建集群经验用抽象能力类别表述。提交前跑 `npm run check:public-safety`。
