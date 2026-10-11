# syntax=docker/dockerfile:1
#
# 文档站镜像：多阶段构建（VitePress 构建 → Caddy 托管静态文件）
#   docker build -t docs-1-docs .
#   docker run --rm -p 8080:80 docs-1-docs      # http://127.0.0.1:8080/
#
# 阶段一依次跑六条门禁：内容契约、受控中文、组件自测、门禁自测、零配置扩展、响应式布局。
# 阶段二只留静态产物与 Caddyfile：不含 node_modules、源码与图解源 JSON。

FROM node:22-alpine AS build
WORKDIR /repo

# 受控中文门禁与组件自测都走 python3。
# pytest 必须真的存在，故在 python3 之外补 py3-pytest。
RUN apk add --no-cache python3 py3-pytest

# 依赖单列一层：改内容时命中缓存，不必重装。
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# 门禁一：内容契约（V1–V18）。
RUN npm run check:content
# 门禁二：受控中文（硬违规超过基线即失败）。
RUN npm run check:zh
# 门禁三：组件自测（safe-queue 纯标准库用例）。
RUN python3 -m pytest tests/ -q
# 门禁四：门禁自测（定向破坏夹具，证明规则真的会红）。
RUN npm run selftest:gates
# 门禁五：零配置扩展（新增领域不改引擎与配置）。
RUN npm run check:extensibility
# 站点构建，产物在 docs/.vitepress/dist。
RUN npm run build \
 && test -f docs/.vitepress/dist/index.html
# 门禁六：响应式布局（视口声明、四档断点、宽内容自滚动、无固定大宽度）。
RUN npm run check:responsive
# 门禁七：导航层级（入口层级、子主题、待补标注、作用域侧边栏、顶栏层级）。
RUN npm run check:nav

FROM caddy:2-alpine

COPY --from=build /repo/docs/.vitepress/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
# 存活与就绪都打 /health，由 Caddy 直接返回 200。
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1
