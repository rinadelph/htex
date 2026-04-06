// =============================================================================
// @htex/core — renderers/svg.ts
// Converts RenderTree → an SVG string suitable for embedding or standalone use.
//
// Design philosophy:
//   • Pure text flow: text nodes are laid out top-to-bottom using <text> and
//     <tspan> elements, no foreignObject (maximum compatibility).
//   • Structural fidelity: sections get a visual group separator, tables render
//     as <rect>/<line>/<text> grids, code blocks use a <rect>+<text> approach.
//   • Math is expressed as raw LaTeX strings inside <text class="htex-math">,
//     allowing a client-side renderer (e.g. MathJax) to post-process the SVG.
//   • All measurements use heuristic em-based metrics (no DOM required).
// =============================================================================

import type {
  RenderNode,
  RenderTree,
  RenderOptions,
  DocumentRenderNode,
  SectionRenderNode,
  TableRenderNode,
  TableRowRenderNode,
  TableCellRenderNode,
  TableRuleRenderNode,
  ColorDef,
} from '../types.js'

// ── Constants ─────────────────────────────────────────────────────────────

const FONT_SIZE = 16      // px body font
const LINE_HEIGHT = 24    // px
const HEADING_SIZES = [32, 24, 20] // h1, h2, h3
const MONO_SIZE = 13
const H_PADDING = 32      // horizontal margin
const V_PADDING = 32      // top/bottom margin
const CHAR_W = 8.5        // heuristic character width for body text
const MONO_CHAR_W = 7.5   // monospace character width

