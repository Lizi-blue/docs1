---
title: "单页 index.html 入口"
type: knowledge
domain: frontend
knowledge_domain: engineering
order: 1
level: basic
tags: [html, script-tag, global-scope]
description: "一个 index.html 加几个 script 标签的开发方式，以及它的四个瓶颈"
source_module: "browser"
api_methods:
  - "document.querySelector"
  - "window.onload"
prerequisites: []
related_knowledge:
  - /frontend/learn/engineering/npm-and-modules
related_components: []
---

# 单页 index.html 入口

### 本讲要解决的问题

不装构建工具能写出页面吗？代码变多以后哪里先失控？
这一讲讲清 script 顺序、全局作用域与四个瓶颈。

## TL;DR

> 早期前端就是「一个 HTML 加两个 script」。浏览器直接读源码，改完刷新页面。
> 代码一多就出现四个问题：全局变量互相覆盖、依赖顺序手工维护、没有模块、没有构建优化。

## 概念定义

单页入口指一个 HTML 文件承担全部页面结构，脚本用 script 标签顺序引入。

浏览器按标签顺序执行脚本。脚本之间靠全局变量通信。刷新页面就是重新加载全部资源。

## 原理图解

<DiagramFrame src="/diagrams/spa-vs-bundler.html" title="单页入口与打包入口的差别（Archify 交互图）" :height="520" />

## 关键对比

| 维度 | 单页 index.html | 工程化项目 |
|---|---|---|
| 依赖引入 | script 标签手写顺序 | npm 安装并按需 import |
| 作用域 | 全局变量 | 模块作用域 |
| 改动后 | 手工刷新整个页面 | 热更新只换改动模块 |
| 代码压缩 | 手工或不做 | 构建时自动完成 |
| 资源引用 | 相对路径硬编码 | 构建器重写并加哈希 |
| 团队协作 | 易冲突 | 目录与模块划分清晰 |

### 官方依据与版本差异

- [MDN JavaScript 模块](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules) — ES2015 起提供模块语法。
- [MDN script type 属性](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/script/type) — 自 ES2015 规范起提供模块语法。

## API 手册：浏览器原生入口




### 必会接口

<ApiTable :items='[{"name":"document.querySelector","rank":"必会","pitfall":"选择器匹配不到时返回 null。直接读属性会报错。","signature":"querySelector(selectors)","params":[{"name":"selectors","type":"string","default":"必填","desc":"CSS 选择器"}],"returns":"首个匹配元素或 null","methods":["addEventListener(type, handler) — 绑定事件","textContent — 读写文本"],"effect":"按选择器取到元素，再挂事件或改内容","scenario":"脚本直接操作页面结构","example":"<button id=&#39;go&#39;>走</button>\n<script>\n  document.querySelector(&#39;#go&#39;).addEventListener(&#39;click&#39;, () => {\n    console.log(&#39;clicked&#39;)\n  })\n</script>","exampleLang":"html"}]' />

### 常用接口

<ApiTable :items='[{"name":"window.onload","rank":"常用","pitfall":"onload 等全部资源加载完。脚本只需 DOM 就绪时用 DOMContentLoaded。","signature":"window.onload = handler","params":[],"returns":"无","methods":["DOMContentLoaded — DOM 就绪即触发"],"effect":"等资源加载完成再执行脚本","scenario":"脚本需要操作完整 DOM","example":"window.addEventListener(&#39;DOMContentLoaded&#39;, () => {\n  console.log(&#39;dom ready&#39;)\n})","exampleLang":"javascript"}]' />
## 组合用法：表单加列表的无构建页面

### 组合了哪些知识？

| 知识点 | 用在本功能里的部分 |
|---|---|
| [单页 index.html 入口](/frontend/learn/engineering/single-html-entry) | script 顺序与全局作用域 |
| [npm 与模块](/frontend/learn/engineering/npm-and-modules) | 什么时候该换成模块化 |

### 数据流图解

<DiagramFrame src="/diagrams/spa-vs-bundler.html" title="事件到 DOM 的数据流（Archify 交互图）" :height="440" />

### 分步实现

1. 写 HTML 结构。
2. 用 script 标签按顺序引入脚本。
3. 脚本内查询 DOM 并绑定事件。
4. 数据存在全局变量里。
5. 改动后手工刷新页面验证。

### 对比表格

| 做法 | 写法 | 局限 |
|---|---|---|
| 内联脚本 | 写在 HTML 里 | 无法复用与缓存 |
| 多个 script 文件 | 按顺序引入 | 顺序错了就报 undefined |
| 立即执行函数 | 包一层隔离变量 | 模块依赖仍靠手工维护 |

## 完整 Demo：待办清单（无构建）

### 场景描述

一个不装任何依赖的待办清单：输入、添加、勾选完成、统计剩余条数。

### 完整代码

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>待办清单</title>
</head>
<body>
  <input id="text" placeholder="要做什么" />
  <button id="add">添加</button>
  <ul id="list"></ul>
  <p id="hint">剩余 0 条</p>
  <script>
    const items = []
    const list = document.querySelector("#list")
    const hint = document.querySelector("#hint")

    function render() {
      list.innerHTML = ""
      for (const item of items) {
        const li = document.createElement("li")
        li.textContent = item.text
        li.style.textDecoration = item.done ? "line-through" : "none"
        li.addEventListener("click", () => {
          item.done = !item.done
          render()
        })
        list.appendChild(li)
      }
      hint.textContent = `剩余 ${items.filter((i) => !i.done).length} 条`
    }

    document.querySelector("#add").addEventListener("click", () => {
      const text = document.querySelector("#text").value.trim()
      if (!text) return
      items.push({ text, done: false })
      render()
    })
  </script>
</body>
</html>
```

### 运行方式

```bash
python3 -m http.server 8080
# 浏览器打开 http://127.0.0.1:8080/index.html
```

### 常见误区

- 「单页入口只是写法土，功能没差别」是错的。全局变量会互相覆盖，依赖顺序也要手工维护。
- 「script 标签顺序无关紧要」是错的。顺序错了就会拿到 undefined。
- 「innerHTML 全量重绘没有代价」是错的。每次重绘都重建整棵子树，列表一大就卡。

### 面试追问链

<details>
<summary>Q1：这段代码什么时候会失控？</summary>

出现第二个页面、第二个开发者、或者需要第三方库的时候。全局变量与手工 script 顺序都撑不住。

</details>

<details>
<summary>Q2：再把规模放大，innerHTML 全量重绘会先卡在哪？</summary>

每次重绘都重建整棵子树。真实列表要改成差分更新，这正是框架做的事。

</details>

<details>
<summary>Q3：要根治这两个问题，这页代码放到工程化项目里会变成什么？</summary>

HTML 变成模板，状态与 render 变成组件，依赖改为 import，构建器负责打包压缩。

</details>

### 下一讲衔接

页面靠手工管依赖，下一讲 [npm 与模块](/frontend/learn/engineering/npm-and-modules) 讲依赖从哪里来。

### 关联组件

本方向暂无组件。后续出现组件时，本页会自动出现反向链接。
