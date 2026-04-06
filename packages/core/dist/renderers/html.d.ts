import type { RenderNode, RenderTree, RenderOptions } from '../types.js';
export interface HtmlRenderOptions extends RenderOptions {
    readonly title?: string;
    readonly standalone?: boolean;
    /** Base URL for pre-rendered diagram SVGs e.g. '/diagrams' */
    readonly diagramBaseUrl?: string;
    /**
     * Render mode:
     *   'paged'  (default) — each page is a white A4 card on a grey canvas,
     *                        \newpage / titlepage boundaries become real gaps.
     *   'canvas' — single infinite scroll, no page cards, white background.
     */
    readonly renderMode?: 'paged' | 'canvas';
}
export declare function renderToHtml(tree: RenderTree | readonly RenderNode[], options?: HtmlRenderOptions): string;
/**
 * Paginate all htex paged documents within a container.
 *
 * Call once after mounting HTML output from `renderToHtml(..., { renderMode: 'paged' })`.
 * Idempotent — already-paginated documents are skipped automatically.
 *
 * @param root - Element or Document to search within (defaults to `document`)
 *
 * @example
 * ```ts
 * // React
 * useEffect(() => { htexPaginate(ref.current) }, [rendered])
 *
 * // Svelte
 * afterUpdate(() => htexPaginate(el))
 *
 * // Vue
 * nextTick(() => htexPaginate(el.value))
 *
 * // Vanilla
 * div.innerHTML = latexToHtml(src, { renderMode: 'paged' })
 * htexPaginate(div)
 * ```
 */
export declare function htexPaginate(root?: Element | Document): void;
//# sourceMappingURL=html.d.ts.map