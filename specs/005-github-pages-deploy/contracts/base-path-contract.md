# 契约：基础路径（base-path-contract）

适用对象：站点配置与主题组件。判据来源：`spec.md` 的 FR-002、FR-003、FR-012。

## 1. 取值规则

| 目标 | 取值 | 来源 |
|---|---|---|
| 内网（k3s） | `/` | 默认值，不注入环境变量 |
| 公网（Pages，仓库子路径） | `/docs1/` | 构建时由环境变量注入 |

规则：

- 取值 MUST 以 `/` 开头并以 `/` 结尾；MUST NOT 使用相对路径或空值。
- 取值 MUST 只由构建期注入，MUST NOT 写死在配置里（否则另一目标失效）。
- 两个目标的产物 MUST 来自同一份内容与同一套引擎，MUST NOT 复制内容。

## 2. 链接规则

| 链接来源 | 处理方式 |
|---|---|
| markdown 正文链接（约 119 处） | 由站点框架自动加基础路径前缀，作者不需改写 |
| 组件内动态链接（7 个组件、15 处，值来自引擎） | MUST 在渲染时统一加前缀；MUST NOT 直接输出引擎的根路径 |
| 锚点深链 | 前缀加到路径部分，锚点保持原样 |
| 外部链接 | 保持原样，MUST NOT 加前缀 |

## 3. 产物断言（`npm run check:pages`）

基础路径设为子路径构建后，产物 MUST 满足：

1. 站内链接 MUST 全部带前缀；MUST NOT 出现指向站点根路径的站内链接。
2. 资源引用（样式、脚本、图片、图解）MUST 带前缀。
3. 产物中 MUST NOT 出现内网域名与私有地址字符串。
4. 产物中 MUST NOT 引用外部网络资源（站点自包含）。
5. 产物根 MUST 含 `.nojekyll` 与深链兜底页。

## 4. 深链兜底页

兜底页 MUST 按以下顺序处理未知路径，并保留查询串与锚点：

1. 试 `<path>.html`；
2. 再试 `<path>/index.html`；
3. 都不存在时回到站点首页（带基础路径前缀）。

兜底页 MUST 自包含（不引用外部资源），并 MUST 在无法跳转时给出可点击的首页链接。

## 5. 本地验证

```bash
DOCS1_BASE=/docs1/ npm run build      # 以公网基础路径构建
npm run check:pages                   # 产物断言
python3 -m http.server 4180 -d docs/.vitepress/dist   # 简易静态服务
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4180/backend/learn/concurrency/thread-basics
```

期望：断言全过；深链在本地静态服务下同样走兜底页而不是白屏。
