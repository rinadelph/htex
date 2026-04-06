import React from 'react';
import type { RenderTree, ConvertOptions, Theme } from '@htex/core';
import type { HtmlRenderOptions } from '@htex/core';
import type { SvgRenderOptions } from '@htex/core';
export declare const VERSION = "0.1.0";
export type { RenderTree, ConvertOptions, Theme };
export type RenderTarget = 'html' | 'svg';
export interface HtexDocumentProps extends ConvertOptions, HtmlRenderOptions {
    /** LaTeX source string */
    source: string;
    /** 'html' (default) or 'svg' */
    target?: RenderTarget;
    /** Optional CSS class name for the wrapper div */
    className?: string;
    /** Optional inline styles for the wrapper div */
    style?: React.CSSProperties;
    /** Callback fired after each render with the resulting HTML/SVG string */
    onRender?: (output: string) => void;
    /** Callback fired if an error occurs during rendering */
    onError?: (error: Error) => void;
}
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
export declare const HtexDocument: React.FC<HtexDocumentProps>;
export interface HtexFragmentProps extends ConvertOptions, HtmlRenderOptions {
    /** LaTeX source fragment (may or may not include \begin{document}) */
    source: string;
    /** Wrapper HTML element (default: 'span') */
    as?: keyof JSX.IntrinsicElements;
    /** CSS class */
    className?: string;
    style?: React.CSSProperties;
}
/**
 * HtexFragment — renders a LaTeX fragment inline.
 * Wraps output in a <span> by default.
 *
 * @example
 * ```tsx
 * <p>See equation <HtexFragment source="$E = mc^2$" /> for details.</p>
 * ```
 */
export declare const HtexFragment: React.FC<HtexFragmentProps>;
export interface UseHtexResult {
    html: string;
    svg: string;
    tree: RenderTree | null;
    error: Error | null;
    isLoading: boolean;
}
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
export declare function useHtex(source: string, options?: ConvertOptions & HtmlRenderOptions & SvgRenderOptions): UseHtexResult;
export interface HtexMathProps {
    /** Raw LaTeX math string (without $ delimiters) */
    latex: string;
    /** 'inline' (default) or 'display' */
    mode?: 'inline' | 'display';
    className?: string;
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
export declare const HtexMath: React.FC<HtexMathProps>;
export { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
//# sourceMappingURL=index.d.ts.map