// ── Helpers ───────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Wrap text at `maxWidth` pixels, returns array of lines */
function wrapText(text: string, maxWidth: number, charW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (test.length * charW > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

/** Extract all text content from a node as a plain string */
function extractText(nodes: readonly RenderNode[]): string {
  return nodes.map(n => {
    switch (n.type) {
      case 'text':       return n.content
      case 'inlineCode': return n.content
      case 'bold':
      case 'italic':
      case 'underline':
      case 'color':
      case 'paragraph':
      case 'listItem':
      case 'link':
      case 'caption':
      case 'center':
      case 'abstract':
      case 'titlePage':
      case 'customBox':  return extractText(n.children)
      case 'mathInline': return n.latex
      case 'mathDisplay': return n.latex
      default: return ''
    }
  }).join('')
}

// ── Context: tracks current Y position and accumulates SVG elements ────────

interface SvgCtx {
  width: number
  contentWidth: number
  theme: 'light' | 'dark'
  fg: string
  bg: string
  linkColor: string
  codeBg: string
  borderColor: string
  colorMap: Map<string, string>
  elements: string[]
  y: number
  idCounter: number
  usedIds: Set<string>
}

function mkCtx(width: number, theme: 'light' | 'dark', colors: readonly ColorDef[]): SvgCtx {
  const isDark = theme === 'dark'
  const colorMap = new Map<string, string>()
  for (const c of colors) colorMap.set(c.name, c.hex)

  return {
    width,
    contentWidth: width - H_PADDING * 2,
    theme,
    fg: isDark ? '#E6EDF3' : '#1a1a1a',
    bg: isDark ? '#0D1117' : '#ffffff',
    linkColor: isDark ? '#58A6FF' : '#0969da',
    codeBg: isDark ? '#161B22' : '#f6f8fa',
    borderColor: isDark ? '#30363D' : '#d0d7de',
    colorMap,
    elements: [],
    y: V_PADDING,
    idCounter: 0,
    usedIds: new Set(),
  }
}

function push(ctx: SvgCtx, el: string) { ctx.elements.push(el) }

function addVSpace(ctx: SvgCtx, px: number) { ctx.y += px }

// ── Render dispatch ───────────────────────────────────────────────────────

function renderNode(node: RenderNode, ctx: SvgCtx): void {
  switch (node.type) {
    case 'document':    renderDocument(node, ctx); break
    case 'section':     renderSection(node, ctx); break
    case 'paragraph':   renderParagraph(node, ctx); break
    case 'text':        renderParagraphSegments([{ text: node.content, fill: ctx.fg, bold: false, italic: false, isMath: false }], ctx); addVSpace(ctx, 8); break
    case 'inlineCode':  renderParagraphSegments([{ text: node.content, fill: ctx.fg, bold: false, italic: false, isMath: false, mono: true }], ctx); addVSpace(ctx, 8); break
    case 'bold':        renderParagraphSegments(extractSegments(node.children, ctx.fg, true, false), ctx); addVSpace(ctx, 8); break
    case 'italic':      renderParagraphSegments(extractSegments(node.children, ctx.fg, false, true), ctx); addVSpace(ctx, 8); break
    case 'underline':   renderParagraphSegments(extractSegments(node.children, ctx.fg, false, false), ctx); addVSpace(ctx, 8); break
    case 'color':       renderParagraphSegments(extractSegments(node.children, node.color, false, false), ctx); addVSpace(ctx, 8); break
    case 'mathInline':  renderParagraphSegments([{ text: node.latex, fill: ctx.fg, bold: false, italic: true, isMath: true }], ctx); addVSpace(ctx, 8); break
    case 'mathDisplay': renderMathDisplay(node.latex, ctx); break
    case 'codeBlock':   renderCodeBlock(node.code, node.language, node.caption, ctx); break
    case 'table':       renderTable(node, ctx); break
    case 'list':        renderList(node, ctx); break
    case 'figure':      for (const c of node.children) renderNode(c, ctx); break
    case 'image':       renderImagePlaceholder(node.src, node.alt, node.width, ctx); break
    case 'caption':     renderCaption(node.children, ctx); break
    case 'customBox':   renderCustomBox(node.label, node.borderColor, node.bgColor, node.children, ctx); break
    case 'link':        renderLink(node.href, extractText(node.children), ctx); break
    case 'reference':   renderReference(node.resolvedText, node.targetId, ctx); break
    case 'toc':         renderToc(node.entries, ctx); break
    case 'titlePage':   renderTitlePageSvg(node, ctx); break
    case 'center':      renderCenteredChildren(node.children, ctx); break
    case 'abstract':    renderAbstract(node.children, ctx); break
    case 'tikz':        renderTikzPlaceholder(node.rawSource, ctx); break
    case 'plot':        renderTikzPlaceholder(node.rawSource, ctx); break
    case 'hRule':       renderHRule(ctx); break
    case 'pageBreak':   addVSpace(ctx, 40); break
    case 'tableRow':
    case 'tableCell':
    case 'tableRule':
      break
  }
}

// ── Inline segment extraction ─────────────────────────────────────────────

interface InlineSegment {
  text: string
  fill: string
  bold: boolean
  italic: boolean
  isMath: boolean
  mono?: boolean
}

/** Flatten a node tree to inline segments with style info */
function extractSegments(nodes: readonly RenderNode[], fill: string, bold = false, italic = false): InlineSegment[] {
  const segs: InlineSegment[] = []
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        segs.push({ text: n.content, fill, bold, italic, isMath: false })
        break
      case 'inlineCode':
        segs.push({ text: n.content, fill, bold: false, italic: false, isMath: false, mono: true })
        break
      case 'bold':
        segs.push(...extractSegments(n.children, fill, true, italic))
        break
      case 'italic':
        segs.push(...extractSegments(n.children, fill, bold, true))
        break
      case 'underline':
        segs.push(...extractSegments(n.children, fill, bold, italic))
        break
      case 'color':
        segs.push(...extractSegments(n.children, n.color, bold, italic))
        break
      case 'mathInline':
        segs.push({ text: n.latex, fill, bold: false, italic: true, isMath: true })
        break
      case 'link':
        segs.push(...extractSegments(n.children, '#0969da', bold, italic))
        break
      case 'reference':
        segs.push({ text: n.resolvedText, fill: '#0969da', bold, italic, isMath: false })
        break
      case 'paragraph':
        segs.push(...extractSegments(n.children, fill, bold, italic))
        break
      default: {
        const t = extractText([n])
        if (t.trim()) segs.push({ text: t, fill, bold, italic, isMath: false })
      }
    }
  }
  return segs
}

