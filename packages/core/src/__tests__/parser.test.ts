// parser.test.ts — 50+ named test cases for the LaTeX recursive descent parser
import { describe, it, expect } from 'bun:test'
import { tokenize } from '../tokenizer/index.js'
import { parse } from '../parser/index.js'
import type { CommandNode, EnvironmentNode, TextASTNode, MathASTNode } from '../types.js'

// Helpers
const parseDoc = (src: string) => parse(tokenize(src))
const parseBody = (src: string) => parseDoc(`\\begin{document}${src}\\end{document}`).body
const findCmd = (nodes: readonly ReturnType<typeof parseBody>[0][], name: string): CommandNode | undefined =>
  nodes.find((n): n is CommandNode => n.type === 'command' && n.name === name)
const findEnv = (nodes: readonly ReturnType<typeof parseBody>[0][], name: string): EnvironmentNode | undefined =>
  nodes.find((n): n is EnvironmentNode => n.type === 'environment' && n.name === name)

// ── Preamble ──────────────────────────────────────────────────────────────
describe('Preamble parsing', () => {
  it('extracts documentclass', () => {
    const ast = parseDoc('\\documentclass{article}\\begin{document}\\end{document}')
    expect(ast.preamble.documentClass).toBe('article')
  })

  it('extracts documentclass with options', () => {
    const ast = parseDoc('\\documentclass[11pt,a4paper]{article}\\begin{document}\\end{document}')
    expect(ast.preamble.documentClass).toBe('article')
    expect(ast.preamble.documentOptions).toContain('11pt')
  })

  it('extracts usepackage entries', () => {
    const ast = parseDoc('\\usepackage{amsmath}\\usepackage{booktabs}\\begin{document}\\end{document}')
    const names = ast.preamble.packages.map(p => p.name)
    expect(names).toContain('amsmath')
    expect(names).toContain('booktabs')
  })

  it('extracts definecolor HTML', () => {
    const ast = parseDoc('\\definecolor{bqblue}{HTML}{58A6FF}\\begin{document}\\end{document}')
    const c = ast.preamble.colors.find(c => c.name === 'bqblue')
    expect(c).toBeDefined()
    expect(c?.hex).toBe('#58A6FF')
    expect(c?.model).toBe('HTML')
  })

  it('extracts multiple definecolor entries', () => {
    const src = [
      '\\definecolor{bqblue}{HTML}{58A6FF}',
      '\\definecolor{bqgreen}{HTML}{3FB950}',
      '\\definecolor{bqorange}{HTML}{F78166}',
      '\\begin{document}\\end{document}',
    ].join('\n')
    const ast = parseDoc(src)
    expect(ast.preamble.colors.length).toBe(3)
  })

  it('extracts newmdenv as custom environment', () => {
    const src = '\\usepackage{mdframed}\\newmdenv[linecolor=bqblue]{insight}\\begin{document}\\end{document}'
    const ast = parseDoc(src)
    const env = ast.preamble.customEnvs.find(e => e.name === 'insight')
    expect(env).toBeDefined()
    expect(env?.basedOn).toBe('mdframed')
    expect(env?.options['linecolor']).toBe('bqblue')
  })

  it('extracts newcommand', () => {
    const src = '\\newcommand{\\bq}{BrickellQuant}\\begin{document}\\end{document}'
    const ast = parseDoc(src)
    const cmd = ast.preamble.commands.find(c => c.name === 'bq')
    expect(cmd).toBeDefined()
  })

  it('extracts lstset defaults', () => {
    const src = '\\lstset{language=Python,basicstyle=\\ttfamily}\\begin{document}\\end{document}'
    const ast = parseDoc(src)
    expect(ast.preamble.lstset.language).toBe('Python')
  })
})

