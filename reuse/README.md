# 复用约定（reuse/）

本目录是组件复用的**事实源**。每个组件一份 `manifest.json`，声明文件清单、外部依赖、
适配点与验收命令；组件页只渲染它，不手写清单（宪法 I 与 XI）。

## 1. 怎么拿

1. 打开组件页，读「复用四件套」一节（内容来自本目录的清单）。
2. 按 `sides.<方向>.files` 逐条复制文件到目标项目，`required: true` 的必须带全。
3. 按 `sides.<方向>.external_deps` 安装依赖；`external_deps` 为空表示零第三方依赖。

## 2. 怎么改

只允许改 `adaptation` 列出的三处：

| 方向 | 适配点 | 说明 |
|---|---|---|
| 后端 | 命令白名单、工作区与限额、端口与反代 | 改 `service/config.json` 与环境变量，不动调度与取消逻辑 |
| 前端 | 接口基地址、品牌文案、容器宽度 | 通过组件属性与设计令牌调整，不动交互与状态机 |

超出这三处的改动意味着契约被破坏：必须回来改本仓的清单与组件页，并递增 `contract_version`。

## 3. 怎么验

按 `sides.<方向>.verify` 的命令逐条执行，`expect` 写明期望结果。后端组件的验收至少覆盖
健康检查与一次真实任务；前端组件至少覆盖一次提交与实时输出。

## 4. 方向与对端

- `direction` 取 `backend` / `frontend` / `fullstack`，与组件所在领域一致。
- 同一功能有两端时，两页互相链接（`cross_link` 与 `## 对应另一端` 双向一致）；
  只有单一方向的组件不写 `cross_link`。

## 5. 契约版本与迁移

- `contract_version` 用语义化版本。破坏性变更（改字段名、改接口、改事件名）递增主版本。
- 递增版本时必须在组件页的「契约版本与迁移」一节写明迁移步骤，
  并说明已复制到其他项目的用法如何调整。

## 6. 维护规则

- 新增组件：先在 `reuse/<component>/manifest.json` 建清单，再写组件页并引用它。
- 清单里的每个 `path` 必须在仓库中存在；`page` 必须与组件页 frontmatter 的 `reuse_manifest` 互指。
- 机械校验：`npm run check:component`（清单一致）与 `python3 -m pytest tests/test_reuse_manifest.py -q`。
