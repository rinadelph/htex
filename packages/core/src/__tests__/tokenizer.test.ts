// tokenizer.test.ts — 60+ named test cases for the LaTeX tokenizer
import { describe, it, expect } from 'bun:test'
import { tokenize } from '../tokenizer/index.js'
import { TokenKind } from '../types.js'

// Helper: get token kinds as array
const kinds = (src: string) => tokenize(src).map(t => t.kind)
const values = (src: string) => tokenize(src).map(t => t.value)
const tokens = (src: string) => tokenize(src)

// ── Basic commands ──────────────────────────────────────────────────────────
describe('Basic commands', () => {
  it('tokenizes simple command \\section', () => {
    const k = kinds('\\section')
    expect(k).toContain(TokenKind.COMMAND)
    expect(tokens('\\section').find(t => t.kind === TokenKind.COMMAND)?.value).toBe('section')
  })

  it('tokenizes \\documentclass', () => {
    const t = tokens('\\documentclass').find(t => t.kind === TokenKind.COMMAND)
    expect(t?.value).toBe('documentclass')
  })

  it('tokenizes \\usepackage', () => {
    const t = tokens('\\usepackage').find(t => t.kind === TokenKind.COMMAND)
    expect(t?.value).toBe('usepackage')
  })

  it('tokenizes \\textbf', () => {
    const t = tokens('\\textbf').find(t => t.kind === TokenKind.COMMAND)
    expect(t?.value).toBe('textbf')
  })

  it('tokenizes \\newcommand', () => {
    const t = tokens('\\newcommand').find(t => t.kind === TokenKind.COMMAND)
    expect(t?.value).toBe('newcommand')
  })

  it('tokenizes \\definecolor', () => {
    const t = tokens('\\definecolor').find(t => t.kind === TokenKind.COMMAND)
    expect(t?.value).toBe('definecolor')
  })
})

// ── Braces and brackets ────────────────────────────────────────────────────
describe('Braces and brackets', () => {
  it('tokenizes { as LBRACE', () => {
    expect(kinds('{')).toContain(TokenKind.LBRACE)
  })

  it('tokenizes } as RBRACE', () => {
    expect(kinds('}')).toContain(TokenKind.RBRACE)
  })

  it('tokenizes [ as LBRACKET', () => {
    expect(kinds('[opt]')).toContain(TokenKind.LBRACKET)
  })

  it('tokenizes ] as RBRACKET', () => {
    expect(kinds('[opt]')).toContain(TokenKind.RBRACKET)
  })

  it('tokenizes \\section{Title} as COMMAND LBRACE TEXT RBRACE', () => {
    const k = kinds('\\section{Title}')
    expect(k[0]).toBe(TokenKind.COMMAND)
    expect(k[1]).toBe(TokenKind.LBRACE)
    expect(k[2]).toBe(TokenKind.TEXT)
    expect(k[3]).toBe(TokenKind.RBRACE)
  })

  it('tokenizes \\documentclass[11pt]{article} with brackets and braces', () => {
    const k = kinds('\\documentclass[11pt]{article}')
    expect(k).toContain(TokenKind.LBRACKET)
    expect(k).toContain(TokenKind.RBRACKET)
    expect(k).toContain(TokenKind.LBRACE)
    expect(k).toContain(TokenKind.RBRACE)
  })
})

// ── Environments ──────────────────────────────────────────────────────────
describe('Environments', () => {
  it('tokenizes \\begin{document} as ENV_BEGIN', () => {
    const t = tokens('\\begin{document}').find(t => t.kind === TokenKind.ENV_BEGIN)
    expect(t?.value).toBe('document')
  })

  it('tokenizes \\end{document} as ENV_END', () => {
    const t = tokens('\\end{document}').find(t => t.kind === TokenKind.ENV_END)
    expect(t?.value).toBe('document')
  })

  it('tokenizes \\begin{tabular} with env name', () => {
    const t = tokens('\\begin{tabular}').find(t => t.kind === TokenKind.ENV_BEGIN)
    expect(t?.value).toBe('tabular')
  })

  it('tokenizes \\begin{tikzpicture}', () => {
    const t = tokens('\\begin{tikzpicture}').find(t => t.kind === TokenKind.ENV_BEGIN)
    expect(t?.value).toBe('tikzpicture')
  })

  it('tokenizes \\begin{bluebox} custom env', () => {
    const t = tokens('\\begin{bluebox}').find(t => t.kind === TokenKind.ENV_BEGIN)
    expect(t?.value).toBe('bluebox')
  })

  it('tokenizes \\end{insight} custom env', () => {
    const t = tokens('\\end{insight}').find(t => t.kind === TokenKind.ENV_END)
    expect(t?.value).toBe('insight')
  })
})

