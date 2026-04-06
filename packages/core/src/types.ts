// =============================================================================
// @htex/core — types.ts
// Central type definitions for the entire library.
// No implementation — only interfaces, enums, and type aliases.
// =============================================================================

// ---------------------------------------------------------------------------
// TOKEN TYPES
// ---------------------------------------------------------------------------

export enum TokenKind {
  COMMAND = 'COMMAND',
  ENV_BEGIN = 'ENV_BEGIN',
  ENV_END = 'ENV_END',
  TEXT = 'TEXT',
  MATH_INLINE = 'MATH_INLINE',
  MATH_DISPLAY = 'MATH_DISPLAY',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  AMPERSAND = 'AMPERSAND',
  NEWLINE = 'NEWLINE',
  COMMENT = 'COMMENT',
  WHITESPACE = 'WHITESPACE',
  VERBATIM = 'VERBATIM',
  EOF = 'EOF',
}

export interface Token {
  readonly kind: TokenKind
  readonly value: string
  readonly line: number
  readonly col: number
}

// ---------------------------------------------------------------------------
// LATEX AST — output of the parser
// ---------------------------------------------------------------------------

export interface SourcePosition {
  readonly line: number
  readonly col: number
}

export interface BaseASTNode {
  readonly pos: SourcePosition
  readonly errors?: readonly ParseError[]
}

/** A key=value or bare option from [...] */
export interface ASTOption {
  readonly key: string
  readonly value: string
}

/** Represents a LaTeX command: \name[optArgs]{reqArg1}{reqArg2} */
export interface CommandNode extends BaseASTNode {
  readonly type: 'command'
  readonly name: string
  readonly optArgs: readonly ASTNode[][]
  readonly reqArgs: readonly ASTNode[][]
}

/** Represents a \begin{name}[optArgs]{reqArgs} body \end{name} */
export interface EnvironmentNode extends BaseASTNode {
  readonly type: 'environment'
  readonly name: string
  readonly optArgs: readonly ASTOption[]
  readonly reqArgs: readonly ASTNode[][]
  readonly body: readonly ASTNode[]
  /** For tabular/longtable/tabularx — the column spec string e.g. "lrr" */
  readonly columnSpec?: string | undefined
}

export interface TextASTNode extends BaseASTNode {
  readonly type: 'text'
  readonly content: string
}

export interface MathASTNode extends BaseASTNode {
  readonly type: 'math'
  readonly kind: 'inline' | 'display'
  /** Raw LaTeX math content verbatim, without delimiter characters */
  readonly content: string
}

export interface GroupASTNode extends BaseASTNode {
  readonly type: 'group'
  readonly children: readonly ASTNode[]
}

export interface CommentASTNode extends BaseASTNode {
  readonly type: 'comment'
  readonly content: string
}

export interface VerbatimASTNode extends BaseASTNode {
  readonly type: 'verbatim'
  readonly envName: string
  readonly content: string
  readonly options: readonly ASTOption[]
}

export type ASTNode =
  | CommandNode
  | EnvironmentNode
  | TextASTNode
  | MathASTNode
  | GroupASTNode
  | CommentASTNode
  | VerbatimASTNode

// ---------------------------------------------------------------------------
// PREAMBLE CONTEXT — extracted from \documentclass ... \begin{document}
// ---------------------------------------------------------------------------

export interface ColorDef {
  readonly name: string
  /** Color model: HTML, rgb, RGB, cmyk, gray, wave */
  readonly model: string
  /** Raw value string as given in \definecolor */
  readonly rawValue: string
  /** Resolved hex color e.g. '#58A6FF' */
  readonly hex: string
}

export interface PackageDef {
  readonly name: string
  readonly options: string
}

export interface CustomEnvDef {
  readonly name: string
  /** The base environment this is derived from (e.g. 'mdframed') */
  readonly basedOn: string
  readonly options: Record<string, string>
}

export interface CommandDef {
  readonly name: string
  readonly argCount: number
  readonly body: readonly ASTNode[]
}

export interface LstsetConfig {
  readonly language?: string
  readonly style?: string
  readonly [key: string]: string | undefined
}

export interface PreambleContext {
  readonly documentClass: string
  readonly documentOptions: string
  readonly packages: readonly PackageDef[]
  readonly colors: readonly ColorDef[]
  readonly customEnvs: readonly CustomEnvDef[]
  readonly commands: readonly CommandDef[]
  readonly lstset: LstsetConfig
  readonly rawPreambleNodes: readonly ASTNode[]
}

export interface DocumentAST {
  readonly preamble: PreambleContext
  readonly body: readonly ASTNode[]
  readonly errors: readonly ParseError[]
}

