export declare const VERSION = "0.1.0";
export type { Token, TokenKind, ASTNode, CommandNode, EnvironmentNode, TextASTNode, MathASTNode, GroupASTNode, CommentASTNode, VerbatimASTNode, ASTOption, SourcePosition, BaseASTNode, DocumentAST, PreambleContext, PackageDef, ColorDef, CustomEnvDef, CommandDef, LstsetConfig, RenderNode, RenderTree, DocumentRenderNode, DocumentMetadata, SectionRenderNode, ParagraphRenderNode, TextRenderNode, BoldRenderNode, ItalicRenderNode, ColorRenderNode, TableRenderNode, TableRowRenderNode, TableCellRenderNode, TableRuleRenderNode, FigureRenderNode, ImageRenderNode, CaptionRenderNode, MathInlineRenderNode, MathDisplayRenderNode, CodeBlockRenderNode, ListRenderNode, ListItemRenderNode, CustomBoxRenderNode, LinkRenderNode, ReferenceRenderNode, TOCRenderNode, TOCEntry, TitlePageRenderNode, CenterRenderNode, AbstractRenderNode, TikzRenderNode, PlotRenderNode, HRuleRenderNode, PageBreakRenderNode, LayoutHints, LayoutLine, StyleTokens, FontConfig, ParseOptions, TransformOptions, MeasureOptions, RenderOptions, ConvertOptions, MathEngine, CodeHighlighter, Theme, } from './types.js';
export { TokenKind as TokenKindEnum, HtexError, ParseError, TransformError, MeasureError, RenderError, DEFAULT_FONT_CONFIG, } from './types.js';
export { tokenize } from './tokenizer/index.js';
export { parse } from './parser/index.js';
export { transform } from './transformer/index.js';
export type { TransformContext } from './transformer/index.js';
export { measure, measureSync, getMeasurementCacheSize, clearMeasurementCache, setMeasurementLocale, } from './measurement/index.js';
export { renderToHtml, htexPaginate } from './renderers/html.js';
export type { HtmlRenderOptions } from './renderers/html.js';
export { renderToSvg } from './renderers/svg.js';
export type { SvgRenderOptions } from './renderers/svg.js';
import type { ConvertOptions, RenderTree } from './types.js';
import type { HtmlRenderOptions } from './renderers/html.js';
import type { SvgRenderOptions } from './renderers/svg.js';
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
export declare function latexToHtml(latex: string, options?: ConvertOptions & HtmlRenderOptions): string;
/**
 * Convert a LaTeX string to an SVG string.
 * One-shot convenience that runs the full pipeline.
 */
export declare function latexToSvg(latex: string, options?: ConvertOptions & SvgRenderOptions): string;
/**
 * Parse and transform a LaTeX string into a framework-agnostic RenderTree.
 * Pass the resulting tree to any framework adapter.
 */
export declare function latexToRenderTree(latex: string, options?: ConvertOptions): RenderTree;
//# sourceMappingURL=index.d.ts.map