// =============================================================================
// @htex/core — public API
// Single entry point for the entire library.
// =============================================================================

export const VERSION = '0.1.0'

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  Token, TokenKind,
  ASTNode, CommandNode, EnvironmentNode, TextASTNode, MathASTNode,
  GroupASTNode, CommentASTNode, VerbatimASTNode, ASTOption, SourcePosition,
  BaseASTNode, DocumentAST, PreambleContext, PackageDef, ColorDef,
  CustomEnvDef, CommandDef, LstsetConfig,
  RenderNode, RenderTree,
  DocumentRenderNode, DocumentMetadata, SectionRenderNode, ParagraphRenderNode,
  TextRenderNode, BoldRenderNode, ItalicRenderNode, ColorRenderNode,
  TableRenderNode, TableRowRenderNode, TableCellRenderNode, TableRuleRenderNode,
  FigureRenderNode, ImageRenderNode, CaptionRenderNode,
  MathInlineRenderNode, MathDisplayRenderNode, CodeBlockRenderNode,
  ListRenderNode, ListItemRenderNode, CustomBoxRenderNode,
  LinkRenderNode, ReferenceRenderNode, TOCRenderNode, TOCEntry,
  TitlePageRenderNode, CenterRenderNode, AbstractRenderNode,
  TikzRenderNode, PlotRenderNode, HRuleRenderNode, PageBreakRenderNode,
  LayoutHints, LayoutLine, StyleTokens, FontConfig,
  ParseOptions, TransformOptions, MeasureOptions, RenderOptions, ConvertOptions,
  MathEngine, CodeHighlighter, Theme,
} from './types.js'

export {
  TokenKind as TokenKindEnum,
  HtexError, ParseError, TransformError, MeasureError, RenderError,
  DEFAULT_FONT_CONFIG,
} from './types.js'

// ── Tokenizer ─────────────────────────────────────────────────────────────
export { tokenize } from './tokenizer/index.js'

// ── Parser ────────────────────────────────────────────────────────────────
export { parse } from './parser/index.js'

// ── Transformer ───────────────────────────────────────────────────────────
export { transform } from './transformer/index.js'
export type { TransformContext } from './transformer/index.js'

// ── Measurement ───────────────────────────────────────────────────────────
export {
  measure,
  measureSync,
  getMeasurementCacheSize,
  clearMeasurementCache,
  setMeasurementLocale,
} from './measurement/index.js'

// ── Renderers ─────────────────────────────────────────────────────────────
export { renderToHtml, htexPaginate } from './renderers/html.js'
export type { HtmlRenderOptions } from './renderers/html.js'
export { renderToSvg } from './renderers/svg.js'
export type { SvgRenderOptions } from './renderers/svg.js'

// ── High-level convenience API ─────────────────────────────────────────────

import { tokenize } from './tokenizer/index.js'
import { parse } from './parser/index.js'
import { transform } from './transformer/index.js'
import { renderToHtml } from './renderers/html.js'
import { renderToSvg } from './renderers/svg.js'
import type { ConvertOptions, RenderTree } from './types.js'
import type { HtmlRenderOptions } from './renderers/html.js'
import type { SvgRenderOptions } from './renderers/svg.js'

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
export function latexToHtml(
  latex: string,
  options: ConvertOptions & HtmlRenderOptions = {},
): string {
  const tokens = tokenize(latex)
  const ast = parse(tokens)
  const tree = transform(ast, options)
  return renderToHtml(tree, options)
}

/**
 * Convert a LaTeX string to an SVG string.
 * One-shot convenience that runs the full pipeline.
 */
export function latexToSvg(
  latex: string,
  options: ConvertOptions & SvgRenderOptions = {},
): string {
  const tokens = tokenize(latex)
  const ast = parse(tokens)
  const tree = transform(ast, options)
  return renderToSvg(tree, options)
}

/**
 * Parse and transform a LaTeX string into a framework-agnostic RenderTree.
 * Pass the resulting tree to any framework adapter.
 */
export function latexToRenderTree(
  latex: string,
  options: ConvertOptions = {},
): RenderTree {
  const tokens = tokenize(latex)
  const ast = parse(tokens)
  return transform(ast, options)
}
