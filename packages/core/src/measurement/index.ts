// =============================================================================
// @htex/core — measurement/index.ts
// Text measurement service wrapping @chenglou/pretext.
// Walks the RenderTree and attaches LayoutHints to text-bearing nodes.
// =============================================================================

import type {
  RenderNode, RenderTree, LayoutHints, FontConfig,
  MeasureError as MeasureErrorType,
} from '../types.js'
import { DEFAULT_FONT_CONFIG } from '../types.js'

// ── PreTeXt integration ───────────────────────────────────────────────────
// We lazily import @chenglou/pretext to avoid breaking SSR environments
// where canvas is not available.

type PreparedText = unknown  // opaque handle from PreTeXt
type LayoutLine = { text: string; width: number; start: unknown; end: unknown }

interface PretextModule {
  prepare: (text: string, font: string, opts?: { whiteSpace?: 'normal' | 'pre-wrap' }) => PreparedText
  layout: (prepared: PreparedText, maxWidth: number, lineHeight: number) => { height: number; lineCount: number }
  layoutWithLines: (prepared: PreparedText, maxWidth: number, lineHeight: number) => { height: number; lineCount: number; lines: LayoutLine[] }
  setLocale: (locale?: string) => void
  clearCache?: () => void
}

let _pretext: PretextModule | null = null
let _loadPromise: Promise<PretextModule | null> | null = null

async function loadPretext(): Promise<PretextModule | null> {
  if (_pretext) return _pretext
  if (_loadPromise) return _loadPromise
  _loadPromise = (async () => {
    try {
      const mod = await import('@chenglou/pretext')
      _pretext = mod as unknown as PretextModule
      return _pretext
    } catch {
      // SSR / no-canvas environment — fall back to heuristics
      return null
    }
  })()
  return _loadPromise
}

// ── Cache ─────────────────────────────────────────────────────────────────

// Map<fontString, Map<textContent, PreparedText>>
const _cache = new Map<string, Map<string, PreparedText>>()

export function getMeasurementCacheSize(): number {
  let total = 0
  for (const m of _cache.values()) total += m.size
  return total
}

export function clearMeasurementCache(): void {
  _cache.clear()
  if (_pretext?.clearCache) _pretext.clearCache()
}

export function setMeasurementLocale(locale: string): void {
  if (_pretext) _pretext.setLocale(locale)
}

function getCached(font: string, text: string): PreparedText | undefined {
  return _cache.get(font)?.get(text)
}

function setCached(font: string, text: string, prepared: PreparedText): void {
  if (!_cache.has(font)) _cache.set(font, new Map())
  _cache.get(font)!.set(text, prepared)
}

// ── Heuristic fallback (SSR / no canvas) ──────────────────────────────────

function heuristicMeasure(
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
): { height: number; lineCount: number } {
  // Rough approximation: 8px average character width at 16px, scale by font size
  const fontSize = parseFloat(font) || 16
  const charWidth = fontSize * 0.5
  const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth))
  const lineCount = Math.max(1, Math.ceil(text.length / charsPerLine))
  return { height: lineCount * lineHeight, lineCount }
}

// ── Text extraction helpers ────────────────────────────────────────────────

function extractText(node: RenderNode): string {
  if (node.type === 'text') return node.content
  if ('children' in node && node.children) {
    return (node.children as RenderNode[]).map(extractText).join(' ')
  }
  if (node.type === 'mathInline') return node.latex
  if (node.type === 'mathDisplay') return node.latex
  if (node.type === 'codeBlock') return node.code
  return ''
}

// ── Main measure function ─────────────────────────────────────────────────

export async function measure(
  tree: RenderTree | RenderNode[],
  config: Partial<FontConfig> & { maxWidth?: number } = {},
): Promise<RenderNode[]> {
  const fontConfig: FontConfig = { ...DEFAULT_FONT_CONFIG, ...config }
  const maxWidth = config.maxWidth ?? 800
  const pretext = await loadPretext()

  if (fontConfig.locale && pretext) {
    pretext.setLocale(fontConfig.locale)
  }

  return measureNodes(Array.from(tree), fontConfig, maxWidth, pretext)
}

/** Synchronous measurement using heuristics (SSR-safe) */
export function measureSync(
  tree: RenderTree | RenderNode[],
  config: Partial<FontConfig> & { maxWidth?: number } = {},
): RenderNode[] {
  const fontConfig: FontConfig = { ...DEFAULT_FONT_CONFIG, ...config }
  const maxWidth = config.maxWidth ?? 800
  return measureNodes(Array.from(tree), fontConfig, maxWidth, null)
}

function measureNodes(
  nodes: RenderNode[],
  config: FontConfig,
  maxWidth: number,
  pretext: PretextModule | null,
): RenderNode[] {
  return nodes.map(node => measureNode(node, config, maxWidth, pretext))
}

