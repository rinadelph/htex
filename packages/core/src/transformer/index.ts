// =============================================================================
// @htex/core — transformer/index.ts
// Converts LaTeXAST → RenderTree (array of RenderNode).
// Handles: color resolution, custom env mapping, macro expansion,
// section numbering, label/ref two-pass, table structure, TOC generation.
// =============================================================================

import type {
  ASTNode, CommandNode, EnvironmentNode, TextASTNode,
  MathASTNode, GroupASTNode, VerbatimASTNode,
  DocumentAST, PreambleContext, ColorDef, RenderNode,
  RenderTree, SectionRenderNode, TableRenderNode,
  TableRowRenderNode, TableCellRenderNode, TableRuleRenderNode,
  CustomBoxRenderNode, CodeBlockRenderNode, TikzRenderNode,
  PlotRenderNode, ListRenderNode, ListItemRenderNode,
  FigureRenderNode, ImageRenderNode, MathInlineRenderNode,
  MathDisplayRenderNode, BoldRenderNode, ItalicRenderNode,
  UnderlineRenderNode, InlineCodeRenderNode,
  ColorRenderNode, LinkRenderNode, ReferenceRenderNode,
  TextRenderNode, ParagraphRenderNode, CenterRenderNode,
  AbstractRenderNode, TOCRenderNode, TOCEntry, TitlePageRenderNode,
  DocumentRenderNode, CaptionRenderNode, HRuleRenderNode,
  PageBreakRenderNode, FigureRenderNode as FigRN,
  StyledTextRenderNode,
  TransformOptions,
} from '../types.js'

export interface TransformContext {
  colors: Map<string, string>         // name → hex
  customEnvs: Map<string, { borderColor: string; bgColor: string }>
  macros: Map<string, ASTNode[]>      // macro name → expansion
  labels: Map<string, string>         // label id → display text
  sectionCounters: [number, number, number]  // [h1, h2, h3]
  tocEntries: TOCEntry[]
  options: TransformOptions
  docTitle: string
  docAuthor: string
  docDate: string
  tikzCounter: number                 // 1-based counter for TikZ/pgfplots diagrams
}

// ── Color resolution ───────────────────────────────────────────────────────

function buildColorMap(colors: readonly ColorDef[]): Map<string, string> {
  const m = new Map<string, string>()
  // Set built-in LaTeX named colors FIRST — preamble \definecolor overrides them
  m.set('red', '#FF0000'); m.set('green', '#00AA00'); m.set('blue', '#0000FF')
  m.set('white', '#FFFFFF'); m.set('black', '#000000'); m.set('gray', '#808080')
  m.set('yellow', '#FFFF00'); m.set('orange', '#FF8000'); m.set('cyan', '#00CCCC')
  m.set('magenta', '#CC00CC'); m.set('violet', '#8000FF'); m.set('brown', '#8B4513')
  m.set('gold', '#E3B341'); m.set('accent', '#58A6FF'); m.set('grn', '#3FB950')
  m.set('muted', '#8B949E'); m.set('border', '#30363D'); m.set('bqdark', '#0D1117')
  m.set('bqblue', '#58A6FF'); m.set('bqgreen', '#3FB950'); m.set('bqorange', '#F78166')
  m.set('bqpurple', '#BC8CFF'); m.set('bqgold', '#E3B341'); m.set('bqsilver', '#8B949E')
  // Preamble \definecolor entries override built-ins
  for (const c of colors) m.set(c.name, c.hex)
  return m
}

function resolveColor(name: string, ctx: TransformContext): string {
  // Try exact match first
  const exact = ctx.colors.get(name) ?? ctx.colors.get(name.toLowerCase())
  if (exact) return exact
  // Handle xcolor tint expressions: "colorname!percent" e.g. "bqred!10"
  // Mix the color with white (100-percent)% 	 CSS color-mix or manual lerp
  const tintMatch = name.match(/^([a-zA-Z]+)!(\d+)(?:!([a-zA-Z]+))?$/)
  if (tintMatch) {
    const baseName = tintMatch[1]!
    const pct = parseInt(tintMatch[2]!, 10) / 100
    const baseHex = ctx.colors.get(baseName) ?? ctx.colors.get(baseName.toLowerCase())
    if (baseHex) {
      // Mix with white (second color, default white)
      const mixName = tintMatch[3] ?? 'white'
      const mixHex = ctx.colors.get(mixName) ?? '#ffffff'
      return blendHex(baseHex, mixHex, pct)
    }
  }
  return '#000000'
}