/** Render inline segments as a block paragraph, handling word-wrap across segments */
function renderParagraphSegments(segments: InlineSegment[], ctx: SvgCtx): void {
  if (segments.length === 0) return

  // Join all text for wrapping, then re-apply styles per word
  const fullText = segments.map(s => s.text).join(' ').trim()
  if (!fullText) return

  // Simple approach: render each segment on its own line(s) with appropriate styles
  // For multi-segment paragraphs, concatenate and render with dominant style
  const firstSeg = segments[0]!
  const allBold = segments.every(s => s.bold)
  const allItalic = segments.every(s => s.italic)
  const allSameColor = segments.every(s => s.fill === firstSeg.fill)
  const dominantFill = allSameColor ? firstSeg.fill : ctx.fg
  const hasMath = segments.some(s => s.isMath)

  if (segments.length === 1) {
    const seg = segments[0]!
    const lines = wrapText(seg.text, ctx.contentWidth, CHAR_W)
    const weight = seg.bold ? ' font-weight="bold"' : ''
    const style = seg.italic ? ' font-style="italic"' : ''
    const cls = seg.isMath ? ' class="htex-math"' : ''
    for (const line of lines) {
      push(ctx, `<text x="${H_PADDING}" y="${ctx.y + FONT_SIZE}" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}"${weight}${style} fill="${seg.fill}"${cls}>${esc(line)}</text>`)
      ctx.y += LINE_HEIGHT
    }
  } else {
    // Multi-segment: render full text with combined style
    const lines = wrapText(fullText, ctx.contentWidth, CHAR_W)
    const weight = allBold ? ' font-weight="bold"' : ''
    const style = allItalic ? ' font-style="italic"' : ''
    const cls = hasMath ? ' class="htex-math"' : ''
    for (const line of lines) {
      push(ctx, `<text x="${H_PADDING}" y="${ctx.y + FONT_SIZE}" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}"${weight}${style} fill="${dominantFill}"${cls}>${esc(line)}</text>`)
      ctx.y += LINE_HEIGHT
    }
  }
}

function renderDocument(node: DocumentRenderNode, ctx: SvgCtx): void {
  for (const child of node.children) {
    renderNode(child, ctx)
  }
}

function renderSection(node: SectionRenderNode, ctx: SvgCtx): void {
  addVSpace(ctx, node.level === 1 ? 16 : 12)

  // Separator line for h1 and h2
  if (node.level <= 2) {
    push(ctx, `<line x1="${H_PADDING}" y1="${ctx.y}" x2="${ctx.width - H_PADDING}" y2="${ctx.y}" stroke="${ctx.borderColor}" stroke-width="${node.level === 1 ? 2 : 1}" />`)
    addVSpace(ctx, 4)
  }

  const fs = HEADING_SIZES[node.level - 1] ?? FONT_SIZE
  const title = (node.number ? `${node.number}  ` : '') + extractText(node.title)
  const lines = wrapText(title, ctx.contentWidth, fs * 0.55)

  // Ensure globally unique id in this SVG
  let svgId = esc(node.id)
  if (ctx.usedIds.has(svgId)) {
    ctx.idCounter++
    svgId = `${svgId}-${ctx.idCounter}`
  }
  ctx.usedIds.add(svgId)

  for (const line of lines) {
    push(ctx, `<text x="${H_PADDING}" y="${ctx.y + fs}" font-family="Arial, Helvetica, sans-serif" font-size="${fs}" font-weight="bold" fill="${ctx.fg}" id="${svgId}">${esc(line)}</text>`)
    ctx.y += fs + 6
    svgId = ''  // only put id on first line
  }

  addVSpace(ctx, 8)

  for (const child of node.children) {
    renderNode(child, ctx)
  }
}