// ── Math modes ────────────────────────────────────────────────────────────
describe('Math modes', () => {
  it('tokenizes $x^2$ as MATH_INLINE', () => {
    const t = tokens('$x^2$').find(t => t.kind === TokenKind.MATH_INLINE)
    expect(t).toBeDefined()
    expect(t?.value).toBe('x^2')
  })

  it('MATH_INLINE value does not include $ delimiters', () => {
    const t = tokens('$\\frac{a}{b}$').find(t => t.kind === TokenKind.MATH_INLINE)
    expect(t?.value).not.toContain('$')
    expect(t?.value).toContain('\\frac')
  })

  it('tokenizes $$display math$$ as MATH_DISPLAY', () => {
    const t = tokens('$$\\int_0^1$$').find(t => t.kind === TokenKind.MATH_DISPLAY)
    expect(t?.value).toBe('\\int_0^1')
  })

  it('tokenizes \\[...\\] as MATH_DISPLAY', () => {
    const t = tokens('\\[\\sum_{i=0}^n\\]').find(t => t.kind === TokenKind.MATH_DISPLAY)
    expect(t).toBeDefined()
    expect(t?.value).toContain('\\sum')
  })

  it('tokenizes \\(...\\) as MATH_INLINE', () => {
    const t = tokens('\\(x + y\\)').find(t => t.kind === TokenKind.MATH_INLINE)
    expect(t).toBeDefined()
    expect(t?.value).toBe('x + y')
  })

  it('math content with nested braces is preserved verbatim', () => {
    const t = tokens('$\\frac{a}{b}$').find(t => t.kind === TokenKind.MATH_INLINE)
    expect(t?.value).toBe('\\frac{a}{b}')
  })

  it('complex math with subscript and superscript preserved', () => {
    const src = '$\\sum_{i=0}^{n} x_i^2$'
    const t = tokens(src).find(t => t.kind === TokenKind.MATH_INLINE)
    expect(t?.value).toBe('\\sum_{i=0}^{n} x_i^2')
  })
})

// ── Escape sequences ──────────────────────────────────────────────────────
describe('Escape sequences', () => {
  it('\\$ produces TEXT not MATH_INLINE', () => {
    const k = kinds('\\$100')
    expect(k).not.toContain(TokenKind.MATH_INLINE)
    expect(k[0]).toBe(TokenKind.TEXT)
  })

  it('\\% produces TEXT not COMMENT', () => {
    const k = kinds('\\%')
    expect(k[0]).toBe(TokenKind.TEXT)
    expect(k).not.toContain(TokenKind.COMMENT)
  })

  it('\\{ produces TEXT not LBRACE', () => {
    const k = kinds('\\{')
    expect(k[0]).toBe(TokenKind.TEXT)
    expect(k).not.toContain(TokenKind.LBRACE)
  })

  it('\\} produces TEXT not RBRACE', () => {
    const k = kinds('\\}')
    expect(k[0]).toBe(TokenKind.TEXT)
    expect(k).not.toContain(TokenKind.RBRACE)
  })

  it('\\& produces TEXT not AMPERSAND', () => {
    const k = kinds('\\&')
    expect(k[0]).toBe(TokenKind.TEXT)
    expect(k).not.toContain(TokenKind.AMPERSAND)
  })
})

// ── Comments ──────────────────────────────────────────────────────────────
describe('Comments', () => {
  it('% comment produces COMMENT token', () => {
    expect(kinds('% comment here')).toContain(TokenKind.COMMENT)
  })

  it('COMMENT value does not include the % character', () => {
    const t = tokens('% hello world').find(t => t.kind === TokenKind.COMMENT)
    expect(t?.value).toBe(' hello world')
    expect(t?.value).not.toContain('%')
  })

  it('comment ends at newline', () => {
    const src = 'abc % comment\ndef'
    const t = tokens(src).find(t => t.kind === TokenKind.COMMENT)
    expect(t?.value).toBe(' comment')
  })

  it('text after comment on next line is still tokenized', () => {
    const src = '% comment\nhello'
    const v = values(src)
    expect(v).toContain('hello')
  })
})

