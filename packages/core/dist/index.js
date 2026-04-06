// =============================================================================
// @htex/core — public API
// Single entry point for the entire library.
// =============================================================================
export const VERSION = '0.1.0';
export { TokenKind as TokenKindEnum, HtexError, ParseError, TransformError, MeasureError, RenderError, DEFAULT_FONT_CONFIG, } from './types.js';
// ── Tokenizer ─────────────────────────────────────────────────────────────
export { tokenize } from './tokenizer/index.js';
// ── Parser ────────────────────────────────────────────────────────────────
export { parse } from './parser/index.js';
// ── Transformer ───────────────────────────────────────────────────────────
export { transform } from './transformer/index.js';
// ── Measurement ───────────────────────────────────────────────────────────
export { measure, measureSync, getMeasurementCacheSize, clearMeasurementCache, setMeasurementLocale, } from './measurement/index.js';
// ── Renderers ─────────────────────────────────────────────────────────────
export { renderToHtml, htexPaginate } from './renderers/html.js';
export { renderToSvg } from './renderers/svg.js';
// ── High-level convenience API ─────────────────────────────────────────────
import { tokenize } from './tokenizer/index.js';
import { parse } from './parser/index.js';
import { transform } from './transformer/index.js';
import { renderToHtml } from './renderers/html.js';
import { renderToSvg } from './renderers/svg.js';
/**
 * Convert a LaTeX string to an HTML string.
 * One-shot convenience that runs the full pipeline.
 *
 * @example
 * ```ts
 * import { latexToHtml } from '@htex/core'
 * const html = latexToHtml(myLatexString, { theme: 'dark', standalone: true })
 * ```
 */
export function latexToHtml(latex, options = {}) {
    const tokens = tokenize(latex);
    const ast = parse(tokens);
    const tree = transform(ast, options);
    return renderToHtml(tree, options);
}
/**
 * Convert a LaTeX string to an SVG string.
 * One-shot convenience that runs the full pipeline.
 */
export function latexToSvg(latex, options = {}) {
    const tokens = tokenize(latex);
    const ast = parse(tokens);
    const tree = transform(ast, options);
    return renderToSvg(tree, options);
}
/**
 * Parse and transform a LaTeX string into a framework-agnostic RenderTree.
 * Pass the resulting tree to any framework adapter.
 */
export function latexToRenderTree(latex, options = {}) {
    const tokens = tokenize(latex);
    const ast = parse(tokens);
    return transform(ast, options);
}
//# sourceMappingURL=index.js.map