function renderParagraph(node: { children: readonly RenderNode[] }, ctx: SvgCtx): void {
  // Separate block-level children (image, mathDisplay, tikz, etc.) from inline text
  // Block-level nodes get dispatched directly; inline nodes become text segments
  const BLOCK_TYPES = new Set(['image', 'figure', 'tikz', 'plot', 'codeBlock', 'table', 'customBox', 'mathDisplay', 'hRule'])
  const inlineChildren: RenderNode[] = []
  for (const child of node.children) {
    if (BLOCK_TYPES.has(child.type)) {
      // Flush pending inline text first
      if (inlineChildren.length > 0) {
        const segments = extractSegments(inlineChildren, ctx.fg)
        renderParagraphSegments(segments, ctx)
        addVSpace(ctx, 8)
        inlineChildren.length = 0
      }
      renderNode(child, ctx)
    } else {
      inlineChildren.push(child)
    }
  }
  // Flush remaining inline text
  if (inlineChildren.length > 0) {
    const segments = extractSegments(inlineChildren, ctx.fg)
    renderParagraphSegments(segments, ctx)
    addVSpace(ctx, 8)
  }
}

function renderInlineText(text: string, ctx: SvgCtx, fs: number, fill: string, bold: boolean, italic: boolean): void {
  if (!text.trim()) return
  const lines = wrapText(text, ctx.contentWidth, CHAR_W)
  const weight = bold ? ' font-weight="bold"' : ''
  const style = italic ? ' font-style="italic"' : ''
  for (const line of lines) {
    push(ctx, `<text x="${H_PADDING}" y="${ctx.y + fs}" font-family="Georgia, 'Times New Roman', serif" font-size="${fs}"${weight}${style} fill="${fill}">${esc(line)}</text>`)
    ctx.y += LINE_HEIGHT
  }
}

function renderMathInline(latex: string, ctx: SvgCtx): void {
  push(ctx, `<text x="${H_PADDING}" y="${ctx.y + FONT_SIZE}" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}" font-style="italic" fill="${ctx.fg}" class="htex-math">${esc(`\\(${latex}\\)`)}</text>`)
  ctx.y += LINE_HEIGHT
}

function renderMathDisplay(latex: string, ctx: SvgCtx): void {
  addVSpace(ctx, 8)
  const text = `\\[${latex}\\]`
  const lines = wrapText(text, ctx.contentWidth, CHAR_W)
  for (const line of lines) {
    push(ctx, `<text x="${ctx.width / 2}" y="${ctx.y + FONT_SIZE}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}" font-style="italic" fill="${ctx.fg}" class="htex-math">${esc(line)}</text>`)
    ctx.y += LINE_HEIGHT
  }
  addVSpace(ctx, 8)
}

function renderCodeBlock(code: string, language: string, caption: string | undefined, ctx: SvgCtx): void {
  addVSpace(ctx, 8)
  const rawLines = code.split('\n')
  const boxPadding = 12
  const lineCount = rawLines.length
  const boxH = lineCount * LINE_HEIGHT + boxPadding * 2

  // Background rect
  push(ctx, `<rect x="${H_PADDING}" y="${ctx.y}" width="${ctx.contentWidth}" height="${boxH}" rx="6" ry="6" fill="${ctx.codeBg}" stroke="${ctx.borderColor}" stroke-width="1" />`)

  // Language label
  if (language) {
    push(ctx, `<text x="${H_PADDING + ctx.contentWidth - 8}" y="${ctx.y + MONO_SIZE}" text-anchor="end" font-family="monospace" font-size="${MONO_SIZE - 2}" fill="${ctx.borderColor}">${esc(language)}</text>`)
  }

  // Code lines
  let lineY = ctx.y + boxPadding + MONO_SIZE
  for (const codeLine of rawLines) {
    push(ctx, `<text x="${H_PADDING + boxPadding}" y="${lineY}" font-family="'Fira Code', 'JetBrains Mono', 'Courier New', monospace" font-size="${MONO_SIZE}" fill="${ctx.fg}">${esc(codeLine)}</text>`)
    lineY += LINE_HEIGHT
  }

  ctx.y += boxH
  if (caption) {
    addVSpace(ctx, 4)
    push(ctx, `<text x="${H_PADDING}" y="${ctx.y + MONO_SIZE}" font-family="Georgia, 'Times New Roman', serif" font-size="${MONO_SIZE}" font-style="italic" fill="${ctx.fg}" opacity="0.7">${esc(caption)}</text>`)
    ctx.y += LINE_HEIGHT
  }
  addVSpace(ctx, 8)
}

