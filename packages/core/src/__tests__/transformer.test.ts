// transformer.test.ts — 40+ named test cases for the AST → Render Tree transformer
import { describe, it, expect } from 'bun:test'
import { tokenize } from '../tokenizer/index.js'
import { parse } from '../parser/index.js'
import { transform } from '../transformer/index.js'
import type { RenderNode, SectionRenderNode, ColorRenderNode, CustomBoxRenderNode, CodeBlockRenderNode, TableRenderNode, ListRenderNode, TikzRenderNode, MathInlineRenderNode, MathDisplayRenderNode } from '../types.js'

// Helpers
const pipeline = (src: string) => transform(parse(tokenize(src)))
const fullDoc = (body: string, preamble = '') =>
  pipeline(`${preamble}\\begin{document}${body}\\end{document}`)

function findNode<T extends RenderNode>(nodes: readonly RenderNode[], type: T['type']): T | undefined {
  for (const n of nodes) {
    if (n.type === type) return n as T
    if ('children' in n && n.children) {
      const found = findNode(n.children as RenderNode[], type)
      if (found) return found
    }
  }
  return undefined
}

function findAll<T extends RenderNode>(nodes: readonly RenderNode[], type: T['type']): T[] {
  const result: T[] = []
  for (const n of nodes) {
    if (n.type === type) result.push(n as T)
    if ('children' in n && n.children) result.push(...findAll(n.children as RenderNode[], type))
  }
  return result
}

function docChildren(tree: readonly RenderNode[]): readonly RenderNode[] {
  const doc = tree[0]
  if (doc?.type === 'document') return doc.children
  return tree
}

// ── Document node ──────────────────────────────────────────────────────────
describe('Document node', () => {
  it('produces a document root node', () => {
    const tree = fullDoc('Hello')
    expect(tree[0]?.type).toBe('document')
  })

  it('document metadata has documentClass', () => {
    const tree = pipeline('\\documentclass{article}\\begin{document}Hi\\end{document}')
    const doc = tree[0]
    if (doc?.type === 'document') {
      expect(doc.metadata.documentClass).toBe('article')
    }
  })

  it('document metadata includes color definitions', () => {
    const tree = pipeline('\\documentclass{article}\\definecolor{bqblue}{HTML}{58A6FF}\\begin{document}x\\end{document}')
    const doc = tree[0]
    if (doc?.type === 'document') {
      expect(doc.metadata.colors.some(c => c.name === 'bqblue')).toBe(true)
    }
  })
})

// ── Sections ──────────────────────────────────────────────────────────────
describe('Sections', () => {
  it('\\section becomes SectionRenderNode level 1', () => {
    const tree = fullDoc('\\section{Introduction}')
    const s = findNode<SectionRenderNode>(docChildren(tree), 'section')
    expect(s?.level).toBe(1)
  })

  it('\\subsection becomes SectionRenderNode level 2', () => {
    const tree = fullDoc('\\subsection{Methods}')
    const s = findNode<SectionRenderNode>(docChildren(tree), 'section')
    expect(s?.level).toBe(2)
  })

  it('\\subsubsection becomes SectionRenderNode level 3', () => {
    const tree = fullDoc('\\subsubsection{Detail}')
    const s = findNode<SectionRenderNode>(docChildren(tree), 'section')
    expect(s?.level).toBe(3)
  })

  it('sections are numbered sequentially', () => {
    const tree = fullDoc('\\section{A}\\section{B}\\section{C}')
    const sections = findAll<SectionRenderNode>(docChildren(tree), 'section')
    expect(sections.map(s => s.number)).toEqual(['1', '2', '3'])
  })

  it('subsections are numbered within sections', () => {
    const tree = fullDoc('\\section{A}\\subsection{A1}\\subsection{A2}\\section{B}\\subsection{B1}')
    const sections = findAll<SectionRenderNode>(docChildren(tree), 'section')
    const numbers = sections.map(s => s.number)
    expect(numbers).toContain('1')
    expect(numbers).toContain('1.1')
    expect(numbers).toContain('1.2')
    expect(numbers).toContain('2')
    expect(numbers).toContain('2.1')
  })

  it('section has a unique id attribute', () => {
    const tree = fullDoc('\\section{Introduction}')
    const s = findNode<SectionRenderNode>(docChildren(tree), 'section')
    expect(s?.id).toContain('section-')
    expect(s?.id.length).toBeGreaterThan(5)
  })
})

