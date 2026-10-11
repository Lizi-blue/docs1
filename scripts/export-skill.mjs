#!/usr/bin/env node
// 技能导出：抽取导出正文，归一化，算指纹，写七字段头部。
// 用法：node scripts/export-skill.mjs
// 产物路径见 EXPORT_REL。

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SKILL_REL = '.dsh/skills/docs-authoring/SKILL.md';
export const CHANGELOG_REL = '.dsh/skills/docs-authoring/CHANGELOG.md';
export const EXPORT_REL = 'build/skill-export/docs-authoring/SKILL.md';
export const EXPORTED_FROM = 'dev/docs-1';
export const DO_NOT_EDIT = '本文件由 scripts/export-skill.mjs 生成，手改会被自检判错';

// 头部字段顺序固定，见 export-contract.md §4。
export const HEADER_FIELDS = [
  'exported-from',
  'source-path',
  'source-commit',
  'skill-version',
  'body-sha256-16',
  'exported-at',
  'do-not-edit',
];

const BEGIN = '<!-- export:begin -->';
const END = '<!-- export:end -->';

// 仓根：本脚本所在目录的上级。
export function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

// 读文本：去 BOM，统一 LF。
export function readText(file) {
  return readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

// 归一化：LF、去行尾空白、去首尾空行、末尾补一个换行。
export function normalizeBody(text) {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''));
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return `${lines.join('\n')}\n`;
}

// 指纹：归一化正文的 sha256 十六进制前 16 位。
export function bodyFingerprint(text) {
  return createHash('sha256').update(normalizeBody(text), 'utf8').digest('hex').slice(0, 16);
}

// 导出正文 = 锚点前头部 + 锚点区间正文。
// 锚点外的 frontmatter 与版本行也要进产物，产物才可加载。
export function extractExportPayload(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const begin = lines.findIndex((line) => line.trim() === BEGIN);
  const end = lines.findIndex((line) => line.trim() === END);
  if (begin === -1 || end === -1) return { ok: false, error: '导出锚点缺失，需成对出现' };
  if (begin >= end) return { ok: false, error: '导出锚点顺序颠倒，begin 需在 end 之前' };
  const head = lines.slice(0, begin);
  const region = lines.slice(begin + 1, end);
  return { ok: true, payload: [...head, ...region].join('\n'), headLines: head.length, regionLines: region.length };
}

// 技能版本：取正文首部「技能版本：x.y.z」。
export function parseSkillVersion(source) {
  const matched = source.match(/技能版本\s*[:：]\s*v?(\d+\.\d+\.\d+)/);
  return matched ? matched[1] : null;
}

// 头部字段：解析导出物顶部 HTML 注释块。
export function parseExportHeader(source) {
  const matched = source.match(/^<!--\n([\s\S]*?)\n-->/);
  if (!matched) return null;
  const fields = {};
  for (const line of matched[1].split('\n')) {
    const at = line.indexOf(':');
    if (at === -1) continue;
    fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return fields;
}

// ISO 8601 时间：带本地时区偏移。
export function isoWithOffset(date) {
  const pad = (value) => String(Math.abs(value)).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const hours = pad(Math.floor(Math.abs(offset) / 60));
  const minutes = pad(Math.abs(offset) % 60);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${day}T${clock}${sign}${hours}:${minutes}`;
}

// 源提交：取当前 HEAD，失败则给全零占位。
export function headCommit(root) {
  try {
    const sha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return /^[0-9a-f]{40}$/.test(sha) ? sha : '0'.repeat(40);
  } catch {
    return '0'.repeat(40);
  }
}

// 组装头部注释：字段顺序固定。
export function buildHeader(fields) {
  const body = HEADER_FIELDS.map((key) => `${key}: ${fields[key]}`);
  return ['<!--', ...body, '-->'].join('\n');
}

function writeExport(root, fields) {
  const content = `${buildHeader(fields)}\n${fields.body}\n`;
  const outPath = path.join(root, EXPORT_REL);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, 'utf8');
  return outPath;
}

function main() {
  const root = repoRoot();
  const skillPath = path.join(root, SKILL_REL);
  if (!existsSync(skillPath)) {
    console.error(`❌ 源技能文件不存在：${SKILL_REL}`);
    return 1;
  }
  const source = readText(skillPath);
  const extracted = extractExportPayload(source);
  if (!extracted.ok) {
    console.error(`❌ ${extracted.error}`);
    return 1;
  }
  const version = parseSkillVersion(source);
  if (!version) {
    console.error('❌ 技能版本缺失，正文首部需写「技能版本：x.y.z」');
    return 1;
  }
  const body = normalizeBody(extracted.payload);
  const fields = {
    'exported-from': EXPORTED_FROM,
    'source-path': SKILL_REL,
    'source-commit': headCommit(root),
    'skill-version': version,
    'body-sha256-16': bodyFingerprint(body),
    'exported-at': isoWithOffset(new Date()),
    'do-not-edit': DO_NOT_EDIT,
    body,
  };
  const outPath = writeExport(root, fields);
  console.log(`✅ 已导出 ${EXPORT_REL}`);
  console.log(`   版本 ${version}，指纹 ${fields['body-sha256-16']}，提交 ${fields['source-commit'].slice(0, 12)}`);
  console.log(`   写入 ${outPath}`);
  return 0;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`❌ 脚本异常：${error.message}`);
    process.exitCode = 2;
  }
}
