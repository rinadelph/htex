// =============================================================================
// @htex/react — React adapter for @htex/core
//
// Provides React components for rendering LaTeX documents.
// Uses dangerouslySetInnerHTML with the sanitized HTML renderer output.
// The output is safe because renderToHtml escapes all user content.
//
// USAGE:
//   import { HtexDocument, HtexFragment } from '@htex/react'
//   <HtexDocument source={myLatexString} theme="dark" />
// =============================================================================
import React, { useMemo, useEffect, useState } from 'react';
import { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
export const VERSION = '0.1.0';
/**
 * HtexDocument — renders a full LaTeX document as a React component.
 * Uses the HTML renderer (or SVG with `target="svg"`).
 *
 * The output is injected via dangerouslySetInnerHTML. This is safe because
 * the @htex/core HTML renderer escapes all user-provided content.
 *
 * @example
 * ```tsx
 * <HtexDocument source={myLatex} theme="dark" className="paper" />
 * ```
 */
export const HtexDocument = ({ source, target = 'html', className, style, onRender, onError, ...options }) => {
    const html = useMemo(() => {
        try {
            if (target === 'svg') {
                return latexToSvg(source, { ...options, standalone: false });
            }
            return latexToHtml(source, { ...options, standalone: false });
        }
        catch (err) {
            onError?.(err instanceof Error ? err : new Error(String(err)));
            return `<div class="htex-error">Render error: ${String(err)}</div>`;
        }
    }, [source, target, options.theme, options.mathEngine, options.codeHighlighter]);
    useEffect(() => {
        onRender?.(html);
    }, [html]);
    return React.createElement('div', {
        className: className ?? 'htex-document',
        style,
        dangerouslySetInnerHTML: { __html: html },
    });
};
HtexDocument.displayName = 'HtexDocument';
/**
 * HtexFragment — renders a LaTeX fragment inline.
 * Wraps output in a <span> by default.
 *
 * @example
 * ```tsx
 * <p>See equation <HtexFragment source="$E = mc^2$" /> for details.</p>
 * ```
 */
export const HtexFragment = ({ source, as: Tag = 'span', className, style, ...options }) => {
    // Wrap in document env if not already present
    const fullSource = source.includes('\\begin{document}')
        ? source
        : `\\begin{document}${source}\\end{document}`;
    const html = useMemo(() => {
        return latexToHtml(fullSource, { ...options, standalone: false });
    }, [fullSource, options.theme]);
    return React.createElement(Tag, {
        className,
        style,
        dangerouslySetInnerHTML: { __html: html },
    });
};
HtexFragment.displayName = 'HtexFragment';
/**
 * useHtex — React hook that parses and renders a LaTeX string.
 * Returns the HTML output, SVG output, and raw RenderTree.
 *
 * @example
 * ```tsx
 * const { html, error } = useHtex(myLatex, { theme: 'dark' })
 * if (error) return <p>Error: {error.message}</p>
 * return <div dangerouslySetInnerHTML={{ __html: html }} />
 * ```
 */
export function useHtex(source, options = {}) {
    const [result, setResult] = useState({
        html: '',
        svg: '',
        tree: null,
        error: null,
        isLoading: true,
    });
    useEffect(() => {
        try {
            const tree = latexToRenderTree(source, options);
            const html = renderToHtml(tree, { ...options, standalone: false });
            const svg = renderToSvg(tree, { ...options, standalone: false });
            setResult({ html, svg, tree, error: null, isLoading: false });
        }
        catch (err) {
            setResult(prev => ({
                ...prev,
                error: err instanceof Error ? err : new Error(String(err)),
                isLoading: false,
            }));
        }
    }, [source, options.theme]);
    return result;
}
/**
 * HtexMath — renders a raw LaTeX math expression.
 * Outputs MathJax-compatible delimiters for client-side rendering.
 *
 * @example
 * ```tsx
 * <HtexMath latex="\frac{\alpha}{\beta}" mode="display" />
 * ```
 */
export const HtexMath = ({ latex, mode = 'inline', className }) => {
    const content = mode === 'display' ? `\\[${latex}\\]` : `\\(${latex}\\)`;
    return React.createElement('span', {
        className: `htex-math htex-math--${mode}${className ? ` ${className}` : ''}`,
        'data-latex': latex,
        dangerouslySetInnerHTML: { __html: content },
    });
};
HtexMath.displayName = 'HtexMath';
// ── Convenience re-exports ────────────────────────────────────────────────
export { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
//# sourceMappingURL=index.js.map