// ── Basic body nodes ──────────────────────────────────────────────────────
describe('Body parsing — basic', () => {
  it('parses text content', () => {
    const body = parseBody('Hello world')
    const text = body.find((n): n is TextASTNode => n.type === 'text')
    expect(text?.content).toContain('Hello')
  })

  it('parses inline math', () => {
    const body = parseBody('$x^2 + 1$')
    const math = body.find((n): n is MathASTNode => n.type === 'math')
    expect(math?.kind).toBe('inline')
    expect(math?.content).toBe('x^2 + 1')
  })

  it('parses display math', () => {
    const body = parseBody('$$\\int_0^1 f(x)\\,dx$$')
    const math = body.find((n): n is MathASTNode => n.type === 'math')
    expect(math?.kind).toBe('display')
    expect(math?.content).toContain('\\int_0^1')
  })

  it('parses \\section command', () => {
    const body = parseBody('\\section{Introduction}')
    const cmd = findCmd(body, 'section')
    expect(cmd).toBeDefined()
    expect(cmd?.reqArgs.length).toBeGreaterThan(0)
  })

  it('parses \\subsection command', () => {
    const body = parseBody('\\subsection{Methods}')
    const cmd = findCmd(body, 'subsection')
    expect(cmd).toBeDefined()
  })

  it('parses \\textbf command', () => {
    const body = parseBody('\\textbf{bold text}')
    const cmd = findCmd(body, 'textbf')
    expect(cmd).toBeDefined()
  })

  it('parses \\emph command', () => {
    const body = parseBody('\\emph{emphasized}')
    const cmd = findCmd(body, 'emph')
    expect(cmd).toBeDefined()
  })

  it('parses \\textcolor with two required args', () => {
    const body = parseBody('\\textcolor{bqblue}{Important text}')
    const cmd = findCmd(body, 'textcolor')
    expect(cmd?.reqArgs.length).toBe(2)
  })
})

// ── Environments ──────────────────────────────────────────────────────────
describe('Body parsing — environments', () => {
  it('parses begin/end environment', () => {
    const body = parseBody('\\begin{itemize}\\item First\\end{itemize}')
    const env = findEnv(body, 'itemize')
    expect(env).toBeDefined()
  })

  it('parses tabular with column spec', () => {
    const body = parseBody('\\begin{tabular}{lrr}a&b&c\\end{tabular}')
    const env = findEnv(body, 'tabular')
    expect(env?.columnSpec).toBe('lrr')
  })

  it('parses longtable', () => {
    const body = parseBody('\\begin{longtable}{lc}x&y\\end{longtable}')
    const env = findEnv(body, 'longtable')
    expect(env).toBeDefined()
    expect(env?.columnSpec).toBe('lc')
  })

  it('parses figure environment', () => {
    const body = parseBody('\\begin{figure}[h]\\includegraphics{fig.pdf}\\end{figure}')
    const env = findEnv(body, 'figure')
    expect(env).toBeDefined()
    expect(env?.optArgs.find(o => o.key === 'h')).toBeDefined()
  })

  it('parses enumerate environment', () => {
    const body = parseBody('\\begin{enumerate}\\item First\\item Second\\end{enumerate}')
    const env = findEnv(body, 'enumerate')
    expect(env).toBeDefined()
  })

  it('parses custom mdframed environment (bluebox)', () => {
    const body = parseBody('\\begin{bluebox}Content here\\end{bluebox}')
    const env = findEnv(body, 'bluebox')
    expect(env).toBeDefined()
  })

  it('parses titlepage environment', () => {
    const body = parseBody('\\begin{titlepage}Title page content\\end{titlepage}')
    const env = findEnv(body, 'titlepage')
    expect(env).toBeDefined()
  })

  it('parses center environment', () => {
    const body = parseBody('\\begin{center}Centered text\\end{center}')
    const env = findEnv(body, 'center')
    expect(env).toBeDefined()
  })

  it('parses nested environments', () => {
    const body = parseBody('\\begin{figure}[h]\\begin{center}\\includegraphics{f.pdf}\\end{center}\\end{figure}')
    const fig = findEnv(body, 'figure')
    expect(fig).toBeDefined()
    const center = findEnv(fig!.body as ReturnType<typeof parseBody>, 'center')
    expect(center).toBeDefined()
  })

  it('parses lstlisting as verbatim', () => {
    const body = parseBody('\\begin{lstlisting}[language=Python]\nx = 1\n\\end{lstlisting}')
    const env = findEnv(body, 'lstlisting')
    expect(env).toBeDefined()
    const verbNode = env?.body[0]
    expect(verbNode?.type).toBe('verbatim')
    if (verbNode?.type === 'verbatim') {
      expect(verbNode.content).toContain('x = 1')
    }
  })

  it('parses tikzpicture environment', () => {
    const body = parseBody('\\begin{tikzpicture}\\draw (0,0) circle (1);\\end{tikzpicture}')
    const env = findEnv(body, 'tikzpicture')
    expect(env).toBeDefined()
  })
})