/** Linear blend: pct=1 	 a, pct=0 	 b */
function blendHex(a: string, b: string, pct: number): string {
  const parse = (h: string): [number, number, number] => {
    const c = h.replace('#', '')
    const full = c.length === 3
      ? c.split('').map(x => parseInt(x + x, 16))
      : [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)]
    return full as [number, number, number]
  }
  const [ar,ag,ab] = parse(a)
  const [br,bg,bb] = parse(b)
  const r = Math.round(ar! * pct + br! * (1 - pct))
  const g = Math.round(ag! * pct + bg! * (1 - pct))
  const bl2 = Math.round(ab! * pct + bb! * (1 - pct))
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bl2.toString(16).padStart(2,'0')}`
}

// Default custom env styles keyed by env name
const DEFAULT_ENV_STYLES: Record<string, { borderColor: string; bgColor: string }> = {
  insight:    { borderColor: '#58A6FF', bgColor: 'transparent' },
  correction: { borderColor: '#F78166', bgColor: 'transparent' },
  bluebox:    { borderColor: '#58A6FF', bgColor: '#0D1117' },
  redbox:     { borderColor: '#F85149', bgColor: 'transparent' },
  infobox:    { borderColor: '#E3B341', bgColor: 'transparent' },
  warningbox: { borderColor: '#F78166', bgColor: 'transparent' },
  // NOTE: 'mdframed' is intentionally NOT here — it is handled in transformEnvironment's
  // switch case so that its inline [linecolor=...] options are respected.
}

// ── Macro expansion ────────────────────────────────────────────────────────

function buildMacroMap(preamble: PreambleContext): Map<string, ASTNode[]> {
  const m = new Map<string, ASTNode[]>()
  for (const cmd of preamble.commands) {
    if (cmd.argCount === 0) m.set(cmd.name, [...cmd.body])
  }
  return m
}

// ── Label/ref two-pass ─────────────────────────────────────────────────────

function collectLabels(nodes: readonly ASTNode[], labels: Map<string, string>, currentText: () => string): void {
  for (const n of nodes) {
    if (n.type === 'command' && n.name === 'label') {
      const id = flatText(n.reqArgs[0] ?? [])
      labels.set(id, currentText())
    }
    if (n.type === 'environment') collectLabels(n.body, labels, currentText)
    if (n.type === 'group') collectLabels(n.children, labels, currentText)
    if (n.type === 'command') {
      for (const arg of n.reqArgs) collectLabels(arg, labels, currentText)
    }
  }
}

// ── Section numbering ──────────────────────────────────────────────────────

function incrementSection(ctx: TransformContext, level: 1 | 2 | 3): string {
  if (level === 1) {
    ctx.sectionCounters[0]++
    ctx.sectionCounters[1] = 0
    ctx.sectionCounters[2] = 0
    return String(ctx.sectionCounters[0])
  } else if (level === 2) {
    ctx.sectionCounters[1]++
    ctx.sectionCounters[2] = 0
    return `${ctx.sectionCounters[0]}.${ctx.sectionCounters[1]}`
  } else {
    ctx.sectionCounters[2]++
    return `${ctx.sectionCounters[0]}.${ctx.sectionCounters[1]}.${ctx.sectionCounters[2]}`
  }
}

// ── Text flattening ───────────────────────────────────────────────────────

function flatText(nodes: readonly ASTNode[]): string {
  return nodes.map(n => {
    if (n.type === 'text') return n.content.trim()
    if (n.type === 'command') {
      if (n.reqArgs[0]) return flatText(n.reqArgs[0])
      return ''
    }
    if (n.type === 'group') return flatText(n.children)
    if (n.type === 'math') return n.content
    return ''
  }).join('').replace(/\s+/g, ' ').trim()
}

// ── Main transformer ───────────────────────────────────────────────────────

export function transform(ast: DocumentAST, options: TransformOptions = {}): RenderTree {
  const colorMap = buildColorMap(ast.preamble.colors)

  // Build custom env styles from preamble + defaults
  const envStyles = new Map<string, { borderColor: string; bgColor: string }>()
  for (const [k, v] of Object.entries(DEFAULT_ENV_STYLES)) envStyles.set(k, v)
  for (const env of ast.preamble.customEnvs) {
    const lineColor = env.options['linecolor'] ?? env.options['lineColor'] ?? ''
    const bgOpt = env.options['backgroundcolor'] ?? env.options['bgcolor'] ?? ''
    // Resolve with tint support (e.g. "bqblue!10" 	 hex)
    const resolveWithMap = (name: string): string => {
      const exact = colorMap.get(name) ?? colorMap.get(name.toLowerCase())
      if (exact) return exact
      const tintMatch = name.match(/^([a-zA-Z]+)!(\d+)(?:!([a-zA-Z]+))?$/)
      if (tintMatch) {
        const baseName = tintMatch[1]!
        const pct = parseInt(tintMatch[2]!, 10) / 100
        const baseHex = colorMap.get(baseName) ?? colorMap.get(baseName.toLowerCase())
        if (baseHex) {
          const mixName = tintMatch[3] ?? 'white'
          const mixHex = colorMap.get(mixName) ?? '#ffffff'
          return blendHex(baseHex, mixHex, pct)
        }
      }
      return ''
    }
    const borderColor = resolveWithMap(lineColor) || '#888888'
    const bgColor = resolveWithMap(bgOpt) || 'transparent'
    envStyles.set(env.name, { borderColor, bgColor })
  }

  // Extract \title, \author, \date from preamble
  let docTitle = ''
  let docAuthor = ''
  let docDate = ''
  for (const n of ast.preamble.rawPreambleNodes) {
    if (n.type === 'command' && n.name === 'title') docTitle = flatText(n.reqArgs[0] ?? [])
    if (n.type === 'command' && n.name === 'author') docAuthor = flatText(n.reqArgs[0] ?? [])
    if (n.type === 'command' && n.name === 'date') docDate = flatText(n.reqArgs[0] ?? [])
  }

  const ctx: TransformContext = {
    colors: colorMap,
    customEnvs: envStyles,
    macros: buildMacroMap(ast.preamble),
    labels: new Map(),
    sectionCounters: [0, 0, 0],
    tocEntries: [],
    options: { numberSections: true, expandMacros: true, resolveRefs: true, ...options },
    docTitle,
    docAuthor,
    docDate,
    tikzCounter: 0,
  }

  // First pass: collect labels with placeholder text
  let _labelCounter = 0
  collectLabels(ast.body, ctx.labels, () => String(++_labelCounter))

  // Second pass: transform body
  const children = transformNodes(ast.body, ctx)

  // Build document node
  const docMeta: {
    documentClass: string
    colors: typeof ast.preamble.colors
    title?: string
    author?: string
    date?: string
  } = {
    documentClass: ast.preamble.documentClass,
    colors: ast.preamble.colors,
  }
  if (ctx.docTitle)  docMeta.title  = ctx.docTitle
  if (ctx.docAuthor) docMeta.author = ctx.docAuthor
  if (ctx.docDate)   docMeta.date   = ctx.docDate

  const docNode: DocumentRenderNode = {
    type: 'document',
    metadata: docMeta,
    children,
  }

  return [docNode]
}

// Commands that are always block-level (never inline)
const BLOCK_COMMANDS = new Set([
  'section', 'section*', 'subsection', 'subsection*',
  'subsubsection', 'subsubsection*', 'paragraph', 'subparagraph',
  'maketitle', 'tableofcontents',
  'newpage', 'clearpage',
  'hline', 'toprule', 'midrule', 'bottomrule',
  'rule', 'hrule',
  'par', 'medskip', 'bigskip', 'smallskip',
])

function isInlineNode(n: ASTNode): boolean {
  if (n.type === 'text') return true
  if (n.type === 'math') return n.kind === 'inline'
  if (n.type === 'group') return true
  if (n.type === 'comment') return true
  if (n.type === 'command') {
    if (BLOCK_COMMANDS.has(n.name)) return false
    return true  // all other commands treated as inline
  }
  if (n.type === 'environment') return false  // environments are always block
  if (n.type === 'verbatim') return false
  return false
}

function transformNodes(nodes: readonly ASTNode[], ctx: TransformContext): RenderNode[] {
  const result: RenderNode[] = []
  let i = 0

  while (i < nodes.length) {
    const node = nodes[i]!

    // Skip pure-whitespace paragraph breaks at block level
    if (node.type === 'text' && /^\s+$/.test(node.content)) {
      i++
      continue
    }

    // Block: display math
    if (node.type === 'math' && node.kind === 'display') {
      result.push({ type: 'mathDisplay', latex: node.content })
      i++
      continue
    }

    // Accumulate consecutive inline nodes into a paragraph
    if (isInlineNode(node)) {
      const inlines: ASTNode[] = []
      while (i < nodes.length && isInlineNode(nodes[i]!)) {
        inlines.push(nodes[i]!)
        i++
      }

      // Transform each inline node, preserving inter-node whitespace
      const children = transformInlineSequence(inlines, ctx)
      if (children.length > 0) {
        result.push({ type: 'paragraph', children })
      }
      continue
    }

    // Block node
    const r = transformNode(node, ctx)
    if (r !== null) result.push(r)
    i++
  }

  return result
}

/**
 * Transform a sequence of inline AST nodes into RenderNodes,
 * carefully preserving the whitespace that LaTeX provides between tokens.
 * This ensures "word \textbf{bold} word" 	 "word <strong>bold</strong> word"
 * with spaces intact.
 */
function transformInlineSequence(nodes: readonly ASTNode[], ctx: TransformContext): RenderNode[] {
  const result: RenderNode[] = []

  for (const n of nodes) {
    if (n.type === 'comment') continue

    // Whitespace / paragraph-break text nodes: collapse to single space
    if (n.type === 'text') {
      // Paragraph break (blank line) inside inline sequence 	 end paragraph
      // (shouldn't happen often but handle gracefully)
      const isBlank = /^\s*\n\s*\n\s*$/.test(n.content)
      if (isBlank) continue

      // Normalise: collapse all whitespace runs to single space,
      // but preserve leading/trailing space (LaTeX does keep inter-word space)
      const content = n.content.replace(/\s+/g, ' ')
      if (!content) continue
      // Merge with previous text node if possible to avoid fragmentation
      const last = result[result.length - 1]
      if (last?.type === 'text') {
        ;(last as { type: 'text'; content: string }).content += content
      } else {
        result.push({ type: 'text', content })
      }
      continue
    }

    const rendered = transformNode(n, ctx)
    if (rendered === null) continue
    result.push(rendered)
  }

  // Trim leading/trailing pure-whitespace text nodes
  while (result.length > 0 && result[0]?.type === 'text' && !(result[0] as { content: string }).content.trim()) {
    result.shift()
  }
  while (result.length > 0) {
    const last = result[result.length - 1]!
    if (last.type === 'text' && !(last as { content: string }).content.trim()) {
      result.pop()
    } else break
  }

  return result
}

function transformNode(node: ASTNode, ctx: TransformContext): RenderNode | null {
  switch (node.type) {
    case 'text': return transformText(node)
    case 'math': return transformMath(node)
    case 'comment': return null
    case 'group': return transformGroup(node, ctx)
    case 'command': return transformCommand(node, ctx)
    case 'environment': return transformEnvironment(node, ctx)
    case 'verbatim': return transformVerbatim(node, ctx)
    default: return null
  }
}

function transformText(node: TextASTNode): TextRenderNode | null {
  // Drop completely empty strings
  if (node.content === '') return null
  // Drop pure LaTeX line-break artifacts: "\\" or "\\[skip]" leaked as text
  // These arise from \\[skip] tokenizing as NEWLINE("\\\\") + optional-bracket content
  const trimmed = node.content.trim()
  if (/^\\\\+$/.test(trimmed)) return null
  // Drop stray dimension-only text nodes — artifacts of \\[0.5em], \vspace{2cm} etc.
  // Pattern: optional backslashes, a number, a LaTeX unit
  if (/^\\*\d+(\.\d+)?\s*(pt|cm|mm|in|em|ex|pc|bp|dd|cc|sp)$/.test(trimmed)) return null
  // Keep whitespace-only nodes — they matter for inter-word spacing.
  return { type: 'text', content: node.content }
}

function transformMath(node: MathASTNode): MathInlineRenderNode | MathDisplayRenderNode {
  if (node.kind === 'inline') return { type: 'mathInline', latex: node.content }
  return { type: 'mathDisplay', latex: node.content }
}

// ── LaTeX font-size declaration 	 CSS font-size ───────────────────────────
// LaTeX 10pt base sizes (article class default)
const FONT_SIZE_MAP: Record<string, string> = {
  tiny:         '5pt',
  scriptsize:   '7pt',
  footnotesize: '8pt',
  small:        '9pt',
  normalsize:   '10pt',
  large:        '10.95pt',
  Large:        '12pt',
  LARGE:        '14.4pt',
  huge:         '17.28pt',
  Huge:         '20.74pt',
}
// ── LaTeX font declaration commands (zero-arg, state-changing) ────────────
// These set the current font weight/style when encountered inside a group.
const FONT_WEIGHT_MAP: Record<string, string> = {
  bfseries: 'bold',
  mdseries: 'normal',
  textbf:   'bold',   // textbf with arg is handled separately
}
const FONT_STYLE_MAP: Record<string, string> = {
  itshape:  'italic',
  slshape:  'italic',
  upshape:  'normal',
  emph:     'italic',
}
const FONT_VARIANT_MAP: Record<string, string> = {
  scshape: 'small-caps',
}
const FONT_FAMILY_MAP: Record<string, string> = {
  ttfamily: 'monospace',
  sffamily: 'sans-serif',
  rmfamily: 'serif',
}
const ALIGN_MAP: Record<string, string> = {
  centering:   'center',
  raggedright: 'left',
  raggedleft:  'right',
}
// All zero-argument declaration commands (used to identify them in groups)
const ALL_DECL_COMMANDS = new Set([
  ...Object.keys(FONT_SIZE_MAP),
  ...Object.keys(FONT_WEIGHT_MAP),
  ...Object.keys(FONT_STYLE_MAP),
  ...Object.keys(FONT_VARIANT_MAP),
  ...Object.keys(FONT_FAMILY_MAP),
  ...Object.keys(ALIGN_MAP),
  'color',   // \color{name} — declarative form
])

function transformGroup(node: GroupASTNode, ctx: TransformContext): RenderNode | null {
  // Scan the group's children for declaration commands and build a style object.
  // Declaration commands are zero-argument commands that set the current font/color.
  // Example: {\Huge\bfseries Some Title} 	 <span style="font-size:20.74pt;font-weight:bold">Some Title</span>
  const style: {
    fontSize?: string
    fontWeight?: string
    fontStyle?: string
    fontVariant?: string
    fontFamily?: string
    color?: string
    textAlign?: string
  } = {}

  // Strip declaration nodes from the front of children, accumulate style
  let contentStart = 0
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!
    if (child.type !== 'command') break
    const name = (child as CommandNode).name
    const fontSize = FONT_SIZE_MAP[name]
    const fontWeight = FONT_WEIGHT_MAP[name]
    const fontStyle = FONT_STYLE_MAP[name]
    const fontVariant = FONT_VARIANT_MAP[name]
    const fontFamily = FONT_FAMILY_MAP[name]
    const textAlign = ALIGN_MAP[name]
    if (fontSize !== undefined) {
      style.fontSize = fontSize
      contentStart = i + 1
    } else if (fontWeight !== undefined && (child as CommandNode).reqArgs.length === 0) {
      style.fontWeight = fontWeight
      contentStart = i + 1
    } else if (fontStyle !== undefined && (child as CommandNode).reqArgs.length === 0) {
      style.fontStyle = fontStyle
      contentStart = i + 1
    } else if (fontVariant !== undefined) {
      style.fontVariant = fontVariant
      contentStart = i + 1
    } else if (fontFamily !== undefined && (child as CommandNode).reqArgs.length === 0) {
      style.fontFamily = fontFamily
      contentStart = i + 1
    } else if (textAlign !== undefined) {
      style.textAlign = textAlign
      contentStart = i + 1
    } else if (name === 'color' && (child as CommandNode).reqArgs.length >= 1) {
      // \color{colorname} — declarative form (affects rest of group)
      const colorName = flatText((child as CommandNode).reqArgs[0] ?? [])
      style.color = resolveColor(colorName, ctx)
      contentStart = i + 1
    } else {
      // Not a declaration command — stop scanning
      break
    }
  }

  const contentNodes = node.children.slice(contentStart)
  const children = contentNodes
    .map(n => transformNode(n, ctx))
    .filter((n): n is RenderNode => n !== null)

  if (children.length === 0) return null

  // If we found style declarations, wrap in a StyledTextRenderNode
  const hasStyle = Object.keys(style).length > 0
  if (hasStyle) {
    // Build node explicitly to satisfy exactOptionalPropertyTypes
    const styled: StyledTextRenderNode = { type: 'styledText', children }
    const mutable = styled as {
      -readonly [K in keyof StyledTextRenderNode]: StyledTextRenderNode[K]
    }
    if (style.fontSize   !== undefined) mutable.fontSize   = style.fontSize
    if (style.fontWeight !== undefined) mutable.fontWeight = style.fontWeight
    if (style.fontStyle  !== undefined) mutable.fontStyle  = style.fontStyle
    if (style.fontVariant !== undefined) mutable.fontVariant = style.fontVariant
    if (style.fontFamily !== undefined) mutable.fontFamily = style.fontFamily
    if (style.color      !== undefined) mutable.color      = style.color
    if (style.textAlign  !== undefined) mutable.textAlign  = style.textAlign
    return styled
  }

  // No style found — just pass through children
  if (children.length === 1) return children[0]!
  return { type: 'paragraph', children }
}

function transformCommand(node: CommandNode, ctx: TransformContext): RenderNode | null {
  const name = node.name

  // Macro expansion
  if (ctx.options.expandMacros && ctx.macros.has(name)) {
    const expanded = ctx.macros.get(name)!
    const children = expanded
      .map(n => transformNode(n, ctx))
      .filter((n): n is RenderNode => n !== null)
    if (children.length === 1) return children[0]!
    if (children.length > 1) return { type: 'paragraph', children }
    return null
  }

  const arg0 = node.reqArgs[0] ?? []
  const arg1 = node.reqArgs[1] ?? []

  switch (name) {
    case 'section':
    case 'section*': {
      const number = name.endsWith('*') ? '' : incrementSection(ctx, 1)
      const title = arg0.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      const titleText = flatText(arg0)
      const id = `section-${number.replace(/\./g, '-') || titleText.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}`
      if (number && ctx.options.numberSections !== false) {
        ctx.labels.set(name, number)
        ctx.tocEntries.push({ level: 1, number, title: titleText, id })
      }
      const sNode: SectionRenderNode = { type: 'section', level: 1, title, number, id, children: [] }
      return sNode
    }
    case 'subsection':
    case 'subsection*': {
      const number = name.endsWith('*') ? '' : incrementSection(ctx, 2)
      const title = arg0.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      const titleText = flatText(arg0)
      const id = `section-${number.replace(/\./g, '-') || titleText.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}`
      if (number) ctx.tocEntries.push({ level: 2, number, title: titleText, id })
      return { type: 'section', level: 2, title, number, id, children: [] }
    }
    case 'subsubsection':
    case 'subsubsection*': {
      const number = name.endsWith('*') ? '' : incrementSection(ctx, 3)
      const title = arg0.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      const titleText = flatText(arg0)
      const id = `section-${number.replace(/\./g, '-') || titleText.toLowerCase().replace(/\s+/g, '-').slice(0, 40)}`
      if (number) ctx.tocEntries.push({ level: 3, number, title: titleText, id })
      return { type: 'section', level: 3, title, number, id, children: [] }
    }

    case 'textbf': {
      const children = arg0.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      const b: BoldRenderNode = { type: 'bold', children }
      return b
    }
    case 'emph':
    case 'textit': {
      const children = arg0.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      const it: ItalicRenderNode = { type: 'italic', children }
      return it
    }
    case 'texttt': {
      const inner = flatText(arg0)
      return { type: 'inlineCode', content: inner }
    }
    case 'textsc':
    case 'textsf':
    case 'textrm': {
      // Font change only — render content as-is
      const children = arg0.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      if (children.length === 0) return null
      if (children.length === 1) return children[0]!
      return { type: 'paragraph', children }
    }
    case 'underline': {
      const children = arg0.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      return { type: 'underline', children }
    }

    case 'textcolor': {
      const colorName = flatText(arg0)
      const hex = resolveColor(colorName, ctx)
      const children = arg1.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      const c: ColorRenderNode = { type: 'color', color: hex, children, style: { color: hex } }
      return c
    }

    case 'colorbox':
    case 'fcolorbox': {
      const colorName = flatText(arg0)
      const hex = resolveColor(colorName, ctx)
      const children = arg1.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      return { type: 'color', color: hex, children, style: { color: hex } }
    }

    case 'href': {
      const url = flatText(arg0)
      const children = arg1.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      const link: LinkRenderNode = { type: 'link', href: url, children }
      return link
    }
    case 'url':
    case 'hyperref': {
      const url = flatText(arg0)
      return { type: 'link', href: url, children: [{ type: 'text', content: url }] }
    }

    case 'ref': {
      const targetId = flatText(arg0)
      const resolvedText = ctx.labels.get(targetId) ?? '?'
      const ref: ReferenceRenderNode = { type: 'reference', targetId, resolvedText }
      return ref
    }
    case 'label':
      return null

    // Special characters as text
    case 'textbackslash':   return { type: 'text', content: '\\' }
    case 'textasciitilde':  return { type: 'text', content: '~' }
    case 'textasciicircum': return { type: 'text', content: '^' }
    case 'textbar':         return { type: 'text', content: '|' }
    case 'textless':        return { type: 'text', content: '<' }
    case 'textgreater':     return { type: 'text', content: '>' }
    case 'ldots':
    case 'dots':
    case 'cdots':           return { type: 'text', content: '…' }
    case 'dash':
    case 'endash':          return { type: 'text', content: '–' }
    case 'emdash':          return { type: 'text', content: '—' }
    case 'LaTeX':           return { type: 'text', content: 'LaTeX' }
    case 'TeX':             return { type: 'text', content: 'TeX' }
    case 'BibTeX':          return { type: 'text', content: 'BibTeX' }

    case 'includegraphics': {
      const src = flatText(arg0)
      // Parse width from optional args: [width=0.8\linewidth, height=3cm]
      const optText = node.optArgs.length > 0 ? flatText(node.optArgs[0] ?? []) : ''
      let cssWidth: string | undefined
      // Match width=<value> — value may be a LaTeX dimension or command
      const widthMatch = optText.match(/width\s*=\s*([^,\]]+)/)
      if (widthMatch) {
        const raw = widthMatch[1]!.trim()
        // Convert common LaTeX width expressions to CSS
        if (raw.includes('linewidth') || raw.includes('textwidth') || raw === '\\linewidth' || raw === '\\textwidth') {
          // Extract numeric multiplier if present: 0.8\linewidth 	 80%
          const multMatch = raw.match(/^([0-9.]+)/)
          cssWidth = multMatch ? `${Math.round(parseFloat(multMatch[1]!) * 100)}%` : '100%'
        } else if (raw.match(/^[0-9.]+\s*(cm|mm|in|pt|em|ex|px|%)$/)) {
          cssWidth = raw  // already a valid CSS unit
        } else if (raw.match(/^[0-9.]+$/)) {
          cssWidth = raw + 'pt'  // bare number — treat as pt
        }
        // If none of the above matched, leave cssWidth undefined (no style attr)
      }
      const img: ImageRenderNode = {
        type: 'image',
        src,
        alt: src,
        width: cssWidth,
      }
      return img
    }

    case 'caption': {
      const children = arg0.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      const cap: CaptionRenderNode = { type: 'caption', children }
      return cap
    }

    case 'item': {
      const children = arg0.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      const li: ListItemRenderNode = { type: 'listItem', children }
      return li
    }

    case 'tableofcontents':
      // Returns a placeholder; the real TOCNode is inserted at DocumentNode level
      return { type: 'toc', entries: ctx.tocEntries }

    case 'hline':
      return { type: 'tableRule', ruleKind: 'hline' }
    case 'toprule':
      return { type: 'tableRule', ruleKind: 'top' }
    case 'midrule':
      return { type: 'tableRule', ruleKind: 'mid' }
    case 'bottomrule':
      return { type: 'tableRule', ruleKind: 'bottom' }
    case 'maketitle': {
      const tpMeta: { title?: string; author?: string; date?: string } = {}
      if (ctx.docTitle)  tpMeta.title  = ctx.docTitle
      if (ctx.docAuthor) tpMeta.author = ctx.docAuthor
      if (ctx.docDate)   tpMeta.date   = ctx.docDate
      const tp: TitlePageRenderNode = {
        type: 'titlePage',
        children: [],
        metadata: tpMeta,
      }
      return tp
    }
    case 'hfill':
    case 'vfill':
      return { type: 'text', content: ' ' }
    case 'newpage':
    case 'clearpage':
      return { type: 'pageBreak' }
    case 'rule':
    case 'hrule':
      return { type: 'hRule' }
    // Formatting / spacing commands that silently vanish
    case 'noindent':
    case 'par':
    case 'medskip':
    case 'bigskip':
    case 'smallskip':
    case 'vspace':
    case 'vspace*':
    case 'hspace':
    case 'hspace*':
    case 'linewidth':
    case 'textwidth':
    case 'columnsep':
    case 'sloppy':
    case 'relax':
    case 'protect':
    case 'newline':
    case 'linebreak':
    case '\\':        // \\ line break (with optional [skip] arg)
    case 'quad':
    case 'qquad':
    case 'thinspace':
    case 'enspace':
    case 'negthinspace':
    case 'arraybackslash':
    case 'allowbreak':
    case 'nobreak':
    case 'penalty':
    case 'vfil':
    case 'null':
      return null
    // Font-size declarations outside groups: render content with font-size style
    // When standalone (no content), these are pure state changes — drop them.
    // This handles cases like: \large Some text (rare in practice, \large is
    // almost always inside a group — but handle gracefully anyway)
    case 'normalsize':
    case 'large':
    case 'Large':
    case 'LARGE':
    case 'huge':
    case 'Huge':
    case 'small':
    case 'footnotesize':
    case 'scriptsize':
    case 'tiny': {
      // If the command was parsed with a required arg (shouldn't happen for
      // size declarations, but be defensive), render it with font styling.
      if (arg0.length > 0) {
        const fontSize = FONT_SIZE_MAP[name] ?? '10pt'
        const children = arg0.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
        if (children.length === 0) return null
        const styled: StyledTextRenderNode = { type: 'styledText', fontSize, children }
        return styled
      }
      // Standalone size declaration — pure state change, drop it
      return null
    }
    // Font-shape/weight declarations outside groups — drop (state change only)
    case 'centering':
    case 'raggedright':
    case 'raggedleft':
    case 'bfseries':
    case 'mdseries':
    case 'itshape':
    case 'upshape':
    case 'slshape':
    case 'scshape':
    case 'rmfamily':
    case 'sffamily':
    case 'ttfamily':
      return null

    case 'multicolumn': {
      // \multicolumn{n}{align}{content}
      const n = parseInt(flatText(arg0)) || 1
      const alignRaw2 = flatText(arg1)
      const align2: 'left' | 'center' | 'right' = alignRaw2.startsWith('c') ? 'center' : alignRaw2.startsWith('r') ? 'right' : 'left'
      const contentNodes = (node.reqArgs[2] ?? [])
        .map(n => transformNode(n, ctx))
        .filter((n): n is RenderNode => n !== null)
      const cell: TableCellRenderNode = {
        type: 'tableCell', colspan: n, rowspan: 1,
        align: align2,
        children: contentNodes,
      }
      return cell
    }

    default: {
      // Unknown command — silently drop it.
      // Do NOT render its args as raw text — that causes LaTeX to leak into output.
      // Exception: \text{...} inside math-like contexts — render content
      return null
    }
  }
}

function transformEnvironment(node: EnvironmentNode, ctx: TransformContext): RenderNode | null {
  const name = node.name

  // Custom box environments
  if (ctx.customEnvs.has(name)) {
    const style = ctx.customEnvs.get(name)!
    const children = transformNodes(node.body, ctx)
    const box: CustomBoxRenderNode = {
      type: 'customBox',
      label: name,
      borderColor: style.borderColor,
      bgColor: style.bgColor,
      children,
    }
    return box
  }

  switch (name) {
    case 'document':
      return null // handled at top level

    case 'itemize': {
      const items = transformListItems(node.body, ctx)
      const list: ListRenderNode = { type: 'list', ordered: false, children: items }
      return list
    }
    case 'enumerate': {
      const items = transformListItems(node.body, ctx)
      const list: ListRenderNode = { type: 'list', ordered: true, children: items }
      return list
    }

    case 'tabular':
    case 'longtable':
    case 'tabularx':
    case 'array':
      return transformTable(node, ctx)

    case 'figure':
    case 'figure*': {
      const children = node.body.map(n => transformNode(n, ctx)).filter((n): n is RenderNode => n !== null)
      const fig: FigureRenderNode = { type: 'figure', children }
      return fig
    }

    case 'tikzpicture': {
      const raw = flattenBodyToString(node.body)
      ctx.tikzCounter++
      const tikz: TikzRenderNode = {
        type: 'tikz',
        rawSource: `\\begin{tikzpicture}${raw}\\end{tikzpicture}`,
        diagramIndex: ctx.tikzCounter,
      }
      return tikz
    }

    case 'axis': {
      const raw = flattenBodyToString(node.body)
      ctx.tikzCounter++
      const plot: PlotRenderNode = {
        type: 'plot',
        rawSource: `\\begin{axis}${raw}\\end{axis}`,
        diagramIndex: ctx.tikzCounter,
      }
      return plot
    }

    case 'center': {
      const children = transformNodes(node.body, ctx)
      const c: CenterRenderNode = { type: 'center', children }
      return c
    }

    case 'abstract': {
      const children = transformNodes(node.body, ctx)
      const a: AbstractRenderNode = { type: 'abstract', children }
      return a
    }

    case 'titlepage': {
      const children = transformNodes(node.body, ctx)
      const tp: TitlePageRenderNode = { type: 'titlePage', children }
      return tp
    }

    case 'multicols':
    case 'minipage': {
      // Treat as a generic container — just render children
      const children = transformNodes(node.body, ctx)
      return { type: 'paragraph', children }
    }

    case 'mdframed': {
      // Inline mdframed without a custom env name
      const lineColor = node.optArgs.find(o => o.key === 'linecolor')?.value ?? 'gray'
      const bgOpt = node.optArgs.find(o => o.key === 'backgroundcolor')?.value ?? 'transparent'
      const borderColor = resolveColor(lineColor, ctx)
      const bgColor = resolveColor(bgOpt, ctx) || 'transparent'
      const children = transformNodes(node.body, ctx)
      return { type: 'customBox', label: 'mdframed', borderColor, bgColor, children }
    }

    case 'lstlisting': {
      // Should be handled as verbatim but fallback here
      const raw = flattenBodyToString(node.body)
      const lang = node.optArgs.find(o => o.key === 'language')?.value ?? ''
      const code: CodeBlockRenderNode = { type: 'codeBlock', code: raw, language: lang.toLowerCase() }
      return code
    }

    case 'verbatim':
    case 'Verbatim': {
      const raw = flattenBodyToString(node.body)
      return { type: 'codeBlock', code: raw, language: '' }
    }

    case 'align':
    case 'align*':
    case 'equation':
    case 'equation*':
    case 'gather':
    case 'gather*':
    case 'multline':
    case 'multline*': {
      const raw = flattenBodyToString(node.body)
      const dm: MathDisplayRenderNode = { type: 'mathDisplay', latex: raw }
      return dm
    }

    case 'tabbing':
    case 'flushleft': {
      const children = transformNodes(node.body, ctx)
      const styled: StyledTextRenderNode = { type: 'styledText', textAlign: 'left', children }
      return styled
    }
    case 'flushright': {
      const children = transformNodes(node.body, ctx)
      const styled: StyledTextRenderNode = { type: 'styledText', textAlign: 'right', children }
      return styled
    }
    case 'quote':
    case 'quotation': {
      const children = transformNodes(node.body, ctx)
      // Render as a custom box with quote styling
      return { type: 'customBox', label: 'quote', borderColor: 'transparent', bgColor: 'transparent', children }
    }
    case 'description': {
      // \begin{description}\item[term] def\end{description}
      const items = transformListItems(node.body, ctx)
      const list: ListRenderNode = { type: 'list', ordered: false, children: items }
      return list
    }

    default: {
      // Unknown environment — render its body
      const children = transformNodes(node.body, ctx)
      if (children.length === 0) return null
      if (children.length === 1) return children[0]!
      return { type: 'paragraph', children }
    }
  }
}

function transformVerbatim(node: VerbatimASTNode, ctx: TransformContext): CodeBlockRenderNode {
  const langOpt = node.options.find(o => o.key === 'language')
  const lang = langOpt?.value ?? ctx['options' as keyof typeof ctx] as unknown as string ?? ''
  return { type: 'codeBlock', code: node.content, language: (typeof lang === 'string' ? lang : '').toLowerCase() }
}

// ── Table transformer ─────────────────────────────────────────────────────

/** Parse LaTeX column spec string into per-column alignments */
function parseColSpec(spec: string): Array<'left' | 'center' | 'right'> {
  const aligns: Array<'left' | 'center' | 'right'> = []
  let i = 0
  while (i < spec.length) {
    const ch = spec[i]!
    if (ch === 'l' || ch === 'L') { aligns.push('left'); i++; continue }
    if (ch === 'c' || ch === 'C') { aligns.push('center'); i++; continue }
    if (ch === 'r' || ch === 'R') { aligns.push('right'); i++; continue }
    if (ch === 'p' || ch === 'm' || ch === 'b' || ch === 'X') {
      aligns.push('left')
      i++
      if (i < spec.length && spec[i] === '{') {
        let depth = 0
        while (i < spec.length) {
          if (spec[i] === '{') depth++
          else if (spec[i] === '}') { depth--; if (depth === 0) { i++; break } }
          i++
        }
      }
      continue
    }
    i++ // skip | @ > { } etc.
  }
  return aligns
}

function transformTable(node: EnvironmentNode, ctx: TransformContext): TableRenderNode {
  const rows: (TableRowRenderNode | TableRuleRenderNode)[] = []
  let caption: RenderNode[] | undefined

  // Split body by \\ (NEWLINE tokens) to get rows
  // Body contains raw ASTNodes; we need to process them into rows/cells
  // Parse column spec: "lrr", "|l|r|c|", "p{2cm}", etc.
  const colAligns = parseColSpec(node.columnSpec ?? '')

  const rowGroups = splitTableRows(node.body)

  for (const rowNodes of rowGroups) {
    // Check if this row is a rule command
    if (rowNodes.length === 1 && rowNodes[0]?.type === 'command') {
      const cmd = rowNodes[0] as CommandNode
      if (['toprule', 'midrule', 'bottomrule', 'hline'].includes(cmd.name)) {
        const ruleKind = cmd.name === 'toprule' ? 'top'
          : cmd.name === 'midrule' ? 'mid'
          : cmd.name === 'bottomrule' ? 'bottom'
          : 'hline'
        rows.push({ type: 'tableRule', ruleKind })
        continue
      }
    }
    if (rowNodes.length === 1 && rowNodes[0]?.type === 'command' && (rowNodes[0] as CommandNode).name === 'caption') {
      const capCmd = rowNodes[0] as CommandNode
      caption = (capCmd.reqArgs[0] ?? [])
        .map(n => transformNode(n, ctx))
        .filter((n): n is RenderNode => n !== null)
      continue
    }

    // Split by AMPERSAND to get cells
    const cellGroups = splitTableCells(rowNodes)
    if (cellGroups.length === 0) continue

    const cells: TableCellRenderNode[] = []
    for (let colIdx = 0; colIdx < cellGroups.length; colIdx++) {
      const cellNodes = cellGroups[colIdx]!
      // Check for \multicolumn
      if (cellNodes.length >= 1 && cellNodes[0]?.type === 'command' && (cellNodes[0] as CommandNode).name === 'multicolumn') {
        const mc = cellNodes[0] as CommandNode
        const span = parseInt(flatText(mc.reqArgs[0] ?? [])) || 1
        const alignRaw = flatText(mc.reqArgs[1] ?? [])
        const align: 'left' | 'center' | 'right' = alignRaw.startsWith('c') ? 'center' : alignRaw.startsWith('r') ? 'right' : 'left'
        const children = (mc.reqArgs[2] ?? [])
          .map(n => transformNode(n, ctx))
          .filter((n): n is RenderNode => n !== null)
        cells.push({ type: 'tableCell', colspan: span, rowspan: 1, align, children })
      } else {
        const colAlign = colAligns[colIdx] ?? 'left'
        const children = transformNodes(cellNodes, ctx)
        cells.push({ type: 'tableCell', colspan: 1, rowspan: 1, align: colAlign, children })
      }
    }

    // Skip completely empty rows
    if (cells.every(c => c.children.length === 0)) continue

    rows.push({ type: 'tableRow', isHeader: false, children: cells })
  }

  return caption !== undefined
    ? { type: 'table', caption, children: rows }
    : { type: 'table', children: rows }
}

function splitTableRows(nodes: readonly ASTNode[]): ASTNode[][] {
  const rows: ASTNode[][] = []
  let current: ASTNode[] = []

  for (const n of nodes) {
    // Skip pure whitespace text
    if (n.type === 'text' && n.content.replace(/\s/g, '') === '') continue

    // Rule commands are their own rows
    if (n.type === 'command' && ['toprule', 'midrule', 'bottomrule', 'hline'].includes(n.name)) {
      if (current.length > 0) { rows.push(current); current = [] }
      rows.push([n])
      continue
    }

    // Caption commands
    if (n.type === 'command' && n.name === 'caption') {
      if (current.length > 0) { rows.push(current); current = [] }
      rows.push([n])
      continue
    }

    // \\ line-break CommandNode 	 end of row (new parser format)
    if (n.type === 'command' && n.name === '\\') {
      if (current.length > 0) { rows.push(current); current = [] }
      continue
    }

    // Legacy: Text node containing \\ row separator — split on it
    // (kept for backward-compat with text nodes that might contain \\)
    if (n.type === 'text' && n.content.includes('\\\\')) {
      const parts = n.content.split('\\\\')
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!
        if (part.trim()) current.push({ type: 'text', content: part, pos: (n as TextASTNode).pos })
        if (i < parts.length - 1) {
          // End of row
          if (current.length > 0) { rows.push(current); current = [] }
        }
      }
      continue
    }

    current.push(n)
  }
  if (current.length > 0) rows.push(current)
  return rows
}

function splitTableCells(nodes: ASTNode[]): ASTNode[][] {
  const cells: ASTNode[][] = []
  let current: ASTNode[] = []
  for (const n of nodes) {
    // AMPERSAND token was tokenized; in AST it becomes a TextNode with value '&'
    // But in our parser AMPERSAND tokens are not turned into nodes — they stay as tokens
    // The body of a tabular env has raw nodes; ampersands come in as text nodes with '&'
    if (n.type === 'text' && n.content.trim() === '&') {
      cells.push(current); current = []
      continue
    }
    current.push(n)
  }
  cells.push(current)
  return cells
}

// ── List transformer ──────────────────────────────────────────────────────

function transformListItems(nodes: readonly ASTNode[], ctx: TransformContext): ListItemRenderNode[] {
  const items: ListItemRenderNode[] = []
  let currentItemNodes: ASTNode[] = []
  let inItem = false

  for (const n of nodes) {
    if (n.type === 'command' && n.name === 'item') {
      if (inItem && currentItemNodes.length > 0) {
        const children = transformNodes(currentItemNodes, ctx)
        items.push({ type: 'listItem', children })
        currentItemNodes = []
      }
      inItem = true
      // \item content may have optional arg (label)
      if (n.reqArgs[0] && n.reqArgs[0].length > 0) {
        currentItemNodes.push(...n.reqArgs[0])
      }
    } else if (inItem) {
      currentItemNodes.push(n)
    }
  }
  if (inItem && currentItemNodes.length > 0) {
    const children = transformNodes(currentItemNodes, ctx)
    items.push({ type: 'listItem', children })
  }
  return items
}

// ── Utility: flatten AST body to raw string ───────────────────────────────

function flattenBodyToString(nodes: readonly ASTNode[]): string {
  return nodes.map(n => {
    if (n.type === 'text') return n.content
    if (n.type === 'verbatim') return n.content
    if (n.type === 'math') return n.kind === 'inline' ? `$${n.content}$` : `$$${n.content}$$`
    if (n.type === 'command') {
      let s = '\\' + n.name
      for (const opt of n.optArgs) s += '[' + flatText(opt) + ']'
      for (const req of n.reqArgs) s += '{' + flatText(req) + '}'
      return s
    }
    if (n.type === 'environment') return `\\begin{${n.name}}${flattenBodyToString(n.body)}\\end{${n.name}}`
    if (n.type === 'group') return '{' + flattenBodyToString(n.children) + '}'
    return ''
  }).join('')
}
