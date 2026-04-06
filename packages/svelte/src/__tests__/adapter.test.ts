// =============================================================================
// @htex/svelte — __tests__/adapter.test.ts
// =============================================================================

import { describe, it, expect } from 'bun:test'
import {
  VERSION,
  createHtexStore,
  renderLatexSSR,
  latexToHtml,
  latexToSvg,
  latexToRenderTree,
} from '../index.js'

const SIMPLE = '\\begin{document}Hello $x^2$\\end{document}'
const BQ = require('fs').readFileSync(
  '/home/swarm/BrickellQuant/report/brickellquant_architecture.tex', 'utf8',
)

describe('@htex/svelte: VERSION', () => {
  it('[VR] exports VERSION string', () => {
    expect(typeof VERSION).toBe('string')
    expect(VERSION).toMatch(/\d+\.\d+/)
  })
})

describe('@htex/svelte: createHtexStore', () => {
  it('[VR] creates a store with subscribe', () => {
    const store = createHtexStore(SIMPLE)
    expect(typeof store.subscribe).toBe('function')
    expect(typeof store.update).toBe('function')
    expect(typeof store.destroy).toBe('function')
  })

  it('[VR] subscribe receives initial value immediately', () => {
    let received: any = null
    const store = createHtexStore(SIMPLE)
    store.subscribe(val => { received = val })
    expect(received).not.toBeNull()
    expect(typeof received.html).toBe('string')
  })

  it('[VR] initial html contains rendered content', () => {
    let html = ''
    createHtexStore(SIMPLE).subscribe(v => { html = v.html })
    expect(html.length).toBeGreaterThan(10)
  })

  it('[VR] store.update re-renders with new source', () => {
    let result: any = null
    const store = createHtexStore(SIMPLE)
    store.subscribe(v => { result = v })
    const initialHtml = result.html
    store.update('\\begin{document}Updated content $y$\\end{document}')
    expect(result.html).not.toBe(initialHtml)
    expect(result.html).toContain('Updated')
  })

  it('[VR] store.update with theme:dark produces dark output', () => {
    let result: any = null
    const store = createHtexStore(SIMPLE)
    store.subscribe(v => { result = v })
    store.update(SIMPLE, { theme: 'dark' })
    // SVG uses #0D1117 for dark
    expect(result.svg).toContain('#0D1117')
  })

  it('[VR] store contains both html and svg', () => {
    let result: any = null
    createHtexStore(SIMPLE).subscribe(v => { result = v })
    expect(result.html).toBeTruthy()
    expect(result.svg).toBeTruthy()
  })

  it('[VR] store.destroy clears subscribers', () => {
    const store = createHtexStore(SIMPLE)
    let callCount = 0
    store.subscribe(() => callCount++)
    const before = callCount
    store.destroy()
    store.update(SIMPLE)
    expect(callCount).toBe(before) // no new calls after destroy
  })
})

describe('@htex/svelte: renderLatexSSR', () => {
  it('[VR] returns html, svg, tree', () => {
    const result = renderLatexSSR(SIMPLE)
    expect(typeof result.html).toBe('string')
    expect(typeof result.svg).toBe('string')
    expect(result.tree).not.toBeNull()
  })

  it('[VR] html is a valid fragment', () => {
    const { html } = renderLatexSSR(SIMPLE)
    expect(html).toContain('<div')
    expect(html).not.toContain('<!DOCTYPE')
  })

  it('[VR] svg is a valid SVG fragment', () => {
    const { svg } = renderLatexSSR(SIMPLE)
    expect(svg).toContain('<svg')
  })
})

describe('@htex/svelte: BrickellQuant integration', () => {
  it('[VR] createHtexStore on BQ does not crash', () => {
    let result: any = null
    expect(() => {
      createHtexStore(BQ).subscribe(v => { result = v })
    }).not.toThrow()
    expect(result.error).toBeNull()
  })

  it('[VR] renderLatexSSR on BQ produces large HTML', () => {
    const { html } = renderLatexSSR(BQ)
    expect(html.length).toBeGreaterThan(1000)
  })
})
