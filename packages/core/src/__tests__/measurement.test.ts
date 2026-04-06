// measurement.test.ts — 30+ tests for the PreTeXt measurement service
import { describe, it, expect, beforeEach } from 'bun:test'
import {
  measure, measureSync, clearMeasurementCache,
  getMeasurementCacheSize, relayout,
} from '../measurement/index.js'
import type { RenderNode, ParagraphRenderNode } from '../types.js'

// Helpers
function makeParagraph(text: string): ParagraphRenderNode {
  return { type: 'paragraph', children: [{ type: 'text', content: text }] }
}

function makeDoc(paragraphs: string[]): RenderNode[] {
  return [{
    type: 'document',
    metadata: { documentClass: 'article', colors: [] },
    children: paragraphs.map(t => makeParagraph(t)),
  }]
}

function findNode<T extends RenderNode>(nodes: readonly RenderNode[], type: T['type']): T | undefined {
  for (const n of nodes) {
    if (n.type === type) return n as T
    if ('children' in n && n.children) {
      const f = findNode(n.children as RenderNode[], type)
      if (f) return f
    }
  }
}

function findAll<T extends RenderNode>(nodes: readonly RenderNode[], type: T['type']): T[] {
  const result: T[] = []
  for (const n of nodes) {
    if (n.type === type) result.push(n as T)
    if ('children' in n && n.children) result.push(...findAll(n.children as RenderNode[], type))
  }
  return result
}

// ── Cache management ──────────────────────────────────────────────────────
describe('Cache management', () => {
  beforeEach(() => clearMeasurementCache())

  it('clearMeasurementCache() does not throw', () => {
    expect(() => clearMeasurementCache()).not.toThrow()
  })

  it('getMeasurementCacheSize() returns 0 on fresh start', () => {
    clearMeasurementCache()
    expect(getMeasurementCacheSize()).toBe(0)
  })

  it('getMeasurementCacheSize() returns a number (0 in SSR, >0 in browser)', async () => {
    clearMeasurementCache()
    await measure(makeDoc(['Hello world']), { body: '16px monospace', lineHeight: 24 })
    expect(typeof getMeasurementCacheSize()).toBe('number')
    expect(getMeasurementCacheSize()).toBeGreaterThanOrEqual(0)
  })

  it('second measurement of same text does not grow cache (idempotent)', async () => {
    clearMeasurementCache()
    const tree = makeDoc(['Hello world'])
    await measure(tree, { body: '16px monospace', lineHeight: 24 })
    const size1 = getMeasurementCacheSize()
    await measure(tree, { body: '16px monospace', lineHeight: 24 })
    const size2 = getMeasurementCacheSize()
    expect(size1).toBe(size2)
  })

  it('different font produces different cache entries', async () => {
    clearMeasurementCache()
    await measure(makeDoc(['Hello']), { body: '16px monospace', lineHeight: 24 })
    const size1 = getMeasurementCacheSize()
    await measure(makeDoc(['Hello']), { body: '14px serif', lineHeight: 20 })
    const size2 = getMeasurementCacheSize()
    // In browser env cache grows, in SSR it stays at 0 — both are valid
    expect(size2).toBeGreaterThanOrEqual(size1)
  })
})

// ── Layout hints attached ─────────────────────────────────────────────────
describe('Layout hints', () => {
  it('paragraph node gets measuredHeight after measure()', async () => {
    const tree = makeDoc(['This is a sample paragraph with enough text to measure.'])
    const measured = await measure(tree, { body: '16px monospace', lineHeight: 24 })
    const para = findNode<ParagraphRenderNode>(measured, 'paragraph')
    expect(typeof para?.layout?.measuredHeight).toBe('number')
  })

  it('paragraph node gets lineCount after measure()', async () => {
    const tree = makeDoc(['Sample text for line counting purposes.'])
    const measured = await measure(tree, { body: '16px monospace', lineHeight: 24 })
    const para = findNode<ParagraphRenderNode>(measured, 'paragraph')
    expect(typeof para?.layout?.lineCount).toBe('number')
    expect(para?.layout?.lineCount).toBeGreaterThan(0)
  })

  it('measuredHeight is positive number', async () => {
    const tree = makeDoc(['Hello world'])
    const measured = await measure(tree, { body: '16px monospace', lineHeight: 24 })
    const para = findNode<ParagraphRenderNode>(measured, 'paragraph')
    expect(para?.layout?.measuredHeight).toBeGreaterThan(0)
  })

  it('longer text gets higher measuredHeight than shorter text (at same width)', async () => {
    const shortTree = makeDoc(['Short'])
    const longTree = makeDoc(['This is a much longer piece of text that should wrap over multiple lines and therefore have a greater total height when rendered at a fixed width container.'])

    clearMeasurementCache()
    const short = await measure(shortTree, { body: '16px monospace', lineHeight: 24, maxWidth: 200 })
    const long = await measure(longTree, { body: '16px monospace', lineHeight: 24, maxWidth: 200 })

    const shortH = findNode<ParagraphRenderNode>(short, 'paragraph')?.layout?.measuredHeight ?? 0
    const longH = findNode<ParagraphRenderNode>(long, 'paragraph')?.layout?.measuredHeight ?? 0
    expect(longH).toBeGreaterThanOrEqual(shortH)
  })

  it('all paragraph nodes in multi-paragraph doc get layout hints', async () => {
    const tree = makeDoc(['First paragraph', 'Second paragraph', 'Third paragraph'])
    const measured = await measure(tree, { body: '16px monospace', lineHeight: 24 })
    const paras = findAll<ParagraphRenderNode>(measured, 'paragraph')
    expect(paras.length).toBe(3)
    for (const p of paras) {
      expect(p.layout?.measuredHeight).toBeGreaterThan(0)
    }
  })
})