function renderTable(node: TableRenderNode, ctx: SvgCtx): void {
  addVSpace(ctx, 8)

  // Collect rows (skip rules for column counting)
  const dataRows = node.children.filter((r): r is TableRowRenderNode => r.type === 'tableRow')
  if (dataRows.length === 0) {
    addVSpace(ctx, 4)
    return
  }

  const colCount = Math.max(...dataRows.map(r => r.children.length), 1)
  const colW = Math.floor(ctx.contentWidth / colCount)
  const rowH = LINE_HEIGHT + 12

  // Caption above table
  if (node.caption && node.caption.length > 0) {
    const capText = extractText(node.caption)
    push(ctx, `<text x="${H_PADDING + ctx.contentWidth / 2}" y="${ctx.y + MONO_SIZE}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${MONO_SIZE}" font-style="italic" fill="${ctx.fg}">${esc(capText)}</text>`)
    ctx.y += LINE_HEIGHT + 4
  }

  const tableTop = ctx.y

  for (const child of node.children) {
    if (child.type === 'tableRule') {
      renderTableRuleInSvg(child, colCount, colW, ctx)
      continue
    }
    if (child.type === 'tableRow') {
      renderTableRowInSvg(child, colCount, colW, rowH, ctx)
    }
  }

  // Outer border
  const tableH = ctx.y - tableTop
  push(ctx, `<rect x="${H_PADDING}" y="${tableTop}" width="${ctx.contentWidth}" height="${tableH}" fill="none" stroke="${ctx.borderColor}" stroke-width="1" />`)

  addVSpace(ctx, 8)
}

function renderTableRuleInSvg(rule: TableRuleRenderNode, colCount: number, colW: number, ctx: SvgCtx): void {
  const sw = rule.ruleKind === 'top' || rule.ruleKind === 'bottom' ? 2 : 1
  push(ctx, `<line x1="${H_PADDING}" y1="${ctx.y}" x2="${H_PADDING + colCount * colW}" y2="${ctx.y}" stroke="${ctx.fg}" stroke-width="${sw}" />`)
}

function renderTableRowInSvg(row: TableRowRenderNode, _colCount: number, colW: number, rowH: number, ctx: SvgCtx): void {
  const rowTop = ctx.y
  const isHeader = row.isHeader

  if (isHeader) {
    push(ctx, `<rect x="${H_PADDING}" y="${rowTop}" width="${row.children.length * colW}" height="${rowH}" fill="${ctx.codeBg}" />`)
  }

  for (let i = 0; i < row.children.length; i++) {
    const cell = row.children[i]
    if (!cell) continue
    renderTableCellInSvg(cell, i, colW, rowH, isHeader, ctx)
  }

  // Bottom border for each row
  push(ctx, `<line x1="${H_PADDING}" y1="${rowTop + rowH}" x2="${H_PADDING + row.children.length * colW}" y2="${rowTop + rowH}" stroke="${ctx.borderColor}" stroke-width="1" />`)
  ctx.y += rowH
}

function renderTableCellInSvg(cell: TableCellRenderNode, colIndex: number, colW: number, rowH: number, isHeader: boolean, ctx: SvgCtx): void {
  const cellX = H_PADDING + colIndex * colW
  const textY = ctx.y + (rowH / 2) + (FONT_SIZE / 2) - 2
  const text = extractText(cell.children)
  const fw = isHeader ? 'bold' : 'normal'
  const anchor = cell.align === 'right' ? 'end' : cell.align === 'center' ? 'middle' : 'start'
  const textX = cell.align === 'right'
    ? cellX + colW - 8
    : cell.align === 'center'
    ? cellX + colW / 2
    : cellX + 8
  push(ctx, `<text x="${textX}" y="${textY}" text-anchor="${anchor}" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}" font-weight="${fw}" fill="${ctx.fg}">${esc(text)}</text>`)

  // Right border for cell (except last)
  push(ctx, `<line x1="${cellX + colW}" y1="${ctx.y}" x2="${cellX + colW}" y2="${ctx.y + rowH}" stroke="${ctx.borderColor}" stroke-width="1" opacity="0.5" />`)
}