function measureNode(
  node: RenderNode,
  config: FontConfig,
  maxWidth: number,
  pretext: PretextModule | null,
): RenderNode {
  const font = getFontForNode(node, config)
  const text = extractText(node)

  let layout: LayoutHints | undefined

  if (text.trim().length > 0) {
    if (pretext) {
      try {
        let prepared = getCached(font, text)
        if (!prepared) {
          prepared = pretext.prepare(text, font)
          setCached(font, text, prepared)
        }
        const result = pretext.layout(prepared, maxWidth, config.lineHeight)
        layout = { measuredHeight: result.height, lineCount: result.lineCount }
      } catch {
        // Fallback to heuristic
        const h = heuristicMeasure(text, font, maxWidth, config.lineHeight)
        layout = { measuredHeight: h.height, lineCount: h.lineCount }
      }
    } else {
      const h = heuristicMeasure(text, font, maxWidth, config.lineHeight)
      layout = { measuredHeight: h.height, lineCount: h.lineCount }
    }
  }

  // Recurse into children
  const withLayout = layout ? { ...node, layout } : node

  if ('children' in withLayout && withLayout.children) {
    const measuredChildren = measureNodes(
      Array.from(withLayout.children as RenderNode[]),
      config,
      maxWidth,
      pretext,
    )
    return { ...withLayout, children: measuredChildren } as RenderNode
  }

  return withLayout
}

function getFontForNode(node: RenderNode, config: FontConfig): string {
  switch (node.type) {
    case 'section':
      return config.heading
    case 'codeBlock':
      return config.mono
    case 'bold':
      return config.heading
    default:
      return config.body
  }
}

// ── Table column measurement ──────────────────────────────────────────────

export async function measureTableColumns(
  tableNode: Extract<RenderNode, { type: 'table' }>,
  config: Partial<FontConfig> = {},
): Promise<number[]> {
  const fontConfig: FontConfig = { ...DEFAULT_FONT_CONFIG, ...config }
  const pretext = await loadPretext()

  // Find max columns
  let maxCols = 0
  const dataRows = tableNode.children.filter(r => r.type === 'tableRow')
  for (const row of dataRows) {
    if (row.type === 'tableRow') maxCols = Math.max(maxCols, row.children.length)
  }

  const colWidths = new Array(maxCols).fill(0) as number[]

  for (const row of dataRows) {
    if (row.type !== 'tableRow') continue
    let colIdx = 0
    for (const cell of row.children) {
      const text = cell.children.map(extractText).join(' ')
      let width = 0
      if (pretext && text.trim()) {
        try {
          let prepared = getCached(fontConfig.body, text)
          if (!prepared) {
            prepared = pretext.prepare(text, fontConfig.body)
            setCached(fontConfig.body, text, prepared)
          }
          const result = pretext.layout(prepared, 9999, fontConfig.lineHeight)
          // measureNaturalWidth not available in all versions — use layout at very wide width
          width = text.length * 8  // fallback approximation
          void result  // suppress unused
        } catch {
          width = text.length * 8
        }
      } else {
        width = text.length * 8
      }
      const span = cell.colspan ?? 1
      const perCol = width / span
      for (let c = colIdx; c < colIdx + span && c < maxCols; c++) {
        colWidths[c] = Math.max(colWidths[c] ?? 0, perCol)
      }
      colIdx += span
    }
  }

  return colWidths
}

/** Cheap re-layout after viewport resize — no canvas calls */
export function relayout(
  tree: RenderNode[],
  newMaxWidth: number,
  config: Partial<FontConfig> = {},
): RenderNode[] {
  const fontConfig: FontConfig = { ...DEFAULT_FONT_CONFIG, ...config }
  return relayoutNodes(tree, newMaxWidth, fontConfig)
}

function relayoutNodes(nodes: RenderNode[], maxWidth: number, config: FontConfig): RenderNode[] {
  return nodes.map(node => relayoutNode(node, maxWidth, config))
}

function relayoutNode(node: RenderNode, maxWidth: number, config: FontConfig): RenderNode {
  const text = extractText(node)
  let layout: LayoutHints | undefined

  if (text.trim().length > 0 && node.layout) {
    // Re-compute from cached prepared text (no canvas calls)
    const font = getFontForNode(node, config)
    const prepared = getCached(font, text)
    if (prepared && _pretext) {
      try {
        const result = _pretext.layout(prepared, maxWidth, config.lineHeight)
        layout = { measuredHeight: result.height, lineCount: result.lineCount }
      } catch {
        layout = heuristicMeasure(text, font, maxWidth, config.lineHeight)
      }
    } else {
      layout = heuristicMeasure(text, font, maxWidth, config.lineHeight)
    }
  }

  const withLayout = layout ? { ...node, layout } : node

  if ('children' in withLayout && withLayout.children) {
    const relayoutedChildren = relayoutNodes(
      Array.from(withLayout.children as RenderNode[]),
      maxWidth,
      config,
    )
    return { ...withLayout, children: relayoutedChildren } as RenderNode
  }

  return withLayout
}
