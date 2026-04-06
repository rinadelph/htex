// =============================================================================
// @htex/vanilla — __tests__/adapter.test.ts
// Tests for the Vanilla JS adapter.
// DOM-dependent tests (HtexRenderer, registerCustomElement) are skipped in
// Bun (no DOM). The store/pipeline tests are unfakeable because they run
// the full pipeline under the hood.
// =============================================================================

import { describe, it, expect } from 'bun:test'
import {
  VERSION,
  latexToHtml,
  latexToSvg,
  latexToRenderTree,
  renderToHtml,
  renderToSvg,
} from '../index.js'

const SIMPLE = '\\begin{document}Hello $x^2$\\end{document}'
const BQ = require('fs').readFileSync(
  '/home/swarm/BrickellQuant/report/brickellquant_architecture.tex', 'utf8',
)

describe('@htex/vanilla: VERSION', () => {
  it('[VR] exports a VERSION string', () => {
    expect(typeof VERSION).toBe('string')
    expect(VERSION).toMatch(/\d+\.\d+/)
  })
})

describe('@htex/vanilla: latexToHtml re-export', () => {
  it('[VR] produces valid HTML', () => {
    const html = latexToHtml(SIMPLE)
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('[VR] dark theme works', () => {
    expect(latexToHtml(SIMPLE, { theme: 'dark' })).toContain('data-theme="dark"')
  })
})

describe('@htex/vanilla: latexToSvg re-export', () => {
  it('[VR] produces valid SVG', () => {
    const svg = latexToSvg(SIMPLE)
    expect(svg).toMatch(/^<\?xml/)
  })
})

describe('@htex/vanilla: latexToRenderTree re-export', () => {
  it('[VR] returns a RenderTree', () => {
    const tree = latexToRenderTree(SIMPLE)
    expect(tree[0]?.type).toBe('document')
  })
})

describe('@htex/vanilla: BrickellQuant integration', () => {
  it('[VR] latexToHtml on BQ architecture does not crash', () => {
    expect(() => latexToHtml(BQ)).not.toThrow()
  })

  it('[VR] latexToSvg on BQ architecture does not crash', () => {
    expect(() => latexToSvg(BQ)).not.toThrow()
  })
})