function renderList(node: { ordered: boolean; children: readonly RenderNode[] }, ctx: SvgCtx): void {
  addVSpace(ctx, 4)
  let counter = 0
  for (const item of node.children) {
    if (item.type !== 'listItem') continue
    counter++
    const bullet = node.ordered ? `${counter}.` : '•'
    const text = extractText(item.children)
    const lines = wrapText(text, ctx.contentWidth - 24, CHAR_W)

    push(ctx, `<text x="${H_PADDING}" y="${ctx.y + FONT_SIZE}" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}" fill="${ctx.fg}">${esc(bullet)}</text>`)
    for (let i = 0; i < lines.length; i++) {
      push(ctx, `<text x="${H_PADDING + 20}" y="${ctx.y + FONT_SIZE}" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}" fill="${ctx.fg}">${esc(lines[i]!)}</text>`)
      ctx.y += LINE_HEIGHT
    }
  }
  addVSpace(ctx, 4)
}

function renderImagePlaceholder(src: string, alt: string | undefined, width: string | undefined, ctx: SvgCtx): void {
  addVSpace(ctx, 8)
  const pw = ctx.contentWidth
  const ph = 120
  push(ctx, `<rect x="${H_PADDING}" y="${ctx.y}" width="${pw}" height="${ph}" rx="4" ry="4" fill="${ctx.codeBg}" stroke="${ctx.borderColor}" stroke-width="1" stroke-dasharray="6,3" />`)
  push(ctx, `<text x="${H_PADDING + pw / 2}" y="${ctx.y + ph / 2 + 6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${MONO_SIZE}" fill="${ctx.borderColor}">[Image: ${esc(alt ?? src)}]</text>`)
  ctx.y += ph
  addVSpace(ctx, 8)
}

function renderCaption(children: readonly RenderNode[], ctx: SvgCtx): void {
  const text = extractText(children)
  push(ctx, `<text x="${ctx.width / 2}" y="${ctx.y + MONO_SIZE}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${MONO_SIZE}" font-style="italic" fill="${ctx.fg}" opacity="0.7">${esc(text)}</text>`)
  ctx.y += LINE_HEIGHT
}

function renderCustomBox(label: string, borderColor: string, bgColor: string, children: readonly RenderNode[], ctx: SvgCtx): void {
  addVSpace(ctx, 8)
  const savedY = ctx.y
  // Reserve space inside the box — we'll draw children first, then draw the rect
  const innerCtx: SvgCtx = { ...ctx, elements: [], y: ctx.y + 12 }

  for (const child of children) {
    renderNode(child, innerCtx)
  }

  const boxH = innerCtx.y - savedY + 12
  const effectiveBg = bgColor && bgColor !== 'transparent' ? bgColor : 'transparent'

  push(ctx, `<rect x="${H_PADDING}" y="${savedY}" width="${ctx.contentWidth}" height="${boxH}" rx="0" ry="0" fill="${effectiveBg}" fill-opacity="0.08" stroke="${borderColor}" stroke-width="3" stroke-dasharray="" />`)
  // Left accent bar
  push(ctx, `<rect x="${H_PADDING}" y="${savedY}" width="4" height="${boxH}" fill="${borderColor}" />`)
  // Label in top-left
  push(ctx, `<text x="${H_PADDING + 12}" y="${savedY + MONO_SIZE}" font-family="Arial, sans-serif" font-size="${MONO_SIZE - 1}" font-weight="bold" fill="${borderColor}">${esc(label.toUpperCase())}</text>`)

  // Copy inner elements
  ctx.elements.push(...innerCtx.elements)
  ctx.y = savedY + boxH
  addVSpace(ctx, 8)
}