// ── Error recovery ────────────────────────────────────────────────────────
describe('Error recovery', () => {
  it('does not throw on missing \\end{}', () => {
    expect(() => parseBody('\\begin{tabular}{l}a')).not.toThrow()
  })

  it('does not throw on unclosed brace', () => {
    expect(() => parseBody('\\textbf{unclosed')).not.toThrow()
  })

  it('does not throw on empty document', () => {
    expect(() => parseDoc('\\begin{document}\\end{document}')).not.toThrow()
  })

  it('parses document with only comments', () => {
    expect(() => parseBody('% just a comment\n% another comment')).not.toThrow()
  })
})

// ── Real BrickellQuant documents ──────────────────────────────────────────
describe('Real BrickellQuant documents', () => {
  const { readFileSync } = require('fs')
  const files = [
    ['/home/swarm/BrickellQuant/report/brickellquant_architecture.tex', 'brickellquant_architecture'],
    ['/home/swarm/BrickellQuant/tools/autopilot/report/autopilot_report.tex', 'autopilot_report'],
    ['/home/swarm/BrickellQuant/tools/autopilot/report/pricing_report.tex', 'pricing_report'],
    ['/home/swarm/BrickellQuant/docs/almanac_architecture.tex', 'almanac_architecture'],
    ['/home/swarm/BrickellQuant/docs/almanac_search_latency.tex', 'almanac_search_latency'],
  ] as const

  for (const [path, name] of files) {
    it(`parses ${name} without crashing`, () => {
      const src = readFileSync(path, 'utf8')
      expect(() => parse(tokenize(src))).not.toThrow()
    })

    it(`${name} preamble has colors`, () => {
      const ast = parse(tokenize(readFileSync(path, 'utf8')))
      expect(ast.preamble.colors.length).toBeGreaterThan(0)
    })

    it(`${name} preamble has packages`, () => {
      const ast = parse(tokenize(readFileSync(path, 'utf8')))
      expect(ast.preamble.packages.length).toBeGreaterThan(3)
    })

    it(`${name} body has nodes`, () => {
      const ast = parse(tokenize(readFileSync(path, 'utf8')))
      expect(ast.body.length).toBeGreaterThan(0)
    })
  }

  it('brickellquant_architecture has section commands in body', () => {
    const ast = parse(tokenize(readFileSync('/home/swarm/BrickellQuant/report/brickellquant_architecture.tex', 'utf8')))
    const sections = ast.body.filter((n): n is CommandNode => n.type === 'command' && n.name === 'section')
    expect(sections.length).toBeGreaterThan(0)
  })

  it('almanac_architecture has tikzpicture environments', () => {
    const ast = parse(tokenize(readFileSync('/home/swarm/BrickellQuant/docs/almanac_architecture.tex', 'utf8')))
    function countEnvs(nodes: readonly ReturnType<typeof parseBody>[0][], name: string): number {
      let count = 0
      for (const n of nodes) {
        if (n.type === 'environment' && n.name === name) count++
        if (n.type === 'environment') count += countEnvs(n.body, name)
      }
      return count
    }
    const tikzCount = countEnvs(ast.body, 'tikzpicture')
    expect(tikzCount).toBeGreaterThan(0)
  })

  it('pricing_report has tabular environments', () => {
    const ast = parse(tokenize(readFileSync('/home/swarm/BrickellQuant/tools/autopilot/report/pricing_report.tex', 'utf8')))
    function hasEnv(nodes: readonly ReturnType<typeof parseBody>[0][], name: string): boolean {
      for (const n of nodes) {
        if (n.type === 'environment' && n.name === name) return true
        if (n.type === 'environment' && hasEnv(n.body, name)) return true
      }
      return false
    }
    expect(hasEnv(ast.body, 'tabular')).toBe(true)
  })
})
