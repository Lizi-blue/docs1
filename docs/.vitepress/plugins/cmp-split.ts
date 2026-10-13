/**
 * 组件页双栏布局（引擎侧自动完成，作者不写布局代码）。
 *
 * 规则：组件页正文里出现二级标题「其他项目如何引用」或「引用方式」时，
 * 该标题及其之后的内容自动进入右栏，之前的内容留在左栏。
 * 左栏 = 简介 + 知识点 + 图解 + 源码；右栏 = 引用方式。
 *
 * 注意：core 规则必须返回 true / undefined 才会继续执行后续 core 规则。
 * 早先两次都写 return false，等于中断整条 core 链，
 * 使 VitePress 的 headers 采集永不执行 —— 全站右栏目录因此长期为空。
 */
import type MarkdownIt from 'markdown-it'

const SPLIT_TITLES = ['其他项目如何引用', '引用方式']

export function cmpSplit(md: MarkdownIt): void {
  md.core.ruler.push('docs1_cmp_split', (state) => {
    const tokens = state.tokens
    let splitIndex = -1
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index]
      if (token.type !== 'heading_open' || token.tag !== 'h2') continue
      const inline = tokens[index + 1]
      // VitePress 的标题插件会追加锚点与零宽空格，先归一化再比较
      const text = (inline?.children ?? [])
        .map((child) => child.content)
        .join('')
        .replace(/&ZeroWidthSpace;/g, '')
        .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
        .replace(/^#+\s*/, '')
        .trim()
      if (SPLIT_TITLES.some((title) => text === title || text.startsWith(`${title}：`))) {
        splitIndex = index
        break
      }
    }
    if (splitIndex < 0) return true

    const html = (content: string) => {
      const token = new state.Token('html_block', '', 0)
      token.content = content
      token.block = true
      return token
    }
    tokens.unshift(html('<div class="cmp-grid">\n<div class="cmp-main">\n'))
    tokens.splice(splitIndex + 1, 0, html('</div>\n<div class="cmp-aside">\n'))
    tokens.push(html('</div>\n</div>\n'))
    return true
  })
}