// ---------------------------------------------------------------------------
// RENDER TREE — framework-agnostic IR, output of the transformer
// ---------------------------------------------------------------------------

export interface LayoutHints {
  readonly measuredHeight?: number
  readonly lineCount?: number
  readonly lines?: readonly LayoutLine[]
}

export interface LayoutLine {
  readonly text: string
  readonly width: number
  readonly y: number
}

export interface StyleTokens {
  readonly bold?: boolean
  readonly italic?: boolean
  readonly underline?: boolean
  readonly strikethrough?: boolean
  /** Resolved hex color string e.g. '#58A6FF', never a LaTeX color name */
  readonly color?: string
  readonly fontSize?: number
  readonly fontFamily?: string
  readonly align?: 'left' | 'center' | 'right' | 'justify'
}

interface BaseRenderNode {
  readonly style?: StyleTokens
  readonly layout?: LayoutHints
  readonly attrs?: Readonly<Record<string, string>>
}

export interface DocumentRenderNode extends BaseRenderNode {
  readonly type: 'document'
  readonly metadata: DocumentMetadata
  readonly children: readonly RenderNode[]
}

export interface DocumentMetadata {
  readonly title?: string
  readonly author?: string
  readonly date?: string
  readonly documentClass: string
  readonly colors: readonly ColorDef[]
}

export interface SectionRenderNode extends BaseRenderNode {
  readonly type: 'section'
  readonly level: 1 | 2 | 3
  readonly title: readonly RenderNode[]
  readonly number: string
  readonly id: string
  readonly children: readonly RenderNode[]
}

export interface ParagraphRenderNode extends BaseRenderNode {
  readonly type: 'paragraph'
  readonly children: readonly RenderNode[]
}

export interface TextRenderNode extends BaseRenderNode {
  readonly type: 'text'
  readonly content: string
}

export interface InlineCodeRenderNode extends BaseRenderNode {
  readonly type: 'inlineCode'
  readonly content: string
}

export interface BoldRenderNode extends BaseRenderNode {
  readonly type: 'bold'
  readonly children: readonly RenderNode[]
}

export interface ItalicRenderNode extends BaseRenderNode {
  readonly type: 'italic'
  readonly children: readonly RenderNode[]
}

export interface UnderlineRenderNode extends BaseRenderNode {
  readonly type: 'underline'
  readonly children: readonly RenderNode[]
}

export interface ColorRenderNode extends BaseRenderNode {
  readonly type: 'color'
  /** Resolved hex color — never a LaTeX name */
  readonly color: string
  readonly children: readonly RenderNode[]
}

export interface TableRenderNode extends BaseRenderNode {
  readonly type: 'table'
  readonly caption?: readonly RenderNode[] | undefined
  readonly label?: string | undefined
  readonly children: readonly (TableRowRenderNode | TableRuleRenderNode)[]
}

export interface TableRowRenderNode extends BaseRenderNode {
  readonly type: 'tableRow'
  readonly isHeader: boolean
  readonly children: readonly TableCellRenderNode[]
}

export interface TableCellRenderNode extends BaseRenderNode {
  readonly type: 'tableCell'
  readonly colspan: number
  readonly rowspan: number
  readonly align: 'left' | 'center' | 'right'
  readonly children: readonly RenderNode[]
}

export interface TableRuleRenderNode extends BaseRenderNode {
  readonly type: 'tableRule'
  readonly ruleKind: 'top' | 'mid' | 'bottom' | 'hline' | 'cline'
  readonly columnStart?: number // For cline: which column to start (1-based)
  readonly columnEnd?: number   // For cline: which column to end (1-based)
}

export interface FigureRenderNode extends BaseRenderNode {
  readonly type: 'figure'
  readonly label?: string
  readonly position?: string
  readonly children: readonly RenderNode[]
}

export interface ImageRenderNode extends BaseRenderNode {
  readonly type: 'image'
  readonly src: string
  readonly alt?: string | undefined
  readonly width?: string | undefined
  readonly height?: string | undefined
  readonly rotation?: number | undefined  // angle in degrees
  readonly scale?: number | undefined     // scale multiplier (1.0 = 100%)
}

export interface CaptionRenderNode extends BaseRenderNode {
  readonly type: 'caption'
  readonly children: readonly RenderNode[]
}

export interface MathInlineRenderNode extends BaseRenderNode {
  readonly type: 'mathInline'
  /** Raw LaTeX math string verbatim, ready to pass directly to KaTeX/MathJax */
  readonly latex: string
}

