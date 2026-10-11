/**
 * 链接与命名规则（唯一实现）：解析层（Node 侧）与主题（浏览器侧）共用。
 * 规则只有两条：目录/文件名 `NN-前缀` 决定顺序；去掉前缀即 URL 片段。
 */
export interface Segment {
  order: number | null
  slug: string
}

export function parseSegment(segment: string): Segment {
  const matched = /^(\d+)[-_](.+)$/.exec(segment)
  if (matched) return { order: Number(matched[1]), slug: matched[2] }
  return { order: null, slug: segment }
}

export function isIndexSegment(segment: string): boolean {
  return /^(index|readme)$/i.test(segment)
}

/** 一组路径片段 -> URL 片段数组（去掉数字前缀与末尾 index） */
export function urlFromSegments(segments: string[]): string {
  const parts = segments.filter(Boolean)
  const last = parts[parts.length - 1]
  const head = parts.slice(0, -1).map((segment) => parseSegment(segment).slug)
  if (last && !isIndexSegment(last)) head.push(parseSegment(last).slug)
  return '/' + head.join('/')
}

/** 链接规范化：容忍作者写带数字前缀或带 .md 的链接 */
export function normalizeLink(link: string): string {
  const clean = (link || '').trim().replace(/\.md$/i, '').replace(/\/+$/, '')
  if (!clean.startsWith('/')) return clean
  return urlFromSegments(clean.slice(1).split('/').filter(Boolean))
}
