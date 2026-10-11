---
title: "Vite 开发与构建"
type: knowledge
domain: frontend
knowledge_domain: engineering
order: 3
level: intermediate
tags: [vite, esbuild, hmr, rollup]
description: "开发服务器不打包，构建时才打包：Vite 的两套执行模型"
source_module: "vite"
api_methods:
  - "vite dev"
  - "vite build"
  - "vite.config.js"
prerequisites:
  - /frontend/learn/engineering/npm-and-modules
related_knowledge:
  - /frontend/learn/engineering/project-structure
related_components: []
---

# Vite 开发与构建

### 本讲要解决的问题

开发服务器为什么要先打包才能启动？改一个文件要等多久？
这一讲讲清 Vite 开发态与构建态的两套执行模型。

## TL;DR

> 开发时 Vite 不打包。它用浏览器原生 ESM 按需编译，所以冷启动快。
> 构建时换成 Rollup 打包，产出带哈希的静态文件。这套两段式模型就是它快的原因。

## 概念定义

Vite 是前端构建工具，开发态负责按需编译与热更新，生产态负责打包与优化。

开发态里，浏览器请求哪个模块，Vite 就编译哪个模块。依赖用 esbuild 预构建一次，缓存在 node_modules 下的缓存目录。改一个文件时，只有受影响模块被替换，页面不整刷新。这就是热更新。

## 原理图解

<DiagramFrame src="/diagrams/vite-dev-vs-build.html" title="开发态按需编译与生产态打包（Archify 交互图）" :height="540" />

## 关键对比

| 维度 | 传统打包式开发服务器 | Vite 开发服务器 |
|---|---|---|
| 启动 | 先打包整个应用 | 不打包，秒级就绪 |
| 改一个文件 | 重新打包受影响的包 | 只编译该模块并热替换 |
| 浏览器请求 | 一个 bundle | 多个 ESM 模块 |
| 生产构建 | 同一套打包器 | 换 Rollup 做优化 |
| 大项目体验 | 启动时间随规模增长 | 启动时间基本恒定 |

### 官方依据与版本差异

