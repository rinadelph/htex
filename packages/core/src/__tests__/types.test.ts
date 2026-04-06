// types.test.ts — runtime verification of the types module structure
import { describe, it, expect } from 'bun:test'
import {
  TokenKind,
  DEFAULT_FONT_CONFIG,
  HtexError,
  ParseError,
  TransformError,
  MeasureError,
  RenderError,
} from '../types.js'
import { visitAll } from '../types.verify.js'

describe('TokenKind enum', () => {
  it('has all 16 required variants', () => {
    const required = [
      'COMMAND', 'ENV_BEGIN', 'ENV_END', 'TEXT',
      'MATH_INLINE', 'MATH_DISPLAY', 'LBRACE', 'RBRACE',
      'LBRACKET', 'RBRACKET', 'AMPERSAND', 'NEWLINE',
      'COMMENT', 'WHITESPACE', 'VERBATIM', 'EOF',
    ]
    for (const v of required) {
      expect(TokenKind[v as keyof typeof TokenKind]).toBe(v)
    }
  })

  it('has exactly 16 variants (no extras)', () => {
    expect(Object.keys(TokenKind).length).toBe(16)
  })
})

describe('DEFAULT_FONT_CONFIG', () => {
  it('has all required fields', () => {
    expect(typeof DEFAULT_FONT_CONFIG.body).toBe('string')
    expect(typeof DEFAULT_FONT_CONFIG.heading).toBe('string')
    expect(typeof DEFAULT_FONT_CONFIG.mono).toBe('string')
    expect(typeof DEFAULT_FONT_CONFIG.lineHeight).toBe('number')
    expect(DEFAULT_FONT_CONFIG.lineHeight).toBeGreaterThan(0)
  })
})

describe('Error classes', () => {
  it('HtexError is an Error subclass', () => {
    const e = new HtexError('test')
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(HtexError)
    expect(e.name).toBe('HtexError')
    expect(e.message).toBe('test')
  })

  it('ParseError carries line and col', () => {
    const e = new ParseError('unexpected token', 5, 12, 'inside tabular')
    expect(e).toBeInstanceOf(HtexError)
    expect(e.name).toBe('ParseError')
    expect(e.line).toBe(5)
    expect(e.col).toBe(12)
    expect(e.message).toContain('5')
    expect(e.message).toContain('12')
    expect(e.context).toBe('inside tabular')
  })

  it('TransformError carries nodeType', () => {
    const e = new TransformError('unknown env', 'environment')
    expect(e).toBeInstanceOf(HtexError)
    expect(e.nodeType).toBe('environment')
  })

  it('MeasureError carries font', () => {
    const e = new MeasureError('font not loaded', '16px Inter')
    expect(e.font).toBe('16px Inter')
  })

  it('RenderError carries renderTarget', () => {
    const e = new RenderError('invalid node', 'html')
    expect(e.renderTarget).toBe('html')
  })
})

describe('RenderNode exhaustiveness (via visitAll)', () => {
  it('handles document node without throwing', () => {
    expect(() => visitAll({
      type: 'document',
      metadata: { documentClass: 'article', colors: [] },
      children: [],
    })).not.toThrow()
  })

  it('handles text node', () => {
    expect(() => visitAll({ type: 'text', content: 'hello' })).not.toThrow()
  })

  it('handles mathInline node', () => {
    expect(() => visitAll({ type: 'mathInline', latex: 'x^2' })).not.toThrow()
  })

  it('handles mathDisplay node', () => {
    expect(() => visitAll({ type: 'mathDisplay', latex: '\\int_0^1' })).not.toThrow()
  })

  it('handles customBox node', () => {
    expect(() => visitAll({
      type: 'customBox',
      label: 'insight',
      borderColor: '#58A6FF',
      bgColor: 'transparent',
      children: [],
    })).not.toThrow()
  })

  it('handles tikz node', () => {
    expect(() => visitAll({ type: 'tikz', rawSource: '\\begin{tikzpicture}\\end{tikzpicture}' })).not.toThrow()
  })

  it('handles tableCell node with colspan/rowspan', () => {
    expect(() => visitAll({
      type: 'tableCell',
      colspan: 2,
      rowspan: 1,
      align: 'center',
      children: [],
    })).not.toThrow()
  })

  it('handles all 29 node types via switch', () => {
    const allNodes: Parameters<typeof visitAll>[0][] = [
      { type: 'document', metadata: { documentClass: 'article', colors: [] }, children: [] },
      { type: 'section', level: 1, title: [], number: '1', id: 'section-1', children: [] },
      { type: 'paragraph', children: [] },
      { type: 'text', content: '' },
      { type: 'bold', children: [] },
      { type: 'italic', children: [] },
      { type: 'color', color: '#fff', children: [] },
      { type: 'table', children: [] },
      { type: 'tableRow', isHeader: false, children: [] },
      { type: 'tableCell', colspan: 1, rowspan: 1, align: 'left', children: [] },
      { type: 'tableRule', ruleKind: 'mid' },
      { type: 'figure', children: [] },
      { type: 'image', src: 'fig.pdf' },
      { type: 'caption', children: [] },
      { type: 'mathInline', latex: 'x' },
      { type: 'mathDisplay', latex: 'x' },
      { type: 'codeBlock', code: '', language: '' },
      { type: 'list', ordered: false, children: [] },
      { type: 'listItem', children: [] },
      { type: 'customBox', label: 'x', borderColor: '#000', bgColor: '#fff', children: [] },
      { type: 'link', href: '#', children: [] },
      { type: 'reference', targetId: 'sec:1', resolvedText: '1' },
      { type: 'toc', entries: [] },
      { type: 'titlePage', children: [] },
      { type: 'center', children: [] },
      { type: 'abstract', children: [] },
      { type: 'tikz', rawSource: '' },
      { type: 'plot', rawSource: '' },
      { type: 'hRule' },
      { type: 'pageBreak' },
    ]
    for (const node of allNodes) {
      expect(() => visitAll(node)).not.toThrow()
    }
    expect(allNodes.length).toBe(30) // 30 node types in union
  })
})

describe('Type constraints (checked at compile time, confirmed at runtime)', () => {
  it('ColorRenderNode color field is a hex string (semantic, no raw LaTeX name)', () => {
    const node: import('../types.js').ColorRenderNode = {
      type: 'color',
      color: '#58A6FF',
      children: [],
    }
    expect(node.color).toMatch(/^#[0-9A-Fa-f]{3,8}$/)
  })

  it('CustomBoxNode borderColor is hex string', () => {
    const node: import('../types.js').CustomBoxRenderNode = {
      type: 'customBox',
      label: 'bluebox',
      borderColor: '#4493F8',
      bgColor: '#0D1117',
      children: [],
    }
    expect(node.borderColor).toMatch(/^#/)
    expect(node.bgColor).toMatch(/^#/)
  })

  it('TableCellNode has numeric colspan and rowspan', () => {
    const node: import('../types.js').TableCellRenderNode = {
      type: 'tableCell',
      colspan: 3,
      rowspan: 2,
      align: 'center',
      children: [],
    }
    expect(typeof node.colspan).toBe('number')
    expect(typeof node.rowspan).toBe('number')
  })

  it('MathInlineNode latex field carries raw string', () => {
    const node: import('../types.js').MathInlineRenderNode = {
      type: 'mathInline',
      latex: '\\frac{a}{b} + \\sum_{i=0}^{n} i',
    }
    expect(node.latex).toContain('\\frac')
  })
})