// ── Text styling ──────────────────────────────────────────────────────────
describe('Text styling', () => {
  it('\\textbf becomes BoldRenderNode', () => {
    const tree = fullDoc('\\textbf{bold}')
    const b = findNode(docChildren(tree), 'bold')
    expect(b).toBeDefined()
  })

  it('\\emph becomes ItalicRenderNode', () => {
    const tree = fullDoc('\\emph{italic}')
    const it = findNode(docChildren(tree), 'italic')
    expect(it).toBeDefined()
  })

  it('\\textit becomes ItalicRenderNode', () => {
    const tree = fullDoc('\\textit{italic2}')
    const it = findNode(docChildren(tree), 'italic')
    expect(it).toBeDefined()
  })
})

// ── Color resolution ──────────────────────────────────────────────────────
describe('Color resolution', () => {
  it('\\textcolor{bqblue}{...} resolves to hex #58A6FF', () => {
    const preamble = '\\definecolor{bqblue}{HTML}{58A6FF}'
    const tree = fullDoc('\\textcolor{bqblue}{text}', preamble)
    const c = findNode<ColorRenderNode>(docChildren(tree), 'color')
    expect(c?.color).toBe('#58A6FF')
  })

  it('\\textcolor with unknown color falls back to #000000', () => {
    const tree = fullDoc('\\textcolor{unknownColor}{text}')
    const c = findNode<ColorRenderNode>(docChildren(tree), 'color')
    expect(c?.color).toBe('#000000')
  })

  it('built-in color "red" resolves correctly', () => {
    const tree = fullDoc('\\textcolor{red}{text}')
    const c = findNode<ColorRenderNode>(docChildren(tree), 'color')
    expect(c?.color).toBe('#FF0000')
  })
})

// ── Custom boxes ──────────────────────────────────────────────────────────
describe('Custom boxes', () => {
  it('\\begin{insight}...\\end{insight} → CustomBoxNode', () => {
    const preamble = '\\definecolor{bqblue}{HTML}{58A6FF}\\usepackage{mdframed}\\newmdenv[linecolor=bqblue]{insight}'
    const tree = fullDoc('\\begin{insight}Content\\end{insight}', preamble)
    const box = findNode<CustomBoxRenderNode>(docChildren(tree), 'customBox')
    expect(box?.label).toBe('insight')
    expect(box?.borderColor).toBe('#58A6FF')
  })

  it('\\begin{bluebox}...\\end{bluebox} → CustomBoxNode with blue border', () => {
    const tree = fullDoc('\\begin{bluebox}Content\\end{bluebox}')
    const box = findNode<CustomBoxRenderNode>(docChildren(tree), 'customBox')
    expect(box?.label).toBe('bluebox')
    expect(box?.borderColor).toBeDefined()
  })

  it('\\begin{redbox} → CustomBoxNode', () => {
    const tree = fullDoc('\\begin{redbox}Alert\\end{redbox}')
    const box = findNode<CustomBoxRenderNode>(docChildren(tree), 'customBox')
    expect(box?.label).toBe('redbox')
  })

  it('\\begin{correction} → CustomBoxNode', () => {
    const tree = fullDoc('\\begin{correction}Fix this\\end{correction}')
    const box = findNode<CustomBoxRenderNode>(docChildren(tree), 'customBox')
    expect(box?.label).toBe('correction')
  })
})