export interface MathDisplayRenderNode extends BaseRenderNode {
  readonly type: 'mathDisplay'
  /** Raw LaTeX math string verbatim, ready to pass directly to KaTeX/MathJax */
  readonly latex: string
}

export interface CodeBlockRenderNode extends BaseRenderNode {
  readonly type: 'codeBlock'
  readonly code: string
  /** Lowercased language identifier e.g. 'python', 'typescript', '' */
  readonly language: string
  readonly caption?: string
}

export interface ListRenderNode extends BaseRenderNode {
  readonly type: 'list'
  readonly ordered: boolean
  readonly children: readonly ListItemRenderNode[]
}

export interface ListItemRenderNode extends BaseRenderNode {
  readonly type: 'listItem'
  readonly children: readonly RenderNode[]
}

export interface CustomBoxRenderNode extends BaseRenderNode {
  readonly type: 'customBox'
  /** The original environment name e.g. 'insight', 'bluebox', 'correction' */
  readonly label: string
  /** Resolved hex border color */
  readonly borderColor: string
  /** Resolved hex background color, may be transparent */
  readonly bgColor: string
  readonly children: readonly RenderNode[]
}

export interface LinkRenderNode extends BaseRenderNode {
  readonly type: 'link'
  readonly href: string
  readonly children: readonly RenderNode[]
}

export interface ReferenceRenderNode extends BaseRenderNode {
  readonly type: 'reference'
  readonly targetId: string
  /** Resolved display text e.g. '1.2' for a section ref */
  readonly resolvedText: string
}

export interface FootnoteRenderNode extends BaseRenderNode {
  readonly type: 'footnote'
  readonly number: number           // Footnote number (1-based)
  readonly id: string              // Unique footnote identifier
  readonly content: readonly RenderNode[]  // Footnote content
}

export interface EndnoteRenderNode extends BaseRenderNode {
  readonly type: 'endnote'
  readonly number: number           // Endnote number (1-based)
  readonly id: string              // Unique endnote identifier
  readonly content: readonly RenderNode[]  // Endnote content
}

export interface TOCRenderNode extends BaseRenderNode {
  readonly type: 'toc'
  readonly entries: readonly TOCEntry[]
}

export interface TOCEntry {
  readonly level: 1 | 2 | 3
  readonly number: string
  readonly title: string
  readonly id: string
}

export interface TitlePageRenderNode extends BaseRenderNode {
  readonly type: 'titlePage'
  readonly children: readonly RenderNode[]
  readonly metadata?: {
    readonly title?: string
    readonly author?: string
    readonly date?: string
  }
}

export interface CenterRenderNode extends BaseRenderNode {
  readonly type: 'center'
  readonly children: readonly RenderNode[]
}

export interface AbstractRenderNode extends BaseRenderNode {
  readonly type: 'abstract'
  readonly children: readonly RenderNode[]
}

export interface TikzRenderNode extends BaseRenderNode {
  readonly type: 'tikz'
  /** Full raw TikZ source including \begin{tikzpicture}...\end{tikzpicture} */
  readonly rawSource: string
  /** 1-based index of this TikZ diagram in document order — used to locate pre-rendered assets */
  readonly diagramIndex?: number
}

export interface PlotRenderNode extends BaseRenderNode {
  readonly type: 'plot'
  /** Full raw pgfplots source */
  readonly rawSource: string
  /** 1-based index in document order — used to locate pre-rendered SVG assets */
  readonly diagramIndex?: number
}

export interface HRuleRenderNode extends BaseRenderNode {
  readonly type: 'hRule'
}

export interface PageBreakRenderNode extends BaseRenderNode {
  readonly type: 'pageBreak'
}

/**
 * A styled span of inline content — produced when LaTeX "declaration" commands
 * like {\Huge\bfseries text} or {\color{red} text} appear inside a group.
 * The style object carries font-size, weight, style, color, and alignment.
 */
export interface StyledTextRenderNode extends BaseRenderNode {
  readonly type: 'styledText'
  /** CSS font-size value e.g. '20.74pt' for \Huge */
  readonly fontSize?: string
  /** CSS font-weight e.g. 'bold', 'normal' */
  readonly fontWeight?: string
  /** CSS font-style e.g. 'italic', 'normal' */
  readonly fontStyle?: string
  /** CSS font-variant e.g. 'small-caps', 'normal' */
  readonly fontVariant?: string
  /** CSS font-family e.g. 'monospace', 'sans-serif' */
  readonly fontFamily?: string
  /** Resolved hex color e.g. '#FF0000' */
  readonly color?: string
  /** CSS text-align e.g. 'center' */
  readonly textAlign?: string
  /** CSS margin-top for vertical spacing */
  readonly marginTop?: string
  /** CSS margin-right for horizontal spacing */
  readonly marginRight?: string
  /** CSS rotation in degrees */
  readonly rotation?: number
  /** CSS scale multiplier */
  readonly scale?: number
  /** CSS visibility e.g. 'hidden' */
  readonly visibility?: string
  /** CSS white-space e.g. 'nowrap' */
  readonly whiteSpace?: string
  readonly children: readonly RenderNode[]
}

