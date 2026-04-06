# LaTeX Support Expansion Plan for htex

## Current Status

### Currently Implemented ✅
- **Environments**: itemize, enumerate, description, tabular, longtable, tabularx, array, figure, tikzpicture, axis, center, abstract, titlepage, multicols, minipage, mdframed, lstlisting, verbatim, align, equation, gather, multline, quote, quotation
- **Text Formatting**: bold, italic, underline, strikethrough, monospace, small, large, colors
- **Math**: Inline ($...$) and display ($$...$$, \[...\], \(...\)) math with KaTeX rendering
- **Structural**: Sections (section, subsection, subsubsection), labels, references, table of contents
- **Graphics**: tikzpicture, pgfplots (axis), figure environments
- **Code**: lstlisting, verbatim, syntax highlighting
- **Spacing**: Basic newline handling, paragraph separation
- **Colors**: definecolor, xcolor syntax, color mixing

### High Priority Additions (Phase 1)

#### 1. Float Environments
- [ ] `table` and `table*` environments
- [ ] `algorithm` and `algorithm2e` support
- [ ] Float positioning options (h, t, b, p, H)

#### 2. Advanced List Environments
- [ ] `trivlist` environment
- [ ] Custom `newenvironment` for list variations
- [ ] Better `\item` label customization
- [ ] `itemize` with custom bullets

#### 3. Math Environment Extensions
- [ ] `cases` environment (piecewise functions)
- [ ] `split` environment
- [ ] `subarray` environment
- [ ] `aligned`, `alignedat` environments
- [ ] `gathered`, `shoveright`, `shoveLeft` environments
- [ ] Matrix environments: `matrix`, `pmatrix`, `bmatrix`, `vmatrix`, `Vmatrix`, `smallmatrix`
- [ ] `dcases` (display cases)

#### 4. Table Enhancements
- [ ] `\multirow` support
- [ ] `\multicolumn` improvements (already partial)
- [ ] `\cline` for partial horizontal lines
- [ ] Column alignment options (l, c, r, p{})
- [ ] Table styling with booktabs: `\toprule`, `\midrule`, `\bottomrule`
- [ ] Table environments: `tabulary`, `nicetabular` (optional)

#### 5. Graphics and Images
- [ ] `\includegraphics` with options (width, height, scale, angle, trim)
- [ ] `\scalebox`, `\resizebox` commands
- [ ] `\rotatebox` command
- [ ] SVG support in addition to raster images
- [ ] Captions with numbering

#### 6. Box and Frame Commands
- [ ] `\fbox`, `\framebox` (simple framed boxes)
- [ ] `\makebox`, `\mbox` (width-fixed boxes)
- [ ] `\raisebox`, `\lowbox` (vertical positioning)
- [ ] `\parbox` (paragraph in a box)
- [ ] `\rule` (horizontal/vertical rules)
- [ ] `\strut` and phantom commands

### Medium Priority Additions (Phase 2)

#### 7. Spacing and Alignment Commands
- [ ] `\vspace{}`, `\vspace*{}` (vertical spacing)
- [ ] `\hspace{}`, `\hspace*{}` (horizontal spacing)
- [ ] `\medskip`, `\bigskip`, `\smallskip`
- [ ] `\quad`, `\qquad`, `\,`, `\:`, `\;`, `\!`
- [ ] `\phantom{}`, `\hphantom{}`, `\vphantom{}`

#### 8. Cross-References and Bibliography
- [ ] `\pageref{}` (page references)
- [ ] `\nameref{}` (section name references)
- [ ] `\cite{}` enhancements with options
- [ ] `\thebibliography` environment
- [ ] `\bibitem` with customizable labels
- [ ] Bibliography file parsing (.bib)

#### 9. Footnotes and Endnotes
- [ ] `\footnote{}` command with automatic numbering
- [ ] `\endnote{}` for endnotes
- [ ] `\footnotemark` and `\footnotetext`
- [ ] Footnote positioning (bottom of page)

#### 10. Advanced Sectioning
- [ ] `\appendix` support
- [ ] `\part` sectioning level
- [ ] Section numbering customization
- [ ] Starred versions: `\section*`, `\chapter*`
- [ ] Custom counters with `\setcounter`, `\stepcounter`, `\newcounter`

#### 11. Custom Command Definitions
- [ ] `\newcommand{\name}[n]{def}` improvements
- [ ] `\renewcommand{\name}[n]{def}`
- [ ] `\newenvironment{name}[n]{begin}{end}` parsing and execution
- [ ] `\let` command aliasing

#### 12. Text Decorations
- [ ] `\underline` improvements (proper line rendering)
- [ ] `\overline` (line above text)
- [ ] `\overset` (symbol over text)
- [ ] `\underset` (symbol under text)
- [ ] `\cancel`, `\bcancel` (strikethrough variants)

### Lower Priority Additions (Phase 3)

#### 13. Advanced Positioning
- [ ] `\begin{absolute}...\end{absolute}` environments
- [ ] Absolute positioning with coordinates
- [ ] Z-index/layer support

#### 14. Conditional Processing
- [ ] `\ifx`, `\ifthenelse` basic support
- [ ] Conditional compilation branches

#### 15. Preamble Extensions
- [ ] `\usepackage` option parsing
- [ ] `\documentclass` options handling
- [ ] `\input`, `\include` file inclusion

#### 16. Advanced Graphics
- [ ] `\begin{pspicture}...\end{pspicture}` (PSTricks)
- [ ] `\begin{overpic}...\end{overpic}` (overlays)
- [ ] SVG import and rendering

## Implementation Strategy

### Phase 1 (Week 1): Core LaTeX Commands
1. Add float environments (table, algorithm)
2. Implement advanced math environments
3. Add spacing and alignment commands
4. Enhance table support with multirow/multicolumn

### Phase 2 (Week 2): Cross-References & Typography
1. Implement footnotes and endnotes
2. Add cross-reference enhancements
3. Improve sectioning support
4. Add box and frame commands

### Phase 3 (Week 3): Advanced Features
1. Custom command definitions
2. Bibliography support
3. Advanced graphics
4. Conditional processing

## Testing Strategy

For each new feature:
1. Add unit tests in `src/__tests__/` for tokenizer/parser/transformer
2. Add integration tests for end-to-end rendering
3. Create example documents demonstrating the feature
4. Verify visual output matches LaTeX PDF equivalently

## Files to Modify

- `packages/core/src/types.ts` - Add new RenderNode types
- `packages/core/src/tokenizer/index.ts` - Handle new tokens if needed
- `packages/core/src/parser/index.ts` - Parse new commands/environments
- `packages/core/src/transformer/index.ts` - Transform to RenderNodes
- `packages/core/src/renderers/html.ts` - Render to HTML/CSS
- Tests in `src/__tests__/`
- Examples in `examples/demo-react/`