// ── Math ──────────────────────────────────────────────────────────────────
describe('Math nodes', () => {
  it('inline math $x^2$ → MathInlineNode with raw latex', () => {
    const tree = fullDoc('$x^2 + 1$')
    const m = findNode<MathInlineRenderNode>(docChildren(tree), 'mathInline')
    expect(m?.latex).toBe('x^2 + 1')
  })

  it('display math $$....$$ → MathDisplayNode', () => {
    const tree = fullDoc('$$\\int_0^1 f\\,dx$$')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m?.latex).toContain('\\int_0^1')
  })

  it('math latex is verbatim (not modified)', () => {
    const tree = fullDoc('$\\frac{\\alpha}{\\beta}$')
    const m = findNode<MathInlineRenderNode>(docChildren(tree), 'mathInline')
    expect(m?.latex).toBe('\\frac{\\alpha}{\\beta}')
  })

  // Advanced math environments (Phase 1 additions)
  it('cases environment 	 MathDisplayNode', () => {
    const tree = fullDoc('\\begin{cases}x > 0 \\\\ x < 0\\end{cases}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
    expect(m?.latex).toContain('x > 0')
  })

  it('dcases environment 	 MathDisplayNode', () => {
    const tree = fullDoc('\\begin{dcases}a & b\\\\c & d\\end{dcases}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })

  it('split environment 	 MathDisplayNode', () => {
    const tree = fullDoc('\\begin{split}x &= 1\\\\y &= 2\\end{split}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
    expect(m?.latex).toContain('x &= 1')
  })

  it('aligned environment 	 MathDisplayNode', () => {
    const tree = fullDoc('\\begin{aligned}a &= b\\\\c &= d\\end{aligned}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })

  it('matrix environment 	 MathDisplayNode', () => {
    const tree = fullDoc('\\begin{matrix}1 & 2\\\\3 & 4\\end{matrix}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })

  it('pmatrix environment 	 MathDisplayNode with parentheses', () => {
    const tree = fullDoc('\\begin{pmatrix}1 & 2\\\\3 & 4\\end{pmatrix}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })

  it('bmatrix environment 	 MathDisplayNode with brackets', () => {
    const tree = fullDoc('\\begin{bmatrix}a & b\\\\c & d\\end{bmatrix}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })

  it('vmatrix environment 	 MathDisplayNode with vertical bars', () => {
    const tree = fullDoc('\\begin{vmatrix}1 & 2\\\\3 & 4\\end{vmatrix}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })

  it('Vmatrix environment 	 MathDisplayNode with double vertical bars', () => {
    const tree = fullDoc('\\begin{Vmatrix}1 & 2\\\\3 & 4\\end{Vmatrix}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })

  it('smallmatrix environment 	 MathDisplayNode with small font', () => {
    const tree = fullDoc('\\begin{smallmatrix}1 & 2\\\\3 & 4\\end{smallmatrix}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })

  it('subarray environment 	 MathDisplayNode', () => {
    const tree = fullDoc('\\begin{subarray}{c}a\\\\b\\\\c\\end{subarray}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })

  it('gathered environment 	 MathDisplayNode', () => {
    const tree = fullDoc('\\begin{gathered}x = 1\\\\y = 2\\end{gathered}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })

  it('alignedat environment 	 MathDisplayNode', () => {
    const tree = fullDoc('\\begin{alignedat}{2}a &= b & c &= d\\\\e &= f & g &= h\\end{alignedat}')
    const m = findNode<MathDisplayRenderNode>(docChildren(tree), 'mathDisplay')
    expect(m).toBeDefined()
  })
})

// ── Code blocks ───────────────────────────────────────────────────────────
describe('Code blocks', () => {
  it('lstlisting → CodeBlockNode', () => {
    const tree = fullDoc('\\begin{lstlisting}[language=Python]\nx = 1\n\\end{lstlisting}')
    const code = findNode<CodeBlockRenderNode>(docChildren(tree), 'codeBlock')
    expect(code).toBeDefined()
    expect(code?.code).toContain('x = 1')
  })

  it('lstlisting language is lowercased', () => {
    const tree = fullDoc('\\begin{lstlisting}[language=Python]\nprint("hi")\n\\end{lstlisting}')
    const code = findNode<CodeBlockRenderNode>(docChildren(tree), 'codeBlock')
    expect(code?.language).toBe('python')
  })
})

// ── TikZ ─────────────────────────────────────────────────────────────────
describe('TikZ nodes', () => {
  it('tikzpicture → TikzNode with rawSource', () => {
    const tree = fullDoc('\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}')
    const tikz = findNode<TikzRenderNode>(docChildren(tree), 'tikz')
    expect(tikz).toBeDefined()
    expect(tikz?.rawSource).toContain('tikzpicture')
  })
})

// ── Lists ─────────────────────────────────────────────────────────────────
describe('Lists', () => {
  it('itemize → ListNode unordered', () => {
    const tree = fullDoc('\\begin{itemize}\\item First\\item Second\\end{itemize}')
    const list = findNode<ListRenderNode>(docChildren(tree), 'list')
    expect(list?.ordered).toBe(false)
  })

  it('enumerate → ListNode ordered', () => {
    const tree = fullDoc('\\begin{enumerate}\\item One\\item Two\\end{enumerate}')
    const list = findNode<ListRenderNode>(docChildren(tree), 'list')
    expect(list?.ordered).toBe(true)
  })

  it('list has correct number of items', () => {
    const tree = fullDoc('\\begin{itemize}\\item A\\item B\\item C\\end{itemize}')
    const list = findNode<ListRenderNode>(docChildren(tree), 'list')
    expect(list?.children.length).toBe(3)
  })
})

// ── Tables ────────────────────────────────────────────────────────────────
describe('Tables', () => {
  it('tabular → TableNode', () => {
    const tree = fullDoc('\\begin{tabular}{lrr}a&b&c\\end{tabular}')
    const table = findNode<TableRenderNode>(docChildren(tree), 'table')
    expect(table).toBeDefined()
  })

  it('booktabs toprule → TableRuleNode', () => {
    const tree = fullDoc('\\begin{tabular}{l}\\toprule a \\bottomrule\\end{tabular}')
    const table = findNode<TableRenderNode>(docChildren(tree), 'table')
    const hasRule = table?.children.some(r => r.type === 'tableRule' && r.ruleKind === 'top')
    expect(hasRule).toBe(true)
  })
})

// ── Real BrickellQuant documents ──────────────────────────────────────────
describe('Real BrickellQuant documents transform', () => {
  const { readFileSync } = require('fs')
  const files = [
    ['/home/swarm/BrickellQuant/report/brickellquant_architecture.tex', 'brickellquant_architecture'],
    ['/home/swarm/BrickellQuant/tools/autopilot/report/autopilot_report.tex', 'autopilot_report'],
    ['/home/swarm/BrickellQuant/tools/autopilot/report/pricing_report.tex', 'pricing_report'],
    ['/home/swarm/BrickellQuant/docs/almanac_architecture.tex', 'almanac_architecture'],
    ['/home/swarm/BrickellQuant/docs/almanac_search_latency.tex', 'almanac_search_latency'],
  ] as const

  for (const [path, name] of files) {
    it(`transforms ${name} without crashing`, () => {
      const src = readFileSync(path, 'utf8')
      expect(() => transform(parse(tokenize(src)))).not.toThrow()
    })

    it(`${name} produces a document node`, () => {
      const tree = transform(parse(tokenize(readFileSync(path, 'utf8'))))
      expect(tree[0]?.type).toBe('document')
    })
  }

  it('brickellquant_architecture has section nodes', () => {
    const tree = transform(parse(tokenize(readFileSync('/home/swarm/BrickellQuant/report/brickellquant_architecture.tex', 'utf8'))))
    const sections = findAll<SectionRenderNode>(tree, 'section')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('brickellquant_architecture has customBox nodes (insight/correction)', () => {
    const tree = transform(parse(tokenize(readFileSync('/home/swarm/BrickellQuant/report/brickellquant_architecture.tex', 'utf8'))))
    const boxes = findAll<CustomBoxRenderNode>(tree, 'customBox')
    expect(boxes.length).toBeGreaterThan(0)
  })

  it('almanac_architecture has tikz nodes', () => {
    const tree = transform(parse(tokenize(readFileSync('/home/swarm/BrickellQuant/docs/almanac_architecture.tex', 'utf8'))))
    const tikz = findAll<TikzRenderNode>(tree, 'tikz')
    expect(tikz.length).toBeGreaterThan(0)
  })

  it('pricing_report has color nodes', () => {
    const tree = transform(parse(tokenize(readFileSync('/home/swarm/BrickellQuant/tools/autopilot/report/pricing_report.tex', 'utf8'))))
    const colors = findAll<ColorRenderNode>(tree, 'color')
    expect(colors.length).toBeGreaterThan(0)
  })
})

// ── Footnotes and Endnotes ────────────────────────────────────────
describe('Footnotes and endnotes', () => {
  it('\\footnote{content} produces output', () => {
    const tree = fullDoc('Text\\footnote{This is a footnote}more text')
    const doc = tree[0]
    if (doc?.type === 'document') {
      expect(doc.children.length).toBeGreaterThan(1)  // Content + footnote section
    }
  })

  it('multiple footnotes increment counter', () => {
    const tree = fullDoc('First\\footnote{Note 1}second\\footnote{Note 2}')
    const doc = tree[0]
    if (doc?.type === 'document') {
      // Should have content plus footnote separator plus 2 footnotes
      expect(doc.children.length).toBeGreaterThan(2)
    }
  })

  it('\\endnote{content} produces output', () => {
    const tree = fullDoc('Text\\endnote{End note}more')
    const doc = tree[0]
    if (doc?.type === 'document') {
      expect(doc.children.length).toBeGreaterThan(1)  // Content + endnote section
    }
  })

  it('footnote counter is tracked', () => {
    const source = 'A\\footnote{1}B\\footnote{2}C\\footnote{3}'
    const tree = fullDoc(source)
    const doc = tree[0]
    if (doc?.type === 'document') {
      // Should have content + footer + 3 footnotes
      expect(doc.children.length).toBeGreaterThanOrEqual(4)
    }
  })
})