// ── Ampersand (table cells) ────────────────────────────────────────────────
describe('Ampersand', () => {
  it('& produces AMPERSAND', () => {
    expect(kinds('a & b')).toContain(TokenKind.AMPERSAND)
  })

  it('three cells produce two AMPERSANDs', () => {
    const ts = tokens('a & b & c')
    const amps = ts.filter(t => t.kind === TokenKind.AMPERSAND)
    expect(amps.length).toBe(2)
  })

  it('\\& does NOT produce AMPERSAND', () => {
    const k = kinds('\\&')
    expect(k).not.toContain(TokenKind.AMPERSAND)
  })
})

// ── Verbatim environments ─────────────────────────────────────────────────
describe('Verbatim environments', () => {
  it('lstlisting body is captured as VERBATIM token', () => {
    const src = '\\begin{lstlisting}\nx = 1\n\\end{lstlisting}'
    const t = tokens(src).find(t => t.kind === TokenKind.VERBATIM)
    expect(t).toBeDefined()
    expect(t?.value).toContain('x = 1')
  })

  it('lstlisting body preserves special chars: $ { % &', () => {
    const src = '\\begin{lstlisting}\n$var = {dict} % comment & more\n\\end{lstlisting}'
    const t = tokens(src).find(t => t.kind === TokenKind.VERBATIM)
    expect(t?.value).toContain('$var')
    expect(t?.value).toContain('{dict}')
    expect(t?.value).toContain('% comment')
    expect(t?.value).toContain('& more')
  })

  it('lstlisting language option is captured in verbatim value', () => {
    const src = '\\begin{lstlisting}[language=Python]\nx=1\n\\end{lstlisting}'
    const t = tokens(src).find(t => t.kind === TokenKind.VERBATIM)
    expect(t?.value).toContain('language=Python')
  })

  it('verbatim env captures body verbatim', () => {
    const src = '\\begin{verbatim}\n\\command{test}\n\\end{verbatim}'
    const t = tokens(src).find(t => t.kind === TokenKind.VERBATIM)
    expect(t?.value).toContain('\\command{test}')
  })
})

// ── Line/column tracking ──────────────────────────────────────────────────
describe('Line and column tracking', () => {
  it('first token is on line 1', () => {
    const t = tokens('hello')
    expect(t[0]?.line).toBe(1)
  })

  it('command on second line has line=2', () => {
    const src = 'first line\n\\section{Title}'
    const cmd = tokens(src).find(t => t.kind === TokenKind.COMMAND)
    expect(cmd?.line).toBe(2)
  })

  it('column resets to 1 after newline', () => {
    const src = 'abc\n\\section'
    const cmd = tokens(src).find(t => t.kind === TokenKind.COMMAND)
    expect(cmd?.col).toBe(1)
  })

  it('column tracks within a line', () => {
    const src = 'ab \\cmd'
    const cmd = tokens(src).find(t => t.kind === TokenKind.COMMAND)
    expect(cmd?.line).toBe(1)
    expect(cmd?.col).toBeGreaterThan(1)
  })
})

// ── Complex real patterns ─────────────────────────────────────────────────
describe('Complex real patterns', () => {
  it('tokenizes \\textcolor{bqblue}{Important} correctly', () => {
    const src = '\\textcolor{bqblue}{Important}'
    const k = kinds(src)
    expect(k[0]).toBe(TokenKind.COMMAND)
    expect(k[1]).toBe(TokenKind.LBRACE)
    expect(k[2]).toBe(TokenKind.TEXT)
    expect(k[3]).toBe(TokenKind.RBRACE)
    expect(k[4]).toBe(TokenKind.LBRACE)
    expect(k[5]).toBe(TokenKind.TEXT)
    expect(k[6]).toBe(TokenKind.RBRACE)
  })

  it('tokenizes \\definecolor{bqblue}{HTML}{58A6FF}', () => {
    const src = '\\definecolor{bqblue}{HTML}{58A6FF}'
    const t = tokens(src)
    const cmd = t.find(t => t.kind === TokenKind.COMMAND)
    expect(cmd?.value).toBe('definecolor')
    const textVals = t.filter(t => t.kind === TokenKind.TEXT).map(t => t.value)
    expect(textVals).toContain('bqblue')
    expect(textVals).toContain('HTML')
    expect(textVals).toContain('58A6FF')
  })

  it('tokenizes table row: a & b & c \\\\', () => {
    const src = 'First & Second & Third \\\\'
    const k = kinds(src)
    expect(k.filter(k => k === TokenKind.AMPERSAND).length).toBe(2)
    expect(k).toContain(TokenKind.NEWLINE)
  })

  it('tokenizes \\begin{tabular}{lrr}...\\end{tabular}', () => {
    const src = '\\begin{tabular}{lrr}a&b\\end{tabular}'
    const envBegin = tokens(src).find(t => t.kind === TokenKind.ENV_BEGIN)
    const envEnd = tokens(src).find(t => t.kind === TokenKind.ENV_END)
    expect(envBegin?.value).toBe('tabular')
    expect(envEnd?.value).toBe('tabular')
  })

  it('produces EOF as last token', () => {
    const ts = tokens('hello')
    expect(ts[ts.length - 1]?.kind).toBe(TokenKind.EOF)
  })

  it('empty string produces only EOF', () => {
    const ts = tokens('')
    expect(ts.length).toBe(1)
    expect(ts[0]?.kind).toBe(TokenKind.EOF)
  })
})

