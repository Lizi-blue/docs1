#!/usr/bin/env bash
# 图解生成：从 diagrams/src/*.json（可编辑源）生成 docs/public/diagrams/*.html（自包含交互 HTML）。
#
# 前置：
#   · Node >= 18
#   · 本地有 Archify 检出：git clone https://github.com/tt-a1i/archify .tools/archify
#     或设置 ARCHIFY_DIR 指向已有检出
#
# 用法：
#   ARCHIFY_DIR=/path/to/archify bash scripts/gen-diagrams.sh
#
# 产物入库（docs/public/diagrams/），CI 不联网生成，只校验产物存在。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIFY_DIR="${ARCHIFY_DIR:-$ROOT/.tools/archify}"
CLI="$ARCHIFY_DIR/archify/bin/archify.mjs"

if [ ! -f "$CLI" ]; then
  echo "缺少 Archify CLI：$CLI" >&2
  echo "修法：git clone --depth 1 https://github.com/tt-a1i/archify \"$ROOT/.tools/archify\"" >&2
  echo "或：ARCHIFY_DIR=<已有检出> bash scripts/gen-diagrams.sh" >&2
  exit 1
fi

mkdir -p "$ROOT/docs/public/diagrams"
for src in "$ROOT"/diagrams/src/*.json; do
  [ -e "$src" ] || { echo "diagrams/src 下没有源文件"; exit 1; }
  name="$(basename "$src" .json)"
  # 输出路径以 IR 的 meta.output 为准，避免文件名与产物名漂移
  type="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["diagram_type"])' "$src")"
  rel_out="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["meta"]["output"])' "$src")"
  out="$ROOT/$rel_out"
  echo "==> $name ($type) -> $rel_out"
  node "$CLI" deliver "$type" "$src" "$out" --quality showcase --json
done
echo "完成：$ROOT/docs/public/diagrams"