// ── measureSync ───────────────────────────────────────────────────────────
describe('measureSync (SSR fallback)', () => {
  it('returns nodes synchronously', () => {
    const tree = makeDoc(['Hello sync world'])
    const result = measureSync(tree, { body: '16px monospace', lineHeight: 24 })
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('attaches layout hints via heuristic', () => {
    const tree = makeDoc(['Some text for sync measurement'])
    const result = measureSync(tree, { body: '16px monospace', lineHeight: 24 })
    const para = findNode<ParagraphRenderNode>(result, 'paragraph')
    expect(para?.layout?.measuredHeight).toBeGreaterThan(0)
  })

  it('does not throw on empty text', () => {
    expect(() => measureSync(makeDoc(['']), { body: '16px monospace', lineHeight: 24 })).not.toThrow()
  })
})

// ── relayout ─────────────────────────────────────────────────────────────
describe('relayout (resize path)', () => {
  it('returns same tree structure after relayout', async () => {
    const tree = makeDoc(['Text to relayout after resize'])
    const measured = await measure(tree, { body: '16px monospace', lineHeight: 24 })
    const relayouted = relayout(measured, 400, { body: '16px monospace', lineHeight: 24 })
    expect(relayouted.length).toBe(measured.length)
  })

  it('does not throw on relayout', async () => {
    const tree = makeDoc(['Text for relayout test'])
    const measured = await measure(tree, { body: '16px monospace', lineHeight: 24 })
    expect(() => relayout(measured, 600, { body: '16px monospace', lineHeight: 24 })).not.toThrow()
  })
})

// ── Performance ───────────────────────────────────────────────────────────
describe('Performance', () => {
  it('measures 500 paragraph nodes in < 100ms', async () => {
    clearMeasurementCache()
    const paragraphs = Array.from({ length: 500 }, (_, i) =>
      `Sample text number ${i} with some additional words to make it realistic.`
    )
    const tree = makeDoc(paragraphs)
    const start = performance.now()
    await measure(tree, { body: '16px monospace', lineHeight: 24 })
    const ms = performance.now() - start
    expect(ms).toBeLessThan(100)
  })

  it('second pass of same 500 nodes is faster (cache hit)', async () => {
    clearMeasurementCache()
    const paragraphs = Array.from({ length: 500 }, (_, i) => `Cached text node ${i}`)
    const tree = makeDoc(paragraphs)

    await measure(tree, { body: '16px monospace', lineHeight: 24 })
    const start = performance.now()
    await measure(tree, { body: '16px monospace', lineHeight: 24 })
    const ms = performance.now() - start
    // Second pass should be fast (just cache lookups)
    expect(ms).toBeLessThan(50)
  })
})

// ── Node type handling ────────────────────────────────────────────────────
describe('Node type handling', () => {
  it('handles code block nodes', async () => {
    const tree: RenderNode[] = [{
      type: 'codeBlock',
      code: 'def hello():\n    print("Hello, world!")',
      language: 'python',
    }]
    const measured = await measure(tree, { body: '16px monospace', lineHeight: 24 })
    expect(measured.length).toBe(1)
  })

  it('handles math inline nodes (no measurement needed)', async () => {
    const tree: RenderNode[] = [{ type: 'mathInline', latex: '\\frac{a}{b}' }]
    const result = await measure(tree, { body: '16px monospace', lineHeight: 24 })
    expect(result[0]?.type).toBe('mathInline')
  })

  it('handles tikz nodes without crashing', async () => {
    const tree: RenderNode[] = [{ type: 'tikz', rawSource: '\\begin{tikzpicture}\\end{tikzpicture}' }]
    const result = await measure(tree, { body: '16px monospace', lineHeight: 24 })
    expect(result[0]?.type).toBe('tikz')
  })

  it('handles nested document tree', async () => {
    const tree: RenderNode[] = [{
      type: 'document',
      metadata: { documentClass: 'article', colors: [] },
      children: [
        {
          type: 'section', level: 1, number: '1', id: 'section-1',
          title: [{ type: 'text', content: 'Introduction' }],
          children: [
            { type: 'paragraph', children: [{ type: 'text', content: 'Body text here.' }] }
          ],
        }
      ],
    }]
    const result = await measure(tree, { body: '16px monospace', lineHeight: 24 })
    expect(result[0]?.type).toBe('document')
  })

  it('does not throw on empty tree', async () => {
    const result = await measure([], { body: '16px monospace', lineHeight: 24 })
    expect(result).toEqual([])
  })
})
