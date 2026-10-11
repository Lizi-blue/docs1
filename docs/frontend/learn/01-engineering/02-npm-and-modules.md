---
title: "npm 与模块"
type: knowledge
domain: frontend
knowledge_domain: engineering
order: 2
level: basic
tags: [npm, package-json, esm, lockfile]
description: "包管理器解决依赖从哪来、装到哪、版本怎么锁"
source_module: "npm"
api_methods:
  - "npm install"
  - "npm ci"
  - "package.json"
prerequisites:
  - /frontend/learn/engineering/single-html-entry
related_knowledge:
  - /frontend/learn/engineering/vite-dev-and-build
related_components: []
---

# npm 与模块

## TL;DR

> npm 是包管理器。它从 registry 取包，装进 node_modules，并把依赖写进 package.json。
> package-lock.json 锁住整棵依赖树的版本。部署时用 `npm ci` 按锁文件精确安装。

## 概念定义

npm 是 Node.js 自带的包管理器，负责下载、安装与管理第三方代码。

它做四件事：解析 package.json 里的依赖声明，从 registry 拉取包，落地到 node_modules，更新锁文件。包自己也可以依赖别的包，于是形成依赖树。锁文件记录整棵树的确定版本，保证每台机器装出同样的结果。

## 原理图解

<DiagramFrame src="/diagrams/spa-vs-bundler.html" title="npm 安装到 import 的链路（Archify 交互图）" :height="480" />

## 关键对比

| 维度 | script 标签 | npm 加 ESM |
|---|---|---|
| 来源 | CDN 或本地文件 | registry |
| 版本控制 | 手工记录 | package.json 加锁文件 |
| 作用域 | 全局变量 | 模块作用域 |
| 依赖关系 | 手工排序 | 自动解析 |
| 离线可用 | 依赖本地文件 | 依赖本地缓存或 node_modules |

## API 手册：npm 与模块

<ApiTable ::items='[{"name": "npm install", "rank": "必会", "signature": "npm install [pkg] [--save-dev]", "params": [{"name": "pkg", "type": "string", "default": "省略则按 package.json 安装", "desc": "包名，可带版本范围"}, {"name": "--save-dev", "type": "flag", "default": "关闭", "desc": "写入 devDependencies"}], "returns": "退出码 0 表示成功", "methods": ["npm install pkg — 装运行时依赖", "npm install -D pkg — 装开发依赖", "npm install — 按声明补齐"], "effect": "把包装进 node_modules 并更新锁文件", "scenario": "本地开发新增依赖", "example": "npm install vue\nnpm install -D vitepress", "exampleLang": "bash"}, {"name": "npm ci", "rank": "必会", "signature": "npm ci", "returns": "退出码 0 表示成功", "methods": ["npm ci — 严格按锁文件安装", "npm ci --omit=dev — 跳过开发依赖"], "effect": "先清空 node_modules，再按锁文件精确还原", "scenario": "CI 与生产构建，要求可复现", "example": "npm ci\nnpm run build", "exampleLang": "bash"}, {"name": "package.json", "rank": "必会", "signature": "{ \"name\": string, \"scripts\": object, \"dependencies\": object, \"devDependencies\": object }", "params": [{"name": "scripts", "type": "object", "default": "{}", "desc": "命令别名，用 npm run 调用"}, {"name": "dependencies", "type": "object", "default": "{}", "desc": "运行时需要的包"}, {"name": "devDependencies", "type": "object", "default": "{}", "desc": "只在开发与构建期需要的包"}], "returns": "无", "methods": ["npm run &lt;script&gt; — 执行脚本"], "effect": "声明项目身份、依赖与命令入口", "scenario": "任何 Node 项目", "example": "{\n  \"scripts\": { \"build\": \"vitepress build docs\" },\n  \"devDependencies\": { \"vitepress\": \"1.6.4\" }\n}", "exampleLang": "json"}, {"name": "ESM import / export", "rank": "必会", "signature": "import name from \"pkg\" / export default value", "returns": "无", "methods": ["import — 引入模块", "export — 导出模块", "import() — 动态引入"], "effect": "按文件划分作用域，依赖关系写在代码里", "scenario": "任何现代前端项目", "example": "import { createApp } from \"vue\"\nimport App from \"./App.vue\"\n\ncreateApp(App).mount(\"#app\")", "exampleLang": "javascript"}]' />

## 组合用法：装一个依赖并用起来

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [npm 与模块](/frontend/learn/engineering/npm-and-modules) | 安装、声明与锁版本 |
| [Vite 开发与构建](/frontend/learn/engineering/vite-dev-and-build) | 构建器解析 import |

### 数据流图解

<DiagramFrame src="/diagrams/spa-vs-bundler.html" title="从 npm 安装到构建打包（Archify 交互图）" :height="460" />

### 分步实现

1. `npm init -y` 生成 package.json。
2. 用 `npm install` 装运行时依赖。
3. 用 `npm install -D` 装开发依赖。
4. 代码里 import 使用。
5. 提交 package.json 与锁文件。

### 对比表格

| 命令 | 依据 | 是否改锁文件 | 场景 |
|---|---|---|---|
| npm install | package.json | 会 | 日常开发 |
| npm ci | 锁文件 | 不会 | CI 与发布 |
| npm update | 声明范围 | 会 | 主动升级 |

## 完整 Demo：给静态页面装上版本化依赖

### 场景描述

把「单页 index.html」改成用 npm 管理依赖，并用 ESM 引入一个工具库计算日期差。

### 完整代码

```json
{
  "name": "todo-mini",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "dayjs": "^1.11.13"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

```javascript
// src/main.js —— 模块作用域，依赖写在 import 里
import dayjs from "dayjs"

const started = dayjs()
document.querySelector("#hint").textContent = `页面打开于 ${started.format("HH:mm:ss")}`
```

### 运行方式

```bash
npm install
npm run dev
```

### 面试追问链

<details>
<summary>Q1：为什么要提交锁文件？</summary>

锁文件固定整棵依赖树的版本。不提交就可能出现「我这儿能跑，CI 上不行」。

</details>

<details>
<summary>Q2：dependencies 与 devDependencies 怎么分？</summary>

运行时需要就放 dependencies。只在开发或构建期需要就放 devDependencies。

</details>

<details>
<summary>Q3：node_modules 为什么不提交？</summary>

体积大且平台相关。锁文件加 registry 已能精确还原。

</details>

### 关联组件

本方向暂无组件。后续出现组件时，本页会自动出现反向链接。
