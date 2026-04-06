export { VERSION } from './version.js';
import type { RenderTree, ConvertOptions, Theme } from '@htex/core';
import type { HtmlRenderOptions } from '@htex/core';
import type { SvgRenderOptions } from '@htex/core';
export type { RenderTree, ConvertOptions, Theme };
export type RenderTarget = 'html' | 'svg';
export interface VanillaRenderOptions extends ConvertOptions, HtmlRenderOptions {
    /** 'html' (default) or 'svg' */
    target?: RenderTarget;
    svgWidth?: number;
}
/**
 * Render a LaTeX string into a DOM element.
 * Uses the HTML renderer by default; pass `target: 'svg'` for SVG.
 *
 * @example
 * ```ts
 * renderLatex(document.getElementById('output'), myLatex, { theme: 'dark' })
 * ```
 */
export declare function renderLatex(container: HTMLElement, latex: string, options?: VanillaRenderOptions): void;
/**
 * Render a pre-built RenderTree into a DOM element.
 * Useful when you want to reuse the parse/transform result across multiple renders.
 */
export declare function renderTree(container: HTMLElement, tree: RenderTree, options?: HtmlRenderOptions & SvgRenderOptions & {
    target?: RenderTarget;
}): void;
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
export declare class HtexRenderer {
    private container;
    private options;
    private _tree;
    private _source;
    constructor(container: HTMLElement, options?: VanillaRenderOptions);
    /** Set or update the LaTeX source and re-render */
    setSource(latex: string): void;
    /** Update rendering options and re-render (if source already set) */
    setOptions(options: Partial<VanillaRenderOptions>): void;
    /** Get the current render tree (null if no source has been set) */
    get tree(): RenderTree | null;
    /** Destroy the renderer and clear the container */
    destroy(): void;
    private _render;
}
type HTMLElementCtor = typeof HTMLElement;
declare const _HTMLElement: HTMLElementCtor;
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
export declare class HtexDocElement extends _HTMLElement {
    static observedAttributes: string[];
    private _renderer;
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(): void;
    private _init;
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
export declare function registerCustomElement(tagName?: string, ElementClass?: typeof HTMLElement): void;
export { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
//# sourceMappingURL=index.d.ts.map