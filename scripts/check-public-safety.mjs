#!/usr/bin/env node
/**
 * 公开安全门禁：本仓内容会同步到公开代码托管平台，任何内网信息与凭据都不得入库。
 *
 * 规则来源 scripts/data/public-safety-banned.json：
 *   R1 内网域名、R2 内网主机名、R3 私有地址、R4 凭据。
 * 范围：仓库根与 docs/、specs/、schemas/、.specify/ 下的受控文件；二进制与产物目录排除。
 * 例外：banned.json 的 allow 清单，必须写理由，且不得为凭据类开例外（脚本会拒绝）。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const CONFIG = path.join(ROOT, 'scripts/data/public-safety-banned.json')
const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'))

const TEXT_EXT = new Set(['.md', '.mts', '.ts', '.js', '.mjs', '.json', '.yaml', '.yml', '.env', '.sh', '.py', '.txt', '.html'])
const ROOTS = ['docs', 'specs', 'schemas', '.specify', 'scripts', 'diagrams']
const ROOT_FILES = ['README.md', 'AGENTS.md', 'ci.env', 'package.json', 'Dockerfile']

const toGlobRe = (glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*')}$`)

const excluded = config.exclude.map(toGlobRe)
const allowed = config.allow.map((item) => ({ re: toGlobRe(item.glob), reason: item.reason }))
const rules = config.rules.map((rule) => ({ ...rule, re: new RegExp(rule.pattern, 'g') }))

for (const item of config.allow) {
  if (/credential/.test(item.glob)) {
    console.error(`[check-public-safety] 例外不得覆盖凭据类文件：${item.glob}`)
    process.exit(2)
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const rel = path.relative(ROOT, full)
    if (excluded.some((re) => re.test(rel))) continue
    if (entry.isDirectory()) walk(full, out)
    else if (TEXT_EXT.has(path.extname(entry.name))) out.push(rel)
  }
  return out
}

const files = []
for (const dir of ROOTS) {
  const full = path.join(ROOT, dir)
  if (fs.existsSync(full)) walk(full, files)
}
for (const name of ROOT_FILES) {
  const full = path.join(ROOT, name)
  if (fs.existsSync(full) && !files.includes(name)) files.push(name)
}

let hits = 0
for (const rel of files.sort()) {
  const exemption = allowed.find((item) => item.re.test(rel))
  if (exemption) continue
  const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n')
  lines.forEach((line, index) => {
    for (const rule of rules) {
      rule.re.lastIndex = 0
      if (!rule.re.test(line)) continue
      hits += 1
      console.log(`❌ [${rule.id}] ${rel}:${index + 1} 出现${rule.category} → 修法：${rule.fixHint}`)
    }
  })
}

if (hits > 0) {
  console.log(`\n公开安全门禁：命中 ${hits} 处。本仓同步公开托管平台，必须先脱敏再提交。`)
  process.exit(1)
}
console.log(`✅ 公开安全门禁通过（扫描 ${files.length} 个文件，0 命中）。`)
