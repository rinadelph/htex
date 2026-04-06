// =============================================================================
// @htex/vanilla — Vanilla JS adapter for @htex/core
//
// Provides DOM-based rendering and a custom element <htex-doc> for use in
// any browser environment without a framework.
//
// USAGE:
//   import { HtexRenderer, renderLatex } from '@htex/vanilla'
//   // Mount to a DOM element:
//   renderLatex(document.getElementById('output'), myLatexSource)
//   // Or use the custom element:
//   document.body.innerHTML = '<htex-doc src="./paper.tex"></htex-doc>'
// =============================================================================

export { VERSION } from './version.js'

import {
  latexToHtml,
  latexToSvg,
  latexToRenderTree,
  renderToHtml,
  renderToSvg,
} from '@htex/core'
import type {
  RenderTree,
  ConvertOptions,
  Theme,
} from '@htex/core'
import type { HtmlRenderOptions } from '@htex/core'
import type { SvgRenderOptions } from '@htex/core'

export type { RenderTree, ConvertOptions, Theme }

export type RenderTarget = 'html' | 'svg'

export interface VanillaRenderOptions extends ConvertOptions, HtmlRenderOptions {
  /** 'html' (default) or 'svg' */
  target?: RenderTarget
  svgWidth?: number
}

// ── Core render function ───────────────────────────────────────────────────

/**
 * Render a LaTeX string into a DOM element.
 * Uses the HTML renderer by default; pass `target: 'svg'` for SVG.
 *
 * @example
 * ```ts
 * renderLatex(document.getElementById('output'), myLatex, { theme: 'dark' })
 * ```
 */
export function renderLatex(
  container: HTMLElement,
  latex: string,
  options: VanillaRenderOptions = {},
): void {
  const target = options.target ?? 'html'

  if (target === 'svg') {
    const svg = latexToSvg(latex, { ...options, standalone: false })
    container.innerHTML = svg
  } else {
    const html = latexToHtml(latex, { ...options, standalone: false })
    container.innerHTML = html
  }
}

/**
 * Render a pre-built RenderTree into a DOM element.
 * Useful when you want to reuse the parse/transform result across multiple renders.
 */
export function renderTree(
  container: HTMLElement,
  tree: RenderTree,
  options: HtmlRenderOptions & SvgRenderOptions & { target?: RenderTarget } = {},
): void {
  const target = options.target ?? 'html'

  if (target === 'svg') {
    container.innerHTML = renderToSvg(tree, { ...options, standalone: false })
  } else {
    container.innerHTML = renderToHtml(tree, { ...options, standalone: false })
  }
}

// ── HtexRenderer class ─────────────────────────────────────────────────────

/**
 * Stateful renderer class. Caches the render tree across re-renders,
 * supports hot-reload style updates when the source changes.
 *
 * @example
 * ```ts
 * const renderer = new HtexRenderer(document.getElementById('output'), {
 *   theme: 'dark',
 *   target: 'html',
 * })
 * renderer.setSource(myLatex)
 * // Later, update source:
 * renderer.setSource(newLatex)
 * ```
 */
export class HtexRenderer {
  private container: HTMLElement
  private options: VanillaRenderOptions
  private _tree: RenderTree | null = null
  private _source: string = ''

  constructor(container: HTMLElement, options: VanillaRenderOptions = {}) {
    this.container = container
    this.options = options
  }

  /** Set or update the LaTeX source and re-render */
  setSource(latex: string): void {
    this._source = latex
    this._tree = latexToRenderTree(latex, this.options)
    this._render()
  }

  /** Update rendering options and re-render (if source already set) */
  setOptions(options: Partial<VanillaRenderOptions>): void {
    this.options = { ...this.options, ...options }
    if (this._source) {
      this._tree = latexToRenderTree(this._source, this.options)
      this._render()
    }
  }

  /** Get the current render tree (null if no source has been set) */
  get tree(): RenderTree | null { return this._tree }

  /** Destroy the renderer and clear the container */
  destroy(): void {
    this.container.innerHTML = ''
    this._tree = null
    this._source = ''
  }

  private _render(): void {
    if (!this._tree) return
    renderTree(this.container, this._tree, {
      ...this.options,
      standalone: false,
    })
  }
}

// ── Custom Element <htex-doc> ──────────────────────────────────────────────

type HTMLElementCtor = typeof HTMLElement

// Guard: HTMLElement is browser-only
const _HTMLElement: HTMLElementCtor =
  typeof HTMLElement !== 'undefined' ? HTMLElement : (class {} as unknown as HTMLElementCtor)

/**
 * Custom element that renders a LaTeX document.
 * Attributes:
 *   - theme: 'light' | 'dark'
 *   - target: 'html' | 'svg'
 *   - src: URL to a .tex file (fetched automatically)
 *
 * Inline LaTeX can be provided as text content:
 * ```html
 * <htex-doc theme="dark">
 *   \begin{document}Hello $x^2$\end{document}
 * </htex-doc>
 * ```
 */
export class HtexDocElement extends _HTMLElement {
  static observedAttributes = ['theme', 'target', 'src']

  private _renderer: HtexRenderer | null = null

  connectedCallback(): void {
    this._init()
  }

  disconnectedCallback(): void {
    this._renderer?.destroy()
  }

  attributeChangedCallback(): void {
    if (this._renderer) this._init()
  }

  private _init(): void {
    const theme = (this.getAttribute('theme') as Theme) ?? 'light'
    const target = (this.getAttribute('target') as RenderTarget) ?? 'html'
    const src = this.getAttribute('src')

    if (!this._renderer) {
      this._renderer = new HtexRenderer(this, { theme, target })
    } else {
      this._renderer.setOptions({ theme, target })
    }

    if (src) {
      fetch(src)
        .then(r => r.text())
        .then(latex => this._renderer!.setSource(latex))
        .catch(err => {
          this.innerHTML = `<p style="color:red">Failed to load ${src}: ${err.message}</p>`
        })
    } else {
      const latex = this.textContent ?? ''
      if (latex.trim()) this._renderer.setSource(latex)
    }
  }
}

/**
 * Register the <htex-doc> custom element.
 * Call this once during app initialization.
 *
 * @example
 * ```ts
 * import { registerCustomElement } from '@htex/vanilla'
 * registerCustomElement()
 * // Now you can use <htex-doc> in HTML
 * ```
 */
export function registerCustomElement(
  tagName = 'htex-doc',
  ElementClass: typeof HTMLElement = HtexDocElement,
): void {
  if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName, ElementClass)
  }
}

// ── Convenience re-exports from core ──────────────────────────────────────
export {
  latexToHtml,
  latexToSvg,
  latexToRenderTree,
  renderToHtml,
  renderToSvg,
} from '@htex/core'
