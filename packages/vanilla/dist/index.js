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
export { VERSION } from './version.js';
import { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
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
export function renderLatex(container, latex, options = {}) {
    const target = options.target ?? 'html';
    if (target === 'svg') {
        const svg = latexToSvg(latex, { ...options, standalone: false });
        container.innerHTML = svg;
    }
    else {
        const html = latexToHtml(latex, { ...options, standalone: false });
        container.innerHTML = html;
    }
}
/**
 * Render a pre-built RenderTree into a DOM element.
 * Useful when you want to reuse the parse/transform result across multiple renders.
 */
export function renderTree(container, tree, options = {}) {
    const target = options.target ?? 'html';
    if (target === 'svg') {
        container.innerHTML = renderToSvg(tree, { ...options, standalone: false });
    }
    else {
        container.innerHTML = renderToHtml(tree, { ...options, standalone: false });
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
    container;
    options;
    _tree = null;
    _source = '';
    constructor(container, options = {}) {
        this.container = container;
        this.options = options;
    }
    /** Set or update the LaTeX source and re-render */
    setSource(latex) {
        this._source = latex;
        this._tree = latexToRenderTree(latex, this.options);
        this._render();
    }
    /** Update rendering options and re-render (if source already set) */
    setOptions(options) {
        this.options = { ...this.options, ...options };
        if (this._source) {
            this._tree = latexToRenderTree(this._source, this.options);
            this._render();
        }
    }
    /** Get the current render tree (null if no source has been set) */
    get tree() { return this._tree; }
    /** Destroy the renderer and clear the container */
    destroy() {
        this.container.innerHTML = '';
        this._tree = null;
        this._source = '';
    }
    _render() {
        if (!this._tree)
            return;
        renderTree(this.container, this._tree, {
            ...this.options,
            standalone: false,
        });
    }
}
// Guard: HTMLElement is browser-only
const _HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {
};
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
    static observedAttributes = ['theme', 'target', 'src'];
    _renderer = null;
    connectedCallback() {
        this._init();
    }
    disconnectedCallback() {
        this._renderer?.destroy();
    }
    attributeChangedCallback() {
        if (this._renderer)
            this._init();
    }
    _init() {
        const theme = this.getAttribute('theme') ?? 'light';
        const target = this.getAttribute('target') ?? 'html';
        const src = this.getAttribute('src');
        if (!this._renderer) {
            this._renderer = new HtexRenderer(this, { theme, target });
        }
        else {
            this._renderer.setOptions({ theme, target });
        }
        if (src) {
            fetch(src)
                .then(r => r.text())
                .then(latex => this._renderer.setSource(latex))
                .catch(err => {
                this.innerHTML = `<p style="color:red">Failed to load ${src}: ${err.message}</p>`;
            });
        }
        else {
            const latex = this.textContent ?? '';
            if (latex.trim())
                this._renderer.setSource(latex);
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
export function registerCustomElement(tagName = 'htex-doc', ElementClass = HtexDocElement) {
    if (typeof customElements !== 'undefined' && !customElements.get(tagName)) {
        customElements.define(tagName, ElementClass);
    }
}
// ── Convenience re-exports from core ──────────────────────────────────────
export { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
//# sourceMappingURL=index.js.map