function renderLink(href: string, text: string, ctx: SvgCtx): void {
  const lines = wrapText(text, ctx.contentWidth, CHAR_W)
  for (const line of lines) {
    push(ctx, `<a href="${esc(href)}"><text x="${H_PADDING}" y="${ctx.y + FONT_SIZE}" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}" fill="${ctx.linkColor}" text-decoration="underline">${esc(line)}</text></a>`)
    ctx.y += LINE_HEIGHT
  }
}

function renderReference(resolvedText: string, targetId: string, ctx: SvgCtx): void {
  push(ctx, `<a href="#${esc(targetId)}"><text x="${H_PADDING}" y="${ctx.y + FONT_SIZE}" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}" fill="${ctx.linkColor}">${esc(resolvedText)}</text></a>`)
  ctx.y += LINE_HEIGHT
}

function renderToc(entries: readonly { level: number; number: string; title: string; id: string }[], ctx: SvgCtx): void {
  if (entries.length === 0) return
  addVSpace(ctx, 8)
  const boxTop = ctx.y
  push(ctx, `<text x="${H_PADDING + 12}" y="${ctx.y + 18}" font-family="Arial, sans-serif" font-size="${FONT_SIZE}" font-weight="bold" fill="${ctx.fg}">Contents</text>`)
  ctx.y += LINE_HEIGHT + 8

  for (const e of entries) {
    const indent = H_PADDING + 12 + (e.level - 1) * 24
    const text = `${e.number}  ${e.title}`
    push(ctx, `<a href="#${esc(e.id)}"><text x="${indent}" y="${ctx.y + FONT_SIZE}" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE - 1}" fill="${ctx.linkColor}">${esc(text)}</text></a>`)
    ctx.y += LINE_HEIGHT
  }

  const boxH = ctx.y - boxTop + 12
  push(ctx, `<rect x="${H_PADDING}" y="${boxTop}" width="${ctx.contentWidth}" height="${boxH}" rx="6" fill="${ctx.codeBg}" stroke="${ctx.borderColor}" stroke-width="1" />`)
  addVSpace(ctx, 8)
}

function renderCenteredChildren(children: readonly RenderNode[], ctx: SvgCtx): void {
  const text = extractText(children)
  if (!text.trim()) return
  const lines = wrapText(text, ctx.contentWidth, CHAR_W)
  for (const line of lines) {
    push(ctx, `<text x="${ctx.width / 2}" y="${ctx.y + FONT_SIZE}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}" fill="${ctx.fg}">${esc(line)}</text>`)
    ctx.y += LINE_HEIGHT
  }
}

function renderAbstract(children: readonly RenderNode[], ctx: SvgCtx): void {
  addVSpace(ctx, 8)
  const boxTop = ctx.y
  push(ctx, `<text x="${H_PADDING + 12}" y="${ctx.y + FONT_SIZE}" font-family="Arial, sans-serif" font-size="${FONT_SIZE - 1}" font-weight="bold" fill="${ctx.fg}">Abstract</text>`)
  ctx.y += LINE_HEIGHT + 4

  const innerCtx: SvgCtx = { ...ctx, elements: [], y: ctx.y, contentWidth: ctx.contentWidth - 24 }
  for (const child of children) {
    renderNode(child, innerCtx)
  }
  ctx.elements.push(...innerCtx.elements)
  ctx.y = innerCtx.y

  const boxH = ctx.y - boxTop + 8
  push(ctx, `<rect x="${H_PADDING}" y="${boxTop}" width="${ctx.contentWidth}" height="${boxH}" rx="6" fill="${ctx.codeBg}" stroke="${ctx.borderColor}" stroke-width="1" />`)
  addVSpace(ctx, 8)
}

function renderTikzPlaceholder(rawSource: string, ctx: SvgCtx): void {
  addVSpace(ctx, 8)
  const ph = 80
  push(ctx, `<rect x="${H_PADDING}" y="${ctx.y}" width="${ctx.contentWidth}" height="${ph}" rx="4" fill="${ctx.codeBg}" stroke="${ctx.borderColor}" stroke-width="1" stroke-dasharray="6,3" />`)
  push(ctx, `<text x="${H_PADDING + ctx.contentWidth / 2}" y="${ctx.y + ph / 2 + 6}" text-anchor="middle" font-family="monospace" font-size="${MONO_SIZE}" fill="${ctx.borderColor}">[TikZ/PGF — ${esc(rawSource.slice(0, 40).replace(/\n/g, ' '))}...]</text>`)
  ctx.y += ph
  addVSpace(ctx, 8)
}

