---
layout: home

hero:
  name: 技术面试备考文档引擎
  text: 声明式目录 + 元数据驱动
  tagline: 放 Markdown 和 _meta.yml，引擎自动生成导航、学习路径与组件索引
  actions:
    - theme: brand
      text: Python 后端
      link: /backend/
    - theme: alt
      text: 前端工程化
      link: /frontend/

features:
  - title: 渐进式学习
    details: 按知识域内的路径逐讲推进：原理 → API 手册 → 组合用法 → 完整 Demo。
  - title: 组件查询
    details: 组件页展示由哪些知识点组合、完整源码、其他项目如何引入。
  - title: 零配置扩展
    details: 新增方向只建目录与文件。引擎与配置代码一行不改。
  - title: 机械门禁
    details: 元数据、必需小节、命名、链接、中文写作全部由脚本判定。
---

## 两个入口

每个学习方向根目录都有两个入口。先学原理，再查组件。

| 入口 | 用途 | 读者动作 |
|---|---|---|
| 📚 渐进式学习 | 按路径把一个方向学下来 | 从推荐起点逐讲推进 |
| 🧩 组件查询 | 找到能搬进自己项目的组件 | 看依赖、看源码、复制引用方式 |

## 本次示例覆盖

- **Python 后端**：多线程 → 多进程 → Queue 通信 → 异步 I/O，另有进程安全队列组件。
- **前端工程化**：单页 index.html 入口 → npm 与模块 → Vite 开发与构建 → 工程化项目结构。