export type RenderNode =
  | DocumentRenderNode
  | SectionRenderNode
  | ParagraphRenderNode
  | TextRenderNode
  | InlineCodeRenderNode
  | BoldRenderNode
  | ItalicRenderNode
  | UnderlineRenderNode
  | ColorRenderNode
  | TableRenderNode
  | TableRowRenderNode
  | TableCellRenderNode
  | TableRuleRenderNode
  | FigureRenderNode
  | ImageRenderNode
  | CaptionRenderNode
  | MathInlineRenderNode
  | MathDisplayRenderNode
  | CodeBlockRenderNode
  | ListRenderNode
  | ListItemRenderNode
  | CustomBoxRenderNode
  | LinkRenderNode
  | ReferenceRenderNode
  | FootnoteRenderNode
  | EndnoteRenderNode
  | TOCRenderNode
  | TitlePageRenderNode
  | CenterRenderNode
  | AbstractRenderNode
  | TikzRenderNode
  | PlotRenderNode
  | HRuleRenderNode
  | PageBreakRenderNode
  | StyledTextRenderNode

export type RenderTree = readonly RenderNode[]

// ---------------------------------------------------------------------------
// FONT CONFIG
// ---------------------------------------------------------------------------

export interface FontConfig {
  readonly body: string
  readonly heading: string
  readonly mono: string
  readonly lineHeight: number
  readonly locale?: string
}

export const DEFAULT_FONT_CONFIG: FontConfig = {
  body: '16px serif',
  heading: 'bold 20px serif',
  mono: '14px monospace',
  lineHeight: 24,
}

// ---------------------------------------------------------------------------
// OPTIONS INTERFACES
// ---------------------------------------------------------------------------

export interface ParseOptions {
  readonly strict?: boolean
  readonly maxDepth?: number
}

export interface TransformOptions {
  readonly numberSections?: boolean
  readonly expandMacros?: boolean
  readonly resolveRefs?: boolean
}

export interface MeasureOptions extends FontConfig {
  readonly maxWidth?: number
  readonly skipMeasurement?: boolean
}

export type MathEngine = 'katex' | 'mathjax' | 'none'
export type CodeHighlighter = 'prism' | 'highlightjs' | 'none'
export type Theme = 'light' | 'dark'

export interface RenderOptions {
  readonly theme?: Theme
  readonly mathEngine?: MathEngine
  readonly codeHighlighter?: CodeHighlighter
  readonly baseUrl?: string
  readonly embedStyles?: boolean
  /**
   * Base URL for pre-rendered TikZ/pgfplots diagram assets.
   * When set, TikZ nodes render as <img src="{diagramBaseUrl}/tikz-NN.svg">
   * instead of a placeholder. The assets must be pre-rendered using
   * scripts/render-tikz.py and placed in the demo's public/diagrams/ folder.
   * Example: '/diagrams'
   */
  readonly diagramBaseUrl?: string
}

export interface ConvertOptions extends
  Partial<ParseOptions>,
  Partial<TransformOptions>,
  Partial<MeasureOptions>,
  Partial<RenderOptions> {}

// ---------------------------------------------------------------------------
// ERROR TYPES
// ---------------------------------------------------------------------------

export class HtexError extends Error {
  override readonly name: string = 'HtexError'
  constructor(message: string, public readonly context?: string) {
    super(message)
  }
}

export class ParseError extends HtexError {
  override readonly name = 'ParseError'
  constructor(
    message: string,
    public readonly line: number,
    public readonly col: number,
    context?: string,
  ) {
    super(`[${line}:${col}] ${message}`, context)
  }
}

export class TransformError extends HtexError {
  override readonly name = 'TransformError'
  constructor(message: string, public readonly nodeType?: string, context?: string) {
    super(message, context)
  }
}

export class MeasureError extends HtexError {
  override readonly name = 'MeasureError'
  constructor(message: string, public readonly font?: string, context?: string) {
    super(message, context)
  }
}

export class RenderError extends HtexError {
  override readonly name = 'RenderError'
  constructor(message: string, public readonly renderTarget?: string, context?: string) {
    super(message, context)
  }
}
