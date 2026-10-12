#!/usr/bin/env node
/**
 * pages-extra —— 给 GitHub Pages 产物补两件东西（005 T002/T008）。
 *
 *   1. `<dist>/.nojekyll`：空文件，让 Pages 跳过 Jekyll 处理。
 *   2. `<dist>/404.html`：自包含深链兜底页。
 *      算法：取 location.pathname，去掉 base 前缀后依次试
 *      `<path>.html` → `<path>/index.html` → 回站点首页，全程保留查询串与锚点。
 *
 * 用法：node scripts/pages-extra.mjs [--dist docs/.vitepress/dist] [--base /docs1/]
 * 退出码：0 成功 / 1 失败（打印可读原因）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function fail(message) {
  console.error(`[pages-extra] ${message}`)
  process.exit(1)
}

function resolveBase(raw) {
  const value = raw ?? process.env.DOCS1_BASE ?? '/'
  if (!value.startsWith('/') || !value.endsWith('/')) {
    fail(`base 必须以 / 开头并以 / 结尾，当前：${value}`)
  }
  return value
}

/** 兜底页：内联样式与内联脚本，不引用任何外部资源。 */
function fallbackPage(base) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>页面跳转中</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
        font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans SC", sans-serif;
        background: #ffffff; color: #1f2328;
      }
      @media (prefers-color-scheme: dark) { body { background: #0d1117; color: #e6edf3; } }
      main { max-width: 32rem; padding: 2rem; text-align: center; }
      h1 { font-size: 1.25rem; margin: 0 0 0.75rem; }
      p { margin: 0.5rem 0; line-height: 1.7; }
      a { color: #1a56db; }
      .path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
    </style>
  </head>
  <body>
    <main>
      <h1>正在定位页面</h1>
      <p id="status">正在尝试把 <span class="path" id="requested"></span> 转到对应页面。</p>
      <p><a id="home" href="${base}">回到站点首页</a></p>
    </main>
    <script>
      (function () {
        var BASE = ${JSON.stringify(base)};
        var status = document.getElementById('status');
        var requested = document.getElementById('requested');
        var suffix = (location.search || '') + (location.hash || '');
        var here = location.pathname || '/';
        requested.textContent = here + suffix;

        // 去掉 base 前缀，换成相对路径；再把尾部斜杠去掉，便于拼 .html
        var rest = here;
        if (BASE !== '/' && rest.indexOf(BASE) === 0) rest = '/' + rest.slice(BASE.length);
        var clean = rest.replace(/\\/+$/, '');
        var relative = clean === '/' ? '' : clean.replace(/^\\//, '');

        var candidates = [];
        if (relative) {
          candidates.push(BASE + relative + '.html');
          candidates.push(BASE + relative + '/index.html');
        }
        candidates.push(BASE);

        function show(text) {
          if (status) status.textContent = text;
        }

        function go(index) {
          if (index >= candidates.length) {
            show('没有找到对应页面。请从下面的链接回到首页。');
            return;
          }
          var target = candidates[index];
          fetch(target, { method: 'HEAD', cache: 'no-store' })
            .then(function (response) {
              if (response && response.ok) {
                location.replace(target + suffix);
                return;
              }
              go(index + 1);
            })
            .catch(function () {
              // fetch 不可用或网络失败时退到下一候选，最后给可点击首页
              go(index + 1);
            });
        }

        go(0);
      })();
    </script>
  </body>
</html>
`
}

function main() {
  const args = process.argv.slice(2)
  const distIndex = args.indexOf('--dist')
  const baseIndex = args.indexOf('--base')
  const distArg = distIndex >= 0 ? args[distIndex + 1] : 'docs/.vitepress/dist'
  const dist = path.isAbsolute(distArg) ? distArg : path.join(REPO_ROOT, distArg)
  const base = resolveBase(baseIndex >= 0 ? args[baseIndex + 1] : undefined)

  if (!fs.existsSync(dist) || !fs.statSync(dist).isDirectory()) {
    fail(`产物目录不存在：${dist}，先跑 npm run build`)
  }

  const nojekyll = path.join(dist, '.nojekyll')
  fs.writeFileSync(nojekyll, '')
  const fallback = path.join(dist, '404.html')
  fs.writeFileSync(fallback, fallbackPage(base), 'utf8')

  console.log(`[pages-extra] base=${base}`)
  console.log(`[pages-extra] 写入 ${path.relative(REPO_ROOT, nojekyll)}`)
  console.log(`[pages-extra] 写入 ${path.relative(REPO_ROOT, fallback)}`)
  return 0
}

try {
  process.exit(main())
} catch (error) {
  fail(`脚本异常：${error.message}`)
}
