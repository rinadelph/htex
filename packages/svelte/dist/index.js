// =============================================================================
// @htex/svelte — Svelte adapter for @htex/core
//
// Provides Svelte-compatible stores and action for rendering LaTeX.
// Since .svelte SFC files require a build step, this adapter exports:
//   1. A svelte store that holds the rendered HTML
//   2. A svelte action `use:htex` for rendering into any element
//   3. Convenience functions for SSR
//
// USAGE in a Svelte component:
//   <script>
//     import { createHtexStore } from '@htex/svelte'
//     const htex = createHtexStore(myLatex, { theme: 'dark' })
//   </script>
//   <div use:htex={{ source: myLatex, theme: 'dark' }}></div>
//   <div>{@html $htex.html}</div>
// =============================================================================
export const VERSION = '0.1.0';
import { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
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
export function createHtexStore(initialSource = '', options = {}) {
    let currentValue = { html: '', svg: '', tree: null, error: null };
    const subscribers = new Set();
    let currentOptions = { ...options };
    function notify() {
        for (const sub of subscribers)
            sub(currentValue);
    }
    function render(source) {
        try {
            const tree = latexToRenderTree(source, currentOptions);
            const html = renderToHtml(tree, { ...currentOptions, standalone: false });
            const svg = renderToSvg(tree, { ...currentOptions, standalone: false });
            currentValue = { html, svg, tree, error: null };
        }
        catch (err) {
            currentValue = {
                ...currentValue,
                error: err instanceof Error ? err : new Error(String(err)),
            };
        }
        notify();
    }
    if (initialSource)
        render(initialSource);
    return {
        subscribe(subscriber) {
            subscribers.add(subscriber);
            subscriber(currentValue);
            return () => subscribers.delete(subscriber);
        },
        update(source, opts) {
            if (opts)
                currentOptions = { ...currentOptions, ...opts };
            render(source);
        },
        destroy() {
            subscribers.clear();
        },
    };
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
export function htex(node, params) {
    function render(p) {
        try {
            if (p.target === 'svg') {
                node.innerHTML = latexToSvg(p.source, { ...p, standalone: false });
            }
            else {
                node.innerHTML = latexToHtml(p.source, { ...p, standalone: false });
            }
        }
        catch (err) {
            node.innerHTML = `<p class="htex-error">${String(err)}</p>`;
        }
    }
    render(params);
    return {
        update(newParams) {
            render(newParams);
        },
        destroy() {
            node.innerHTML = '';
        },
    };
}
// ── SSR utilities ─────────────────────────────────────────────────────────
/**
 * Render LaTeX to HTML string for SSR (SvelteKit, etc.).
 * This is identical to @htex/core latexToHtml but re-exported here
 * so Svelte users don't need to import from two packages.
 */
export function renderLatexSSR(source, options = {}) {
    const tree = latexToRenderTree(source, options);
    const html = renderToHtml(tree, { ...options, standalone: false });
    const svg = renderToSvg(tree, { ...options, standalone: false });
    return { html, svg, tree };
}
// ── Re-exports ────────────────────────────────────────────────────────────
export { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
//# sourceMappingURL=index.js.map