- [Vite 指南](https://vitejs.dev/guide/) — Vite 5.0 与 6.0 的行为差异。
- [Vite 构建](https://vitejs.dev/guide/build.html) — Vite 5.0 与 6.0 的生产构建与基础路径。

## API 手册：Vite

<ApiTable :items='[{"name": "vite dev", "rank": "必会", "pitfall": "开发服务器不能直接上生产。它按需编译，不做压缩与分包。", "signature": "vite [--host] [--port]", "params": [{"name": "--host", "type": "flag", "default": "关闭", "desc": "监听所有网卡，便于容器访问"}, {"name": "--port", "type": "number", "default": "5173", "desc": "监听端口"}], "returns": "开发服务器进程", "methods": ["vite — 启动开发服务器", "vite build — 生产构建", "vite preview — 预览构建产物"], "effect": "按需编译源码并推送热更新", "scenario": "本地开发", "example": "npx vite --host\nnpx vite build\nnpx vite preview", "exampleLang": "bash"}, {"name": "vite.config.js", "rank": "必会", "pitfall": "server.proxy 只在开发期生效。线上要配网关转发。base 写错会让资源 404。", "signature": "defineConfig({ plugins, resolve, server, build, base })", "params": [{"name": "plugins", "type": "array", "default": "[]", "desc": "插件列表"}, {"name": "base", "type": "string", "default": "&#39;/&#39;", "desc": "部署子路径前缀"}, {"name": "server.proxy", "type": "object", "default": "{}", "desc": "开发代理规则"}, {"name": "build.outDir", "type": "string", "default": "dist", "desc": "构建输出目录"}], "returns": "配置对象", "methods": ["defineConfig() — 带类型提示的配置导出", "server.proxy — 开发期转发接口", "base — 部署子路径前缀", "build.outDir — 产物输出目录"], "effect": "声明构建行为，插件可深度介入管线", "scenario": "任何 Vite 项目", "example": "import { defineConfig } from \"vite\"\nimport vue from \"@vitejs/plugin-vue\"\n\nexport default defineConfig({\n  plugins: [vue()],\n  server: { proxy: { \"/api\": \"http://127.0.0.1:8000\" } }\n})", "exampleLang": "javascript"}, {"name": "import.meta.env", "rank": "常用", "pitfall": "只注入 VITE_ 前缀的变量。其他变量在客户端读到 undefined。", "signature": "import.meta.env.VITE_*", "params": [{"name": "MODE", "type": "string", "default": "development", "desc": "当前模式"}, {"name": "PROD", "type": "bool", "default": "false", "desc": "是否生产构建"}], "returns": "环境变量对象", "methods": ["import.meta.env.VITE_KEY — 读取自定义变量"], "effect": "让同一份代码在开发与生产走不同配置", "scenario": "接口地址、开关与埋点配置", "example": "const base = import.meta.env.VITE_API_BASE ?? \"/api\"\nconsole.log(base)", "exampleLang": "javascript"}]' />

## 组合用法：开发代理加路径别名

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [Vite 开发与构建](/frontend/learn/engineering/vite-dev-and-build) | 代理与别名 |
| [npm 与模块](/frontend/learn/engineering/npm-and-modules) | 插件安装方式 |

### 数据流图解

<DiagramFrame src="/diagrams/vite-dev-vs-build.html" title="浏览器、开发服务器与后端的请求路径（Archify 交互图）" :height="460" />

### 分步实现

1. 装 Vue 插件。
2. 在配置里注册插件。
3. 加 `server.proxy` 转发接口。
4. 加 `resolve.alias` 简化导入路径。
5. 用 `base` 适配子路径部署。

### 对比表格

| 配置项 | 作用 | 常见坑 |
|---|---|---|
| server.proxy | 开发期转发接口 | 生产环境无效，需网关同规则 |
| resolve.alias | 简化导入路径 | 构建配置与编辑器提示要同步 |
| base | 子路径部署 | 静态资源 404 多由它引起 |
| build.outDir | 产物目录 | 部署清单要指向同一目录 |

## 完整 Demo：最小 Vite 项目

### 场景描述

从空目录起一个 Vite 项目：入口 HTML、一个模块、一个配置文件，跑通开发与构建。

### 完整代码

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><title>vite mini</title></head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

```javascript
// src/main.js
import { greet } from "./greet.js"

document.querySelector("#app").textContent = greet("面试官")
```

```javascript
// src/greet.js
export function greet(name) {
  return `你好，${name}`
}
```

```javascript
// vite.config.js
import { defineConfig } from "vite"

export default defineConfig({
  build: { outDir: "dist", sourcemap: false },
  server: { host: true },
})
```

### 运行方式

```bash
npm install -D vite
npx vite --host        # 开发：改 greet.js 看热更新
npx vite build         # 构建：产物在 dist/
npx vite preview       # 预览构建产物
```

### 常见误区

- 「Vite 开发时也在打包，只是更快」是错的。开发态不打包，浏览器按需请求模块。
- 「热更新会刷新整个页面」是错的。它替换受影响的模块并保留组件状态。
- 「生产构建还用 esbuild」是错的。生产构建换 Rollup，分包与产物优化更成熟。

### 面试追问链

<details>
<summary>Q1：为什么冷启动比 Webpack 快？</summary>

Vite 不先打包。它只启动服务器，浏览器按需请求模块，依赖提前用 esbuild 预构建。

</details>

<details>
<summary>Q2：启动快之后，热更新为什么不刷新页面？</summary>

它把新模块推给浏览器，由运行时代码替换旧模块并保留组件状态。

</details>

<details>
<summary>Q3：开发态既然用 esbuild 预构建，生产构建为什么不用它打包？</summary>

esbuild 快但代码分割与插件生态弱。Rollup 的产物更小、分包更成熟。

</details>

### 下一讲衔接

开发与构建跑通后，下一讲 [工程化项目结构](/frontend/learn/engineering/project-structure) 讲目录职责与产物落位。

### 关联组件

本方向暂无组件。后续出现组件时，本页会自动出现反向链接。