// ── Real BrickellQuant patterns ────────────────────────────────────────────
describe('BrickellQuant real patterns', () => {
  it('tokenizes \\usepackage[T1]{fontenc}', () => {
    const src = '\\usepackage[T1]{fontenc}'
    const cmd = tokens(src).find(t => t.kind === TokenKind.COMMAND)
    expect(cmd?.value).toBe('usepackage')
    const textVals = tokens(src).filter(t => t.kind === TokenKind.TEXT).map(t => t.value)
    expect(textVals).toContain('T1')
    expect(textVals).toContain('fontenc')
  })

  it('tokenizes \\newmdenv[linecolor=bqblue]{insight}', () => {
    const src = '\\newmdenv[linecolor=bqblue]{insight}'
    const cmd = tokens(src).find(t => t.kind === TokenKind.COMMAND)
    expect(cmd?.value).toBe('newmdenv')
  })

  it('tokenizes \\begin{longtable} env', () => {
    const t = tokens('\\begin{longtable}').find(t => t.kind === TokenKind.ENV_BEGIN)
    expect(t?.value).toBe('longtable')
  })

  it('tokenizes \\toprule as COMMAND', () => {
    const t = tokens('\\toprule').find(t => t.kind === TokenKind.COMMAND)
    expect(t?.value).toBe('toprule')
  })

  it('tokenizes \\multicolumn{3}{c}{Header}', () => {
    const src = '\\multicolumn{3}{c}{Header}'
    const cmd = tokens(src).find(t => t.kind === TokenKind.COMMAND)
    expect(cmd?.value).toBe('multicolumn')
    const textVals = tokens(src).filter(t => t.kind === TokenKind.TEXT).map(t => t.value)
    expect(textVals).toContain('3')
    expect(textVals).toContain('c')
    expect(textVals).toContain('Header')
  })

  it('tokenizes \\includegraphics[width=\\textwidth]{fig.pdf}', () => {
    const src = '\\includegraphics[width=\\textwidth]{fig.pdf}'
    const cmds = tokens(src).filter(t => t.kind === TokenKind.COMMAND).map(t => t.value)
    expect(cmds).toContain('includegraphics')
    expect(cmds).toContain('textwidth')
  })
})

// ── Performance check ─────────────────────────────────────────────────────
describe('Performance', () => {
  it('tokenizes 537-line BrickellQuant file in < 50ms', () => {
    const { readFileSync } = require('fs')
    const src = readFileSync('/home/swarm/BrickellQuant/report/brickellquant_architecture.tex', 'utf8')
    const start = performance.now()
    const result = tokenize(src)
    const ms = performance.now() - start
    expect(result.length).toBeGreaterThan(500)
    expect(ms).toBeLessThan(50)
  })

  it('tokenizes all 5 BrickellQuant files without crashing', () => {
    const { readFileSync } = require('fs')
    const files = [
      '/home/swarm/BrickellQuant/report/brickellquant_architecture.tex',
      '/home/swarm/BrickellQuant/tools/autopilot/report/autopilot_report.tex',
      '/home/swarm/BrickellQuant/tools/autopilot/report/pricing_report.tex',
      '/home/swarm/BrickellQuant/docs/almanac_architecture.tex',
      '/home/swarm/BrickellQuant/docs/almanac_search_latency.tex',
    ]
    for (const f of files) {
      const result = tokenize(readFileSync(f, 'utf8'))
      expect(result.length).toBeGreaterThan(100)
      expect(result[result.length - 1]?.kind).toBe(TokenKind.EOF)
    }
  })
})
