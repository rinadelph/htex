// =============================================================================
// @htex/core — __tests__/api.test.ts
// Tests for the high-level convenience API (latexToHtml, latexToSvg, etc.)
// and the public index exports.
// =============================================================================

import { describe, it, expect } from 'bun:test'
import {
  VERSION,
  latexToHtml,
  latexToSvg,
  latexToRenderTree,
  tokenize,
  parse,
  transform,
  renderToHtml,
  renderToSvg,
} from '../index.js'

const SIMPLE = '\\begin{document}Hello world\\end{document}'
const FULL = '\\documentclass{article}\\title{Test}\\begin{document}\\maketitle\\section{Intro}Hello $x^2$.\\end{document}'

describe('Public API: version', () => {
  it('[VR] VERSION is a semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('Public API: latexToHtml', () => {
  it('[VR] produces HTML5 doctype by default', () => {
    expect(latexToHtml(SIMPLE)).toMatch(/^<!DOCTYPE html>/i)
  })

  it('[VR] standalone=false produces a fragment', () => {
    const frag = latexToHtml(SIMPLE, { standalone: false })
    expect(frag).not.toContain('<!DOCTYPE')
    // Fragment prepends a <style> block then the document div
    expect(frag).toContain('<div class="htex-document"')
  })

  it('[VR] theme=dark respected', () => {
    expect(latexToHtml(SIMPLE, { theme: 'dark' })).toContain('data-theme="dark"')
  })

  it('[VR] title from \\title ends up in <title>', () => {
    expect(latexToHtml(FULL)).toContain('<title>Test</title>')
  })

  it('[VR] section heading appears in output', () => {
    const html = latexToHtml(FULL)
    expect(html).toContain('<h1>')
    expect(html).toContain('Intro')
  })

  it('[VR] math rendered with KaTeX (produces MathML)', () => {
    // KaTeX output produces MathML, not \\( delimiter
    expect(latexToHtml(FULL)).toContain('<math')
    expect(latexToHtml(FULL)).toContain('htex-math-inline')
  })

  it('[VR] does not throw on empty string', () => {
    expect(() => latexToHtml('')).not.toThrow()
  })

  it('[VR] does not throw on malformed LaTeX', () => {
    expect(() => latexToHtml('\\begin{document}\\end{}')).not.toThrow()
  })
})

describe('Public API: latexToSvg', () => {
  it('[VR] produces SVG with xml declaration by default', () => {
    expect(latexToSvg(SIMPLE)).toMatch(/^<\?xml/)
  })

  it('[VR] standalone=false gives just <svg>', () => {
    const svg = latexToSvg(SIMPLE, { standalone: false })
    expect(svg).not.toContain('<?xml')
    expect(svg).toMatch(/^<svg/)
  })

  it('[VR] svgWidth option is applied', () => {
    expect(latexToSvg(SIMPLE, { svgWidth: 1100 })).toContain('width="1100"')
  })

  it('[VR] does not throw on empty string', () => {
    expect(() => latexToSvg('')).not.toThrow()
  })
})

describe('Public API: latexToRenderTree', () => {
  it('[VR] returns an array', () => {
    const tree = latexToRenderTree(SIMPLE)
    expect(Array.isArray(tree)).toBe(true)
  })

  it('[VR] first element is document node', () => {
    expect(latexToRenderTree(SIMPLE)[0]?.type).toBe('document')
  })

  it('[VR] tree can be re-rendered to HTML and SVG', () => {
    const tree = latexToRenderTree(FULL)
    const html = renderToHtml(tree, { standalone: false })
    const svg = renderToSvg(tree, { standalone: false })
    expect(html).toContain('<h1>')
    expect(svg).toContain('<svg')
  })

  it('[VR] render tree is stable (same input → same output)', () => {
    const a = latexToHtml(FULL)
    const b = latexToHtml(FULL)
    expect(a).toBe(b)
  })
})

describe('Public API: pipeline composability', () => {
  it('[VR] tokenize → parse → transform → renderToHtml matches latexToHtml', () => {
    const tokens = tokenize(FULL)
    const ast = parse(tokens)
    const tree = transform(ast)
    const html = renderToHtml(tree, { standalone: false })
    const direct = latexToHtml(FULL, { standalone: false })
    expect(html).toBe(direct)
  })

  it('[VR] tokenize returns non-empty token array', () => {
    expect(tokenize(FULL).length).toBeGreaterThan(5)
  })

  it('[VR] parse produces DocumentAST with preamble and body', () => {
    const ast = parse(tokenize(FULL))
    expect(ast.preamble).toBeDefined()
    expect(Array.isArray(ast.body)).toBe(true)
  })

  it('[VR] transform accepts empty DocumentAST without crashing', () => {
    const ast = parse(tokenize(''))
    expect(() => transform(ast)).not.toThrow()
  })
})

describe('Public API: BrickellQuant end-to-end', () => {
  const { readFileSync } = require('fs')
  const ARCH = '/home/swarm/BrickellQuant/report/brickellquant_architecture.tex'

  it('[VR] latexToHtml on brickellquant_architecture works', () => {
    const html = latexToHtml(readFileSync(ARCH, 'utf8'))
    expect(html).toMatch(/^<!DOCTYPE html>/i)
    expect(html.length).toBeGreaterThan(1000)
  })

  it('[VR] latexToSvg on brickellquant_architecture works', () => {
    const svg = latexToSvg(readFileSync(ARCH, 'utf8'))
    expect(svg).toMatch(/^<\?xml/)
    expect(svg.length).toBeGreaterThan(1000)
  })

  it('[VR] latexToRenderTree on brickellquant_architecture produces sections', () => {
    const tree = latexToRenderTree(readFileSync(ARCH, 'utf8'))
    const flattenTypes = (nodes: any[]): string[] =>
      nodes.flatMap(n => [n.type, ...(n.children ? flattenTypes(n.children) : [])])
    const types = flattenTypes(Array.from(tree))
    expect(types).toContain('section')
    expect(types).toContain('table')
    expect(types).toContain('customBox')
  })
})
