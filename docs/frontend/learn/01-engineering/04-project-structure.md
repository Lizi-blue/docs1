---
title: "工程化项目结构"
type: knowledge
domain: frontend
knowledge_domain: engineering
order: 4
level: intermediate
tags: [structure, env, build-output, deploy]
description: "一个 Vue 项目里每个目录管什么，构建产物如何部署"
source_module: "vite"
api_methods:
  - "npm run build"
  - "public/"
  - ".env"
prerequisites:
  - /frontend/learn/engineering/vite-dev-and-build
related_knowledge:
  - /frontend/learn/engineering/npm-and-modules
related_components: []
---

# 工程化项目结构

### 本讲要解决的问题

源码、静态资源与构建产物各放哪一层？上线时把什么交给服务器？
这一讲讲清目录职责与静态托管的回落规则。

## TL;DR

> 根目录的 index.html 是入口，src 放源码，public 放原样拷贝的静态文件。
> 构建产物在 dist。部署就是把 dist 交给静态服务器，并让服务端把未知路径回落到 index.html。

## 概念定义

工程化项目结构是一套约定，把源码、静态资源、配置与产物分开摆放。

约定让工具知道去哪找入口、去哪找源码、产物放哪。团队不必每次重新决定目录。要掌握的是每一层的职责边界，而不是死记目录名。

## 原理图解

<DiagramFrame src="/diagrams/spa-vs-bundler.html" title="源码目录到构建产物的映射（Archify 交互图）" :height="500" />

## 关键对比

| 目录 | 内容 | 是否进构建产物 |
|---|---|---|
| index.html | 应用入口 | 是，作为模板被处理 |
| src/ | 源码、组件、路由 | 是，被打包压缩 |
| public/ | 原样拷贝的文件 | 是，按原路径拷贝 |
| assets/ | 被引用的图片字体 | 是，带哈希重命名 |
| node_modules/ | 依赖 | 否，只取被引用的部分 |
| dist/ | 构建输出 | 就是部署内容 |

### 官方依据与版本差异

- [Vite 静态资源](https://vitejs.dev/guide/assets.html) — Vite 5.0 与 6.0 的 public 目录与 base 关系。
- [Node exports 字段](https://nodejs.org/api/packages.html#exports) — Node 12.7 起支持子路径导出字段。

## API 手册：构建与部署接口





### 必会接口

<ApiTable :items='[{"name":"npm run build","rank":"必会","pitfall":"构建前先跑 npm ci。直接 install 可能装到别的版本。","signature":"npm run build","params":[],"returns":"dist 目录","methods":["vite build","vite build --mode production"],"effect":"产出可直接托管的静态文件","scenario":"发布前的构建步骤","example":"npm ci\nnpm run build\nls dist","exampleLang":"bash"}]' />

### 常用接口

<ApiTable :items='[{"name":"public/","rank":"常用","pitfall":"public 里的文件原样拷贝。引用时不要写 public 前缀。","signature":"public/<file>","params":[{"name":"file","type":"file","default":"必填","desc":"原样拷贝的文件"}],"returns":"无","methods":["引用时省略 public 前缀"],"effect":"放不需要构建处理的文件，例如图标与 robots.txt","scenario":"favicon、跨域校验文件","example":"public/favicon.svg  ->  产物 /favicon.svg","exampleLang":"text"},{"name":".env 与 VITE_ 前缀","rank":"常用","pitfall":"构建时按 mode 选 .env 文件。mode 写错会用到另一套值。","signature":".env.[mode]","params":[{"name":"mode","type":"string","default":"development","desc":"构建模式名"}],"returns":"注入 import.meta.env","methods":[".env.development — 开发默认",".env.production — 生产默认"],"effect":"同一份代码按环境取不同值","scenario":"接口地址与功能开关","example":"# .env.production\nVITE_API_BASE=https://api.example.com","exampleLang":"bash"}]' />
## 组合用法：多环境构建与静态托管

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [工程化项目结构](/frontend/learn/engineering/project-structure) | 目录职责与产物 |
| [Vite 开发与构建](/frontend/learn/engineering/vite-dev-and-build) | base 与产物目录 |
| [npm 与模块](/frontend/learn/engineering/npm-and-modules) | npm ci 保证可复现 |

### 数据流图解

<DiagramFrame src="/diagrams/vite-dev-vs-build.html" title="构建产物到静态服务器（Archify 交互图）" :height="440" />

### 分步实现

1. 按模式写 `.env` 文件。
2. 代码里读 `import.meta.env`。
3. 用 `npm ci` 装依赖。
4. 用 `npm run build` 产出 dist。
5. 把 dist 交给静态服务器托管。

### 对比表格

| 托管方式 | 配置要点 | 特点 |
|---|---|---|
| 静态服务器直出 | 未知路径回落 index.html | 简单，适合内网 |
| 网关加静态目录 | 配 try_files | 与 API 同域 |
| 对象存储加 CDN | 上传 dist 并回源 | 适合公网大流量 |

## 完整 Demo：为一个 Vue 项目写部署清单

### 场景描述

一个用 Vite 构建的 Vue 项目，部署到内网静态服务器，接口走同域反向代理。

### 完整代码

```text
todo-app/
├── index.html            # 入口模板
├── package.json          # 依赖与命令
├── package-lock.json     # 锁定版本
├── vite.config.js        # 构建配置
├── .env.development      # 开发环境变量
├── .env.production       # 生产环境变量
├── public/
│   └── favicon.svg       # 原样拷贝
└── src/
    ├── main.js           # 应用入口
    ├── App.vue           # 根组件
    ├── components/       # 可复用组件
    ├── router/           # 路由表
    ├── stores/           # 状态
    └── assets/           # 被引用的图片与样式
```

```
# Caddy：先找文件，再回落入口，最后转发接口
:80 {
  root * /srv
  file_server
  try_files {path} {path}.html {path}/index.html /index.html
  reverse_proxy /api/* backend:8000
}
```

### 运行方式

```bash
npm ci
npm run build
docker run --rm -p 8080:80 -v "$PWD/dist:/srv:ro" caddy:2-alpine
```

### 常见误区

- 「public 与 assets 只是目录名不同」是错的。public 原样拷贝，assets 交给构建加哈希。
- 「index.html 可以挪进 src」是错的。Vite 把它当入口模板，放错位置构建找不到入口。
- 「环境变量不加前缀也能读」是错的。Vite 只注入带 VITE_ 前缀的变量，避免服务端密钥进浏览器。

### 面试追问链

<details>
<summary>Q1：为什么 index.html 放在根目录？</summary>

Vite 把它当入口模板处理。放错位置会导致构建找不到入口。

</details>

<details>
<summary>Q2：入口定好之后，public 与 assets 怎么选？</summary>

需要构建处理与哈希就放 assets。需要保持原文件名与路径就放 public。

</details>

<details>
<summary>Q3：资源放好之后，单页应用为什么还需要回落规则？</summary>

前端路由由 JS 接管。刷新子路径时服务端找不到文件，就要回落到 index.html。

</details>

<details>
<summary>Q4：回落规则让子路径都能打开，那同一份代码怎么在开发与生产取不同配置？</summary>

Vite 只把带该前缀的变量注入客户端，避免把服务端密钥打进浏览器。

</details>

### 下一讲衔接

本域路径到此收尾，可回到 [工程化基础](/frontend/learn/) 入口复习整条路径。

### 关联组件

本方向暂无组件。后续出现组件时，本页会自动出现反向链接。
