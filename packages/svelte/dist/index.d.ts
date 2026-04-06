export declare const VERSION = "0.1.0";
import type { RenderTree, ConvertOptions, Theme } from '@htex/core';
import type { HtmlRenderOptions } from '@htex/core';
export type { RenderTree, ConvertOptions, Theme };
export type RenderTarget = 'html' | 'svg';
export interface HtexSvelteOptions extends ConvertOptions, HtmlRenderOptions {
    target?: RenderTarget;
    svgWidth?: number;
}
export interface HtexStore {
    html: string;
    svg: string;
    tree: RenderTree | null;
    error: Error | null;
}
export interface HtexStoreSubscriber {
    (value: HtexStore): void;
}
export interface HtexReadable {
    subscribe: (subscriber: HtexStoreSubscriber) => () => void;
    update: (source: string, opts?: Partial<HtexSvelteOptions>) => void;
    destroy: () => void;
}
/**
 * Create a Svelte-compatible readable store that holds the rendered LaTeX output.
 * Use {@html $store.html} in your Svelte templates.
 *
 * @example
 * ```svelte
 * <script>
 *   import { createHtexStore } from '@htex/svelte'
 *   const store = createHtexStore(myLatex, { theme: 'dark' })
 * </script>
 * <div>{@html $store.html}</div>
 * ```
 */
export declare function createHtexStore(initialSource?: string, options?: HtexSvelteOptions): HtexReadable;
export interface HtexActionParams extends HtexSvelteOptions {
    source: string;
}
export interface HtexAction {
    update: (params: HtexActionParams) => void;
    destroy: () => void;
}
/**
 * Svelte action for rendering LaTeX into a DOM element.
 * Use with `use:htex={{ source: myLatex, theme: 'dark' }}`.
 *
 * @example
 * ```svelte
 * <script>
 *   import { htex } from '@htex/svelte'
 *   let source = '\\begin{document}Hello $x^2$\\end{document}'
 * </script>
 * <div use:htex={{ source, theme: 'dark' }}></div>
 * ```
 */
export declare function htex(node: HTMLElement, params: HtexActionParams): HtexAction;
/**
 * Render LaTeX to HTML string for SSR (SvelteKit, etc.).
 * This is identical to @htex/core latexToHtml but re-exported here
 * so Svelte users don't need to import from two packages.
 */
export declare function renderLatexSSR(source: string, options?: HtexSvelteOptions): {
    html: string;
    svg: string;
    tree: RenderTree;
};
export { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
//# sourceMappingURL=index.d.ts.map