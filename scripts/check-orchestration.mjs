#!/usr/bin/env node
// 编排技能独立自检：S1–S7，见 check-contract.md §3。
// 用法：node scripts/check-orchestration.mjs
// 参数：--json 与 --export-path FILE。
// 退出码：0 通过，1 有错，2 脚本异常。

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  EXPORT_REL,
  HEADER_FIELDS,
  SKILL_REL,
  bodyFingerprint,
  extractExportPayload,
  parseExportHeader,
  parseSkillVersion,
  readText,
  repoRoot,
} from './export-skill.mjs';

const ROOT = repoRoot();
const CHANGELOG_REL = '.dsh/skills/docs-authoring/CHANGELOG.md';
const LEDGER_REL = 'ledger/orchestration-decisions.tsv';
const BASELINE_REL = 'scripts/ste-lint-zh.baseline';
const LEDGER_HEADER = 'date\titeration\tscope\tdecision\treason\treview';

// skill-contract.md §2：九个必需章节，顺序不可变。
const SECTIONS = [
  '## 何时加载',
  '## 目录落位与命名',
  '## 编排判据',
  '## 每讲教学结构',
  '## 模板',
  '## 工具选用',
  '## 常见错误与修法',
  '## 自检与门禁',
  '## 优先级与变更日志',
];

// 内容契约取值一：页面 frontmatter 字段名，成组出现即判错。
const CONTRACT_FIELDS = [
  'component_type',
  'tags_index',
  'install_command',
  'knowledge_domain',
  'source_module',
  'api_methods',
  'depends_on_knowledge',
  'depends_on_components',
  'related_knowledge',
  'related_components',
  'reusability',
  'entry_type',
];

// 内容契约取值二：受控中文与描述长度阈值。
const CONTRACT_THRESHOLDS = [
  { label: '40 字', re: /40\s*字/ },
  { label: '25 字', re: /25\s*字/ },
  { label: '≤80 字', re: /(≤|<=|不超过|最多)\s*80\s*字/ },
];

// 内容契约取值三：目录树结构字符。
const TREE_RE = /[├└]──|│/;

const DECISIONS = ['writeback', 'no-writeback'];
const REVIEWS = ['-', 'recheck:valid', 'recheck:update'];

const errors = [];
const warnings = [];

function fail(code, subject, line, message, fix) {
  errors.push({ code, subject, line, message, fix });
}

function skip(code, subject, message) {
  warnings.push({ code, subject, message });
}

function readSkill() {
  const file = path.join(ROOT, SKILL_REL);
  if (!existsSync(file)) return { exists: false };
  return { exists: true, file, text: readText(file) };
}