function renderHRule(ctx: SvgCtx): void {
  addVSpace(ctx, 8)
  push(ctx, `<line x1="${H_PADDING}" y1="${ctx.y}" x2="${ctx.width - H_PADDING}" y2="${ctx.y}" stroke="${ctx.borderColor}" stroke-width="2" />`)
  addVSpace(ctx, 8)
}

function renderTitlePageSvg(node: { metadata?: { title?: string; author?: string; date?: string }; children: readonly RenderNode[] }, ctx: SvgCtx): void {
  const m = node.metadata ?? {}
  const titleSize = FONT_SIZE * 1.6

  if (m.title) {
    addVSpace(ctx, 16)
    push(ctx, `<text x="${ctx.width / 2}" y="${ctx.y}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${titleSize}" font-weight="bold" fill="${ctx.fg}">${esc(m.title)}</text>`)
    ctx.y += titleSize + 8
  }
  push(ctx, `<line x1="${H_PADDING + ctx.contentWidth * 0.2}" y1="${ctx.y}" x2="${H_PADDING + ctx.contentWidth * 0.8}" y2="${ctx.y}" stroke="${ctx.borderColor}" stroke-width="1" />`)
  ctx.y += 8
  if (m.author) {
    push(ctx, `<text x="${ctx.width / 2}" y="${ctx.y}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE}" fill="${ctx.fg}">${esc(m.author)}</text>`)
    ctx.y += FONT_SIZE + 6
  }
  if (m.date) {
    push(ctx, `<text x="${ctx.width / 2}" y="${ctx.y}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${FONT_SIZE * 0.9}" fill="${ctx.borderColor}">${esc(m.date)}</text>`)
    ctx.y += FONT_SIZE + 4
  }
  // Render children (custom styled titlepages with no simple metadata)
  for (const child of node.children) {
    renderNode(child, ctx)
  }
  addVSpace(ctx, 16)
}

// ── Public API ────────────────────────────────────────────────────────────

export interface SvgRenderOptions extends RenderOptions {
  /** Total SVG width in pixels. Defaults to 900. */
  readonly svgWidth?: number
  /** If true, wraps in full SVG document with xml declaration. Defaults to true. */
  readonly standalone?: boolean
}

export function renderToSvg(
  tree: RenderTree | readonly RenderNode[],
  options: SvgRenderOptions = {},
): string {
  const theme = options.theme ?? 'light'
  const width = options.svgWidth ?? 900
  const nodes = Array.from(tree)

  // Extract colors and title from document node
  let colors: readonly ColorDef[] = []
  for (const n of nodes) {
    if (n.type === 'document') {
      colors = n.metadata.colors
      break
    }
  }

  const ctx = mkCtx(width, theme, colors)

  for (const node of nodes) {
    renderNode(node, ctx)
  }

  // Final SVG height
  const svgH = ctx.y + V_PADDING

  // Background rect
  const bgRect = `<rect width="${width}" height="${svgH}" fill="${ctx.bg}" />`

  const svgBody = [bgRect, ...ctx.elements].join('\n  ')

  const svgAttrs = [
    `xmlns="http://www.w3.org/2000/svg"`,
    `xmlns:xlink="http://www.w3.org/1999/xlink"`,
    `width="${width}"`,
    `height="${svgH}"`,
    `viewBox="0 0 ${width} ${svgH}"`,
    `data-theme="${theme}"`,
    `class="htex-svg-document"`,
  ].join(' ')

  const inner = `<svg ${svgAttrs}>\n  ${svgBody}\n</svg>`

  if (options.standalone === false) return inner

  return `<?xml version="1.0" encoding="UTF-8"?>\n${inner}`
}