// 标记围栏代码块行，用于区分正文与模板。
function codeFenceMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let token = '';
  for (let index = 0; index < lines.length; index += 1) {
    const matched = lines[index].match(/^\s*(```+|~~~+)/);
    if (token === '') {
      if (matched) {
        token = matched[1][0];
        mask[index] = true;
      }
      continue;
    }
    mask[index] = true;
    if (matched && matched[1][0] === token) token = '';
  }
  return mask;
}

// 行号列表：去重排序，超长时截断。
function formatLines(hits) {
  const unique = [...new Set(hits)].sort((a, b) => a - b);
  if (unique.length <= 6) return `第 ${unique.join('、')} 行`;
  return `第 ${unique.slice(0, 6).join('、')} 行等 ${unique.length} 处`;
}

// S1 技能内取值零复制。
// 只拦内容契约取值，不拦 skill-contract 强制的模板与判据。
function ruleS1(skill) {
  if (!skill.exists) {
    skip('S1', SKILL_REL, '技能文件缺失，已跳过 S1');
    return;
  }
  const lines = skill.text.split('\n');
  const inCode = codeFenceMask(lines);

  const fieldLines = [];
  const distinct = new Set();
  lines.forEach((line, index) => {
    if (inCode[index]) return;
    for (const name of CONTRACT_FIELDS) {
      if (new RegExp(`\\b${name}\\b`).test(line)) {
        fieldLines.push(index + 1);
        distinct.add(name);
      }
    }
  });
  if (distinct.size >= 3) {
    fail(
      'S1',
      SKILL_REL,
      Math.min(...fieldLines),
      `技能正文成组出现 ${distinct.size} 个内容契约字段名（${formatLines(fieldLines)}）`,
      '删掉字段清单，改为指向 content-contract.md 的指针',
    );
  }

  for (const threshold of CONTRACT_THRESHOLDS) {
    const hits = [];
    lines.forEach((line, index) => {
      if (!inCode[index] && threshold.re.test(line)) hits.push(index + 1);
    });
    if (hits.length > 0) {
      fail(
        'S1',
        SKILL_REL,
        Math.min(...hits),
        `技能正文复制内容契约阈值「${threshold.label}」（${formatLines(hits)}）`,
        '改为指针，阈值只在 content-contract.md 维护',
      );
    }
  }

  const treeHits = [];
  lines.forEach((line, index) => {
    if (TREE_RE.test(line)) treeHits.push(index + 1);
  });
  if (treeHits.length > 0) {
    fail(
      'S1',
      SKILL_REL,
      Math.min(...treeHits),
      `技能正文出现目录树结构（${formatLines(treeHits)}）`,
      '删掉目录树，改为规则说明与指针',
    );
  }
}

// S2 章节齐全且有序。
function ruleS2(skill) {
  if (!skill.exists) {
    fail('S2', SKILL_REL, null, '技能文件缺失，九节无法校验', '先落地 .dsh/skills/docs-authoring/SKILL.md');
    return;
  }
  const lines = skill.text.split('\n');
  const found = SECTIONS.map((heading) => ({
    heading,
    at: lines.findIndex((line) => line.trim() === heading),
  }));
  const missing = found.filter((item) => item.at === -1).map((item) => item.heading);
  if (missing.length > 0) {
    fail('S2', SKILL_REL, null, `技能缺少 ${missing.length} 个必需章节：${missing.join('、')}`, '按 skill-contract.md §2 补章节');
  }
  const present = found.filter((item) => item.at !== -1);
  const disordered = [];
  for (let index = 1; index < present.length; index += 1) {
    if (present[index].at < present[index - 1].at) {
      disordered.push(`${present[index - 1].heading} → ${present[index].heading}`);
    }
  }
  if (disordered.length > 0) {
    fail('S2', SKILL_REL, present[0].at + 1, `技能章节顺序有误：${disordered.join('、')}`, '按 skill-contract.md §2 固定顺序排列');
  }
}

// 台账：按字节读，保留 BOM 与换行信息。
function readLedger() {
  const file = path.join(ROOT, LEDGER_REL);
  if (!existsSync(file)) return { exists: false };
  const raw = readFileSync(file);
  const hasBom = raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  const text = raw.toString('utf8').replace(/^\uFEFF/, '');
  const hasCrlf = text.includes('\r\n');
  return { exists: true, hasBom, hasCrlf, lines: text.replace(/\r\n/g, '\n').split('\n') };
}

// S3 台账格式与连续三次规则。
function ruleS3(ledger) {
  if (!ledger.exists) {
    fail('S3', LEDGER_REL, null, '台账文件缺失', '新建台账并写入固定表头与首条记录');
    return;
  }
  if (ledger.hasBom) fail('S3', LEDGER_REL, 1, '文件带 UTF-8 BOM', '去掉 BOM，保存为无 BOM UTF-8');
  if (ledger.hasCrlf) fail('S3', LEDGER_REL, 1, '换行不是 LF', '统一为 LF 换行');

  const lines = ledger.lines;
  if (lines[0] !== LEDGER_HEADER) {
    fail('S3', LEDGER_REL, 1, `表头不符，期望逐字：${LEDGER_HEADER}`, '按契约改写表头，列间用制表符');
  }

  const rows = [];
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNo = index + 1;
    if (line === '') {
      if (!lines.slice(index).every((rest) => rest === '')) {
        fail('S3', LEDGER_REL, lineNo, '空行出现在数据中间', '删掉该空行，数据行连续排列');
      }
      break;
    }
    const cells = line.split('\t');
    if (cells.length !== 6) {
      fail('S3', LEDGER_REL, lineNo, `列数为 ${cells.length}，期望 6`, '补齐或删掉多余列，列间用制表符');
      continue;
    }
    const [date, iteration, scope, decision, reason, review] = cells;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('S3', LEDGER_REL, lineNo, `date「${date}」不是 YYYY-MM-DD`, '改成 ISO 日期格式');
    if (iteration.trim() === '') fail('S3', LEDGER_REL, lineNo, 'iteration 为空', '填写特性编号或迭代标识');
    if (scope.trim() === '') fail('S3', LEDGER_REL, lineNo, 'scope 为空', '填写本次迭代范围');
    else if (scope.length > 80) fail('S3', LEDGER_REL, lineNo, `scope 长 ${scope.length} 字，超过 80 字`, '缩短到 80 字以内');
    if (!DECISIONS.includes(decision)) {
      fail('S3', LEDGER_REL, lineNo, `decision 取值非法「${decision}」`, '只允许 writeback 或 no-writeback');
    }
    if (reason.trim() === '') fail('S3', LEDGER_REL, lineNo, 'reason 为空', '填写判定理由，或按规则写 -');
    else {
      if (reason.length > 80) fail('S3', LEDGER_REL, lineNo, `reason 长 ${reason.length} 字，超过 80 字`, '缩短到 80 字以内');
      if (reason === '-' && decision !== 'writeback') {
        fail('S3', LEDGER_REL, lineNo, 'reason 为 - 只允许出现在 writeback 行', '补一句无需回写的理由');
      }
    }
    if (!REVIEWS.includes(review)) {
      fail('S3', LEDGER_REL, lineNo, `review 取值非法「${review}」`, '只允许 -、recheck:valid、recheck:update');
    }
    rows.push({ lineNo, decision, review });
  }

  let streak = 0;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].review.startsWith('recheck:')) break;
    if (rows[index].decision !== 'no-writeback') break;
    streak += 1;
  }
  if (streak >= 3) {
    const first = rows[rows.length - streak].lineNo;
    const last = rows[rows.length - 1].lineNo;
    fail(
      'S3',
      LEDGER_REL,
      first,
      `连续 ${streak} 次判定无需回写，缺少复核记录（第 ${first}–${last} 行）`,
      '补一条 review=recheck:valid 或 recheck:update 的记录',
    );
  }
}

// S4 指针可达：链接与反引号路径都要能落到盘上。
function ruleS4(skill) {
  if (!skill.exists) {
    skip('S4', SKILL_REL, '技能文件缺失，已跳过 S4');
    return;
  }
  const lines = skill.text.split('\n');
  const candidates = [];
  const collect = (raw, lineNo) => {
    const target = raw.replace(/[#?].*$/, '').replace(/[）)。，、]+$/, '').trim();
    if (target === '') return;
    if (/^(https?:|mailto:|#|\/)/.test(target)) return;
    if (/[<>*]/.test(target)) return;
    if (target.startsWith('build/') || target.startsWith('node_modules/')) return;
    candidates.push({ target, lineNo });
  };
  lines.forEach((line, index) => {
    for (const matched of line.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) collect(matched[1], index + 1);
    // 反引号路径需含斜杠，否则只是文件名举例。
    for (const matched of line.matchAll(/`([^`\s]*\/[^`\s]*\.(?:md|tsv|ya?ml|json|mjs|py|sh|ts|vue|html))`/g)) {
      collect(matched[1], index + 1);
    }
  });

  const missing = [];
  const seen = new Set();
  const skillDir = path.dirname(path.join(ROOT, SKILL_REL));
  for (const item of candidates) {
    const hit = [path.resolve(ROOT, item.target), path.resolve(skillDir, item.target)].some((file) => existsSync(file));
    if (!hit && !seen.has(item.target)) {
      seen.add(item.target);
      missing.push(`${item.target}（第 ${item.lineNo} 行）`);
    }
  }
  if (missing.length > 0) {
    fail('S4', SKILL_REL, null, `失效指针 ${missing.length} 处：${missing.join('、')}`, '改成本仓存在的路径，或删掉该指针');
  }
}

// S5 导出指纹一致。
function ruleS5(skill, exportPath, explicit) {
  const subject = explicit ? exportPath : EXPORT_REL;
  if (!existsSync(exportPath)) {
    if (explicit) {
      fail('S5', subject, null, '导出物不存在', '先运行 node scripts/export-skill.mjs 生成导出物');
    } else {
      skip('S5', EXPORT_REL, '导出物不存在，已跳过 S5（本地未导出属正常）');
    }
    return;
  }
  if (!skill.exists) {
    skip('S5', SKILL_REL, '技能文件缺失，已跳过 S5');
    return;
  }
  const doc = readText(exportPath);
  const header = parseExportHeader(doc);
  if (!header) {
    fail('S5', subject, null, '导出物头部注释缺失或格式不符', '重新运行 node scripts/export-skill.mjs');
    return;
  }
  const missingFields = HEADER_FIELDS.filter((key) => !header[key]);
  if (missingFields.length > 0) {
    fail('S5', subject, null, `导出物头部缺字段：${missingFields.join('、')}`, '重新运行 node scripts/export-skill.mjs');
  }
  // 导出物自身一致：手改正文即判错。
  const artifactBody = doc.replace(/^<!--\n[\s\S]*?\n-->\n?/, '');
  const artifactPrint = bodyFingerprint(artifactBody);
  if (header['body-sha256-16'] && header['body-sha256-16'] !== artifactPrint) {
    fail('S5', subject, null, `导出物正文与头部指纹不符：头部 ${header['body-sha256-16']}，正文 ${artifactPrint}`, '导出物禁止手改，请重新导出');
  }
  const extracted = extractExportPayload(skill.text);
  if (!extracted.ok) {
    fail('S5', SKILL_REL, null, extracted.error, '补齐成对锚点，begin 在前 end 在后');
    return;
  }
  const expected = bodyFingerprint(extracted.payload);
  if (header['body-sha256-16'] !== expected) {
    fail('S5', subject, null, `指纹不符：导出物 ${header['body-sha256-16']}，当前源 ${expected}`, '源已变更，请重新导出');
  }
  const version = parseSkillVersion(skill.text);
  if (version && header['skill-version'] !== version) {
    fail('S5', subject, null, `导出物版本 ${header['skill-version']} 与源 ${version} 不一致`, '源已变更，请重新导出');
  }
}

// 本地日期：YYYY-MM-DD。
function localDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 正文最后修改日期：干净文件取提交日期，脏文件取 mtime。
// 新克隆的 mtime 是检出时刻，直接用会误判。
/**
 * 文件「真实最后修改日期」。
 *
 * 浅克隆里 `git log -- <文件>` 只会返回本次构建的那一个提交，日期会被误当成文件修改日期。
 * 因此浅克隆一律返回 null，由调用方跳过日期比较（不要用 mtime 顶替：克隆时 mtime 是检出时间）。
 */
function lastModifiedDate(file, root) {
  try {
    const shallow = execFileSync('git', ['-C', root, 'rev-parse', '--is-shallow-repository'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (shallow === 'true') return null;
    const status = execFileSync('git', ['-C', root, 'status', '--porcelain', '--', file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (status === '') {
      const committed = execFileSync('git', ['-C', root, 'log', '-1', '--format=%cI', '--', file], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(committed)) return committed.slice(0, 10);
    }
  } catch {
    // 非 git 环境走 mtime。
  }
  return localDate(statSync(file).mtime);
}

// S6 版本与变更日志一致。
function ruleS6(skill) {
  if (!skill.exists) {
    fail('S6', SKILL_REL, null, '技能文件缺失，版本无法校验', '先落地技能正文与 CHANGELOG.md');
    return;
  }
  const version = parseSkillVersion(skill.text);
  if (!version) {
    fail('S6', SKILL_REL, null, '技能正文首部缺少「技能版本：x.y.z」', '在正文首部补版本行');
  }
  const changelogPath = path.join(ROOT, CHANGELOG_REL);
  if (!existsSync(changelogPath)) {
    fail('S6', CHANGELOG_REL, null, '变更日志缺失，无法比对版本', '新建 CHANGELOG.md 并记录首条变更');
    return;
  }
  const changelog = readText(changelogPath);
  const latest = changelog.match(/v?(\d+\.\d+\.\d+)/);
  if (!latest) {
    fail('S6', CHANGELOG_REL, null, '未找到版本号条目', '按倒序追加一条含版本号的记录');
  } else if (version && latest[1] !== version) {
    fail('S6', SKILL_REL, null, `技能版本 ${version} 与变更日志最新条目 ${latest[1]} 不一致`, '同步两处版本号并追加变更记录');
  }
  const dated = changelog.match(/(\d{4}-\d{2}-\d{2})/);
  if (!dated) {
    fail('S6', CHANGELOG_REL, null, '未找到条目日期', '为最新条目补 YYYY-MM-DD 日期');
    return;
  }
  const modified = lastModifiedDate(skill.file, ROOT);
  if (modified === null) {
    skip('S6', CHANGELOG_REL, '浅克隆无法确定技能正文的真实修改日期，已跳过日期比较（CI 请取全量历史）');
    return;
  }
  if (dated[1] < modified) {
    fail('S6', CHANGELOG_REL, null, `变更日志最新日期 ${dated[1]} 早于正文修改日期 ${modified}`, '为本次改动追加一条变更记录');
  }
}

// S7 基线单调：台账记录值只减不增。
function ruleS7(ledger) {
  const baselinePath = path.join(ROOT, BASELINE_REL);
  if (!existsSync(baselinePath)) {
    skip('S7', BASELINE_REL, '基线文件缺失，已跳过 S7');
    return;
  }
  if (!ledger.exists) {
    skip('S7', LEDGER_REL, '台账缺失，无法取 baseline:<N>，已跳过 S7');
    return;
  }
  let recorded = null;
  for (let index = 1; index < ledger.lines.length; index += 1) {
    const cells = ledger.lines[index].split('\t');
    if (cells.length < 6) continue;
    const matched = cells[4].match(/baseline:(\d+)/);
    if (matched) recorded = { value: Number(matched[1]), lineNo: index + 1 };
  }
  if (!recorded) {
    skip('S7', LEDGER_REL, '台账未记录 baseline:<N>，已跳过 S7');
    return;
  }
  const current = readText(baselinePath).match(/(\d+)/);
  if (!current) {
    skip('S7', BASELINE_REL, '基线文件无数值，已跳过 S7');
    return;
  }
  const now = Number(current[1]);
  if (now > recorded.value) {
    fail(
      'S7',
      BASELINE_REL,
      null,
      `基线由 ${recorded.value} 增到 ${now}，与台账第 ${recorded.lineNo} 行记录不符`,
      '基线只减不增。回退基线，或补正式豁免记录',
    );
  }
}

function parseArgs(argv) {
  const options = { json: false, exportPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    else if (arg === '--export-path') {
      index += 1;
      options.exportPath = argv[index] ?? null;
    } else if (arg.startsWith('--export-path=')) options.exportPath = arg.slice('--export-path='.length);
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function resolveExportPath(given) {
  if (!given) return path.join(ROOT, EXPORT_REL);
  return path.isAbsolute(given) ? given : path.join(ROOT, given);
}

function renderLocation(item) {
  return item.line ? `${item.subject}:${item.line}` : item.subject;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const skill = readSkill();
  const ledger = readLedger();
  const exportPath = resolveExportPath(options.exportPath);

  ruleS1(skill);
  ruleS2(skill);
  ruleS3(ledger);
  ruleS4(skill);
  ruleS5(skill, exportPath, Boolean(options.exportPath));
  ruleS6(skill);
  ruleS7(ledger);

  const ok = errors.length === 0;
  if (options.json) {
    const payload = {
      ok,
      errors: errors.map((item) => ({
        code: item.code,
        message: item.message,
        fix: item.fix,
        subject: renderLocation(item),
      })),
      warnings: warnings.map((item) => ({
        code: item.code,
        subject: item.subject,
        message: item.message,
      })),
    };
    console.log(JSON.stringify(payload, null, 2));
    return ok ? 0 : 1;
  }

  for (const item of warnings) {
    console.log(`⚠ [${item.code}] ${item.subject} ${item.message}`);
  }
  for (const item of errors) {
    console.log(`❌ [${item.code}] ${renderLocation(item)} ${item.message} → 修法：${item.fix}`);
  }
  console.log(ok ? `✅ 独立自检通过（S1–S7），警告 ${warnings.length} 条` : `❌ 独立自检未通过，错误 ${errors.length} 条，警告 ${warnings.length} 条`);
  return ok ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`❌ 脚本异常：${error.message}`);
  process.exitCode = 2;
}
