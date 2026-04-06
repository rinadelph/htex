// =============================================================================
// @htex/core — renderers/html.ts
// Produces LaTeX-faithful HTML output.
// - KaTeX for all math rendering (no JS passthrough)
// - Latin Modern / Computer Modern web fonts
// - Exact LaTeX article class layout and typography
// - booktabs-faithful table rules
// - Zero markdown-derived styling
// =============================================================================
import katex from 'katex';
// ── HTML escaping with LaTeX ligature substitution ────────────────────────
function esc(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
// Text nodes also get LaTeX dash ligatures: --- 	 em dash, -- 	 en dash
function escWithDashes(s) {
    return esc(s)
        .replace(/---/g, '&mdash;')
        .replace(/--/g, '&ndash;')
        .replace(/``/g, '\u201C') // left double quote
        .replace(/''/g, '\u201D') // right double quote
        .replace(/`/g, '\u2018') // left single quote
        .replace(/'/g, '\u2019'); // right single quote (apostrophe)
}
// ── Math rendering via KaTeX 	 MathML (no CSS required) ──────────────────
function renderMathKatex(latex, display) {
    try {
        return katex.renderToString(latex, {
            displayMode: display,
            throwOnError: false,
            errorColor: '#cc0000',
            trust: false,
            strict: 'ignore',
            output: 'mathml', // Self-contained, no external CSS needed
        });
    }
    catch {
        const cls = display ? 'htex-math-display-err' : 'htex-math-inline-err';
        return `<span class="${cls}" title="Math render error">${esc(latex)}</span>`;
    }
}
// ── CSS: exact LaTeX article class visual reproduction ────────────────────
//
// Design decisions derived from first principles:
//
// FONT: Computer Modern Roman (Knuth 1978) 	 web equivalent = Latin Modern.
//   The renderer emits @font-face rules that load Latin Modern from a URL
//   the caller is expected to serve (Vite copies /public/fonts/* 	 /fonts/*).
//   Fallback chain: Latin Modern 	 STIX Two Text 	 Georgia (similar serifs).
//
// SIZES: LaTeX article 10pt base.
//   1pt (LaTeX) = 72/72.27 CSS pt ≈ 0.9962pt. Close enough to just use pt.
//   \normalsize = 10pt, \large = 10.95pt, \Large = 12pt, \LARGE = 14.4pt
//   \huge = 17.28pt, \Huge = 20.74pt
//
// LINE HEIGHT: \baselineskip = 12pt for 10pt = ratio 1.2.
//
// PARAGRAPH: \parindent = 15pt ≈ 1.5em; \parskip = 0pt.
//   	 indent only, no gap between paragraphs.
//
// TEXT WIDTH: article class letter paper = 345pt ≈ 4.79in.
//
// HEADINGS: no borders, no underlines. Bold serif, properly sized.
//   \section = \Large\bfseries (12pt bold)
//   \subsection = \large\bfseries (10.95pt bold)
//   \subsubsection = \normalsize\bfseries (10pt bold)
//
// TABLES: booktabs style — horizontal rules only, no vertical lines.
//   \toprule / \bottomrule = 0.08em, \midrule = 0.05em.
//
// MATH: KaTeX MathML — self-contained, no CSS needed.
//
function buildCss(colors, theme) {
    const isDark = theme === 'dark';
    // Light = white paper / black ink (exactly like a printed LaTeX doc)
    // Dark = inverted for screen comfort
    const bg = isDark ? '#0D1117' : '#ffffff';
    const fg = isDark ? '#c9d1d9' : '#000000';
    const codeBg = isDark ? '#161b22' : '#f5f5f5';
    const ruleColor = isDark ? '#aaaaaa' : '#000000';
    const mutedFg = isDark ? '#888888' : '#555555';
    const linkColor = isDark ? '#58a6ff' : '#00008b'; // LaTeX uses dark blue for hyperlinks
    const colorVars = colors.map(c => `  --htex-color-${c.name}: ${c.hex};`).join('\n');
    return `
/* ── Latin Modern web fonts (Latin Modern = OpenType Computer Modern) ──── */
@font-face {
  font-family: 'Latin Modern';
  font-style: normal;
  font-weight: normal;
  font-display: swap;
  src: local('Latin Modern Roman'), local('LM Roman 10'),
       url('/fonts/lmroman10-regular.otf') format('opentype');
}
@font-face {
  font-family: 'Latin Modern';
  font-style: italic;
  font-weight: normal;
  font-display: swap;
  src: local('Latin Modern Roman Italic'), local('LM Roman 10 Italic'),
       url('/fonts/lmroman10-italic.otf') format('opentype');
}
@font-face {
  font-family: 'Latin Modern';
  font-style: normal;
  font-weight: bold;
  font-display: swap;
  src: local('Latin Modern Roman Bold'), local('LM Roman 10 Bold'),
       url('/fonts/lmroman10-bold.otf') format('opentype');
}
@font-face {
  font-family: 'Latin Modern';
  font-style: italic;
  font-weight: bold;
  font-display: swap;
  src: local('Latin Modern Roman Bold Italic'), local('LM Roman 10 Bold Italic'),
       url('/fonts/lmroman10-bolditalic.otf') format('opentype');
}
@font-face {
  font-family: 'Latin Modern Mono';
  font-style: normal;
  font-weight: normal;
  font-display: swap;
  src: local('Latin Modern Mono'), local('LM Mono 10'),
       url('/fonts/lmmono10-regular.otf') format('opentype');
}

/* ── Custom color variables ─────────────────────────────────────────────── */
:root {
${colorVars}
}

/* == Document root: paged viewer == */
/* .htex-document is the scroll container — grey like Acrobat/Overleaf      */
/* .htex-page is each individual A4 sheet card                               */
.htex-document {
  /* Font: Latin Modern Roman = Computer Modern for the web */
  font-family: 'Latin Modern', 'STIX Two Text', Georgia,
               'Times New Roman', Times, serif;
  font-size: 11pt;
  line-height: 1.2;
  color: ${fg};
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  hyphens: auto;
  -webkit-hyphens: auto;
}

/* ── PAGED mode: grey canvas + white A4 cards ───────────────────────────── */
/* The JS paginator builds .htex-page cards inside .htex-pages              */
.htex-document[data-render-mode="paged"] {
  background: #525659;  /* Acrobat / Overleaf grey */
  padding: 2rem 0;
  min-height: 100%;
}
/* .htex-canvas is the hidden source pool — never visible */
.htex-document[data-render-mode="paged"] .htex-canvas {
  display: none !important;
}
/* .htex-pages is the visible container for page cards */
.htex-document[data-render-mode="paged"] .htex-pages {
  display: block;
}
/* Each A4 page card */
.htex-document[data-render-mode="paged"] .htex-page {
  background: ${bg};
  color: ${fg};
  width: 210mm;
  max-width: calc(100% - 2rem);
  /* min-height only — never clip content. The paginator ensures pages fill A4. */
  min-height: 297mm;
  padding: 25mm;
  margin: 0 auto 2rem auto;
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.18),
    0 4px 28px rgba(0,0,0,0.5);
  box-sizing: border-box;
  overflow: visible;
  position: relative;
}
.htex-document[data-render-mode="paged"][data-theme="dark"] .htex-page {
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.08),
    0 4px 24px rgba(0,0,0,0.8);
}
/* Page number footer */
.htex-document[data-render-mode="paged"] .htex-page::after {
  content: attr(data-page-num);
  position: absolute;
  bottom: 10mm;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9pt;
  color: #999;
  font-family: 'Latin Modern', Georgia, serif;
}

/* ── CANVAS mode: single infinite scroll, no page cards ─────────────────── */
.htex-document[data-render-mode="canvas"] {
  background: ${bg};
  color: ${fg};
  max-width: 160mm;     /* LaTeX article textwidth: 210mm - 2×25mm          */
  margin: 0 auto;
  padding: 25mm 0;
}
/* canvas source div is the only visible child */
.htex-document[data-render-mode="canvas"] .htex-canvas {
  display: block;
}
.htex-document[data-render-mode="canvas"] .htex-pages {
  display: none;
}

/* == Paragraphs: usepackage{parskip} mode == */
/* parskip: NO indent, ADD vertical space between paragraphs (~0.5 baselineskip) */
.htex-document p {
  margin: 0 0 6.6pt 0;      /* parskip approx 0.5 x baselineskip = 0.5x13.2pt */
  text-indent: 0;            /* parskip removes indentation                  */
  text-align: justify;
  hyphens: auto;
}

/* == Section headings == */
/* titleformat{section}{large bfseries color{bqdark}}{}{0em}{}[titlerule]
   At 11pt base: large=12pt
   [titlerule] = horizontal rule below section title                       */
.htex-document h1,
.htex-document h2,
.htex-document h3 {
  font-family: 'Latin Modern', 'STIX Two Text', Georgia, serif;
  font-weight: bold;
  color: ${fg};
  border: none;
  text-align: left;
  page-break-after: avoid;
}
/* section = large bfseries + titlerule underline */
.htex-document h1 {
  font-size: 12pt;             /* large at 11pt base                        */
  margin-top: 3.5ex;
  margin-bottom: 0;            /* rule sits right under the text             */
  padding-bottom: 2pt;
  line-height: 1.15;
  border-bottom: 0.4pt solid ${ruleColor};
}
/* subsection = normalsize bfseries (no titlerule) */
.htex-document h2 {
  font-size: 11pt;             /* normalsize at 11pt base                   */
  margin-top: 3.25ex;
  margin-bottom: 1.5ex;
  line-height: 1.15;
}
/* subsubsection = normalsize bfseries */
.htex-document h3 {
  font-size: 11pt;
  margin-top: 3.25ex;
  margin-bottom: 1.5ex;
}

/* Section number spacing */
.htex-section-num {
  margin-right: 0.4em;
}
.htex-section-num::after {
  content: '';
}

/* == Title page (begin{titlepage} ... end{titlepage}) == */
/* The titlepage uses centering: all content centered, block-level       */
.htex-titlepage {
  text-align: center;
  margin-bottom: 2em;
  border: none;
  background: none;
  padding: 2em 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
/* Ensure styledText spans/divs inside titlepage are centered block elements */
.htex-titlepage .htex-styled,
.htex-titlepage p {
  text-indent: 0;
  text-align: center;
  width: 100%;
}
/* Large styled text in titlepage should be block-level */
.htex-titlepage div.htex-styled,
.htex-titlepage span.htex-styled {
  display: block;
  margin: 0.15em 0;
}
/* maketitle metadata fallback */
.htex-titlepage .htex-title {
  font-size: 17.28pt;          /* LARGE at 11pt base                        */
  font-weight: bold;
  line-height: 1.3;
  margin: 0 0 0.5em 0;
}
.htex-titlepage .htex-author {
  font-size: 12pt;             /* large at 11pt base                        */
  margin: 0.3em 0;
}
.htex-titlepage .htex-date {
  font-size: 12pt;
  margin: 0.3em 0 1em 0;
}

/* ── Math ────────────────────────────────────────────────────────────────── */
/* Inline math: size matches surrounding text */
.htex-math-inline {
  display: inline;
}
/* Display math: centered, with vertical spacing = \abovedisplayskip ≈ 1em */
.htex-display-math {
  display: block;
  text-align: center;
  margin: 1em 0;
  overflow-x: auto;
}
/* MathML sizing */
.htex-document math {
  font-size: 1em;
}
.htex-math-inline-err,
.htex-math-display-err {
  color: #cc0000;
  font-family: monospace;
  font-size: 0.9em;
}

/* ── Verbatim / code ─────────────────────────────────────────────────────── */
/* \texttt inline: Latin Modern Mono, \small = 9pt at 10pt base */
.htex-document code,
.htex-document .htex-tt {
  font-family: 'Latin Modern Mono', 'Courier New', Courier, monospace;
  font-size: 9pt;              /* \small at 10pt base                        */
  background: none;
  padding: 0;
}
/* lstlisting / verbatim block: \footnotesize ≈ 8pt */
.htex-document pre.htex-pre {
  font-family: 'Latin Modern Mono', 'Courier New', Courier, monospace;
  font-size: 8pt;
  line-height: 1.3;
  background: ${codeBg};
  border: none;
  border-left: 1.5pt solid ${ruleColor};
  padding: 0.5em 1em;
  margin: 1em 0;
  overflow-x: auto;
  white-space: pre;
  text-indent: 0;
  text-align: left;
  hyphens: none;
}
.htex-document pre.htex-pre code {
  background: none;
  padding: 0;
  font-size: inherit;
}

/* ── Lists ───────────────────────────────────────────────────────────────── */
/* \itemize: leftmargin=2.5em, itemsep=0pt, parsep=0pt, topsep=4pt */
.htex-document ul,
.htex-document ol {
  margin: 4pt 0;
  padding: 0 0 0 2.5em;
}
.htex-document ul { list-style-type: disc; }
.htex-document ol { list-style-type: decimal; }
.htex-document li {
  margin: 0;
  padding: 0;
  text-indent: 0;
}

/* ── Tables (booktabs style) ─────────────────────────────────────────────── */
/* No vertical lines. Horizontal rules only: thick-thin-thick (booktabs).   */
.htex-table-wrap {
  margin: 1em auto;
  overflow-x: auto;
  text-indent: 0;
}
.htex-document table {
  border-collapse: collapse;
  border-spacing: 0;
  width: auto;
  margin: 0 auto;
  font-size: inherit;
}
.htex-document th,
.htex-document td {
  padding: 2pt 8pt;
  text-align: left;
  border: none;
  vertical-align: baseline;
  white-space: nowrap;
}
.htex-document th { font-weight: bold; }

/* booktabs \toprule / \bottomrule = 0.08em solid */
.htex-document tr.htex-rule-top td,
.htex-document tr.htex-rule-top th,
.htex-document tr.htex-rule-top + tr td,
.htex-document tr.htex-rule-top + tr th {
  border-top: 0.08em solid ${ruleColor};
}
/* booktabs \midrule = 0.05em solid */
.htex-document tr.htex-rule-mid td,
.htex-document tr.htex-rule-mid th,
.htex-document tr.htex-rule-mid + tr td,
.htex-document tr.htex-rule-mid + tr th {
  border-top: 0.05em solid ${ruleColor};
}
/* booktabs \bottomrule = 0.08em solid */
.htex-document tr.htex-rule-bottom td,
.htex-document tr.htex-rule-bottom th {
  border-top: 0.08em solid ${ruleColor};
}
/* Plain \hline */
.htex-document tr.htex-rule-hline td,
.htex-document tr.htex-rule-hline th {
  border-top: 0.4pt solid ${ruleColor};
}
/* Hide the rule-row cells themselves */
.htex-document tr.htex-rule-top td,
.htex-document tr.htex-rule-mid td,
.htex-document tr.htex-rule-bottom td,
.htex-document tr.htex-rule-hline td {
  padding: 0;
  font-size: 0;
  line-height: 0;
  height: 0;
}

/* ── Custom environments (insight, correction, etc.) ─────────────────────── */
.htex-box {
  border-left: 3pt solid;
  padding: 0.4em 0.75em;
  margin: 0.5em 0;
  background: none;
  text-indent: 0;
}
/* mdframed uses a full rectangular border */
.htex-box--mdframed {
  border: 0.4pt solid;
  border-left: 0.4pt solid;
  padding: 0.5em 0.75em;
  margin: 1em auto;
  text-align: center;
  text-indent: 0;
}
/* Quote/quotation environment — LaTeX indents both sides by 2.5em */
.htex-box--quote,
.htex-box--quotation {
  border-left: none;
  margin: 0.5em 2.5em;
  padding: 0;
  font-size: 9.5pt;
}
/* Styled text blocks (font-size, alignment changes) */
/* Default: inline for small changes (color, small font tweaks) */
.htex-styled {
  display: inline;
}
/* Block-level for alignment or large font sizes */
.htex-styled[style*="text-align"],
.htex-styled[style*="font-size: 1"],
.htex-styled[style*="font-size: 2"] {
  display: block;
  margin: 0.2em 0;
}
/* TikZ diagram placeholder — styled block with source hint */
.htex-tikz {
  display: block;
  background: ${codeBg};
  border: 0.4pt dashed ${mutedFg};
  border-radius: 3pt;
  margin: 1em 0;
  padding: 0.5em 0.75em;
  font-size: 8pt;
  color: ${mutedFg};
  font-family: 'Latin Modern Mono', monospace;
  text-indent: 0;
  text-align: left;
  overflow: hidden;
}
.htex-tikz-label {
  font-weight: bold;
  font-style: italic;
  margin-bottom: 0.3em;
  display: block;
}
.htex-tikz-bar {
  display: block;
  height: 6pt;
  border-radius: 3pt;
  margin: 0.4em 0;
  min-width: 60%;
}

/* ── Hyperlinks ──────────────────────────────────────────────────────────── */
.htex-document a {
  color: ${linkColor};
  text-decoration: none;
}
.htex-document a:hover { text-decoration: underline; }

/* ── TOC ─────────────────────────────────────────────────────────────────── */
.htex-toc {
  margin: 1.5em 0;
  padding: 0;
  text-indent: 0;
}
.htex-toc p {
  font-weight: bold;
  text-indent: 0;
  text-align: center;
  margin-bottom: 0.5em;
}
.htex-toc ol { list-style: none; padding: 0; margin: 0; }
.htex-toc li { margin: 0.15em 0; }
.htex-toc a { color: ${fg}; text-decoration: none; }

/* ── Abstract ────────────────────────────────────────────────────────────── */
/* LaTeX \begin{abstract}: indented ~6em each side, italic title */
.htex-abstract {
  margin: 1.5em 4em;
  font-size: 9pt;
  text-indent: 0;
}
.htex-abstract .htex-abstract-title {
  text-align: center;
  font-weight: bold;
  margin-bottom: 0.5em;
}

/* ── Figures / captions ──────────────────────────────────────────────────── */
.htex-document figure {
  margin: 1.5em auto;
  text-align: center;
  text-indent: 0;
}
.htex-document figcaption {
  font-size: 9pt;
  margin-top: 0.3em;
  text-align: left;
  text-indent: 0;
}

/* ── Center ──────────────────────────────────────────────────────────────── */
.htex-center { text-align: center; }
.htex-center p { text-indent: 0; text-align: center; }

/* ── Horizontal rule ─────────────────────────────────────────────────────── */
.htex-document hr {
  border: none;
  border-top: 0.4pt solid ${ruleColor};
  margin: 1.5em 0;
}

/* ── TikZ / plot placeholder ─────────────────────────────────────────────── */
.htex-tikz {
  background: ${codeBg};
  border: 0.4pt dashed ${mutedFg};
  margin: 1em 0;
  padding: 0.5em 0.75em;
  font-size: 8pt;
  color: ${mutedFg};
  font-family: 'Latin Modern Mono', monospace;
  text-indent: 0;
}

/* ── Dark theme overrides ────────────────────────────────────────────────── */
${isDark ? `
.htex-document {
  background: #0D1117;
  color: #c9d1d9;
}
` : ''}
`.trim();
}
// ── KaTeX MathML styles — no external CSS needed ─────────────────────────
// KaTeX mathml output is self-contained. We just add display-block centering.
function katexCss() {
    return `
/* MathML display centering */
.htex-display-math { display: block; text-align: center; overflow-x: auto; margin: 1em 0; }
.htex-display-math .katex { display: block; }
.htex-math-inline .katex { display: inline; }
math { font-size: 1.1em; }
`.trim();
}
// ── Flat canvas renderer ──────────────────────────────────────────────────
// Renders all nodes into a single flat HTML string for the canvas.
// - \newpage / \clearpage 	 <div data-htex-break="hard"></div>
// - \begin{titlepage}    	 <div data-htex-break="titlepage" class="htex-titlepage">…</div>
// The browser-side paginator reads these sentinels to place forced page cuts.
function renderFlatCanvas(nodes, theme, diagUrl) {
    const parts = [];
    for (const node of nodes) {
        if (node.type === 'document') {
            parts.push(renderFlatCanvas(node.children, theme, diagUrl));
            continue;
        }
        if (node.type === 'pageBreak') {
            parts.push('<div data-htex-break="hard"></div>');
            continue;
        }
        if (node.type === 'titlePage') {
            // titlePage: render its content but tag it as a forced full-page break
            const inner = renderNode(node, theme, diagUrl);
            parts.push(`<div data-htex-break="titlepage">${inner}</div>`);
            continue;
        }
        parts.push(renderNode(node, theme, diagUrl));
    }
    return parts.join('\n');
}
export function renderToHtml(tree, options = {}) {
    const theme = options.theme ?? 'light';
    const renderMode = options.renderMode ?? 'paged';
    const diagramBaseUrl = options.diagramBaseUrl ?? '';
    const nodes = Array.from(tree);
    let colors = [];
    let docTitle = options.title ?? '';
    for (const n of nodes) {
        if (n.type === 'document') {
            colors = n.metadata.colors;
            if (n.metadata.title)
                docTitle = n.metadata.title;
        }
    }
    const css = buildCss(colors, theme);
    const canvasHtml = renderFlatCanvas(nodes, theme, diagramBaseUrl);
    // paged: hidden source canvas + empty pages container.
    // data-htex-unpaginated signals to htexPaginate() that layout is needed.
    // canvas: single flat scroll, no page cards needed.
    const body = renderMode === 'canvas'
        ? `<div class="htex-canvas">\n${canvasHtml}\n</div>`
        : `<div class="htex-canvas">\n${canvasHtml}\n</div>\n<div class="htex-pages"></div>`;
    const unpaginatedAttr = renderMode === 'paged' ? ' data-htex-unpaginated="true"' : '';
    const docAttrs = `class="htex-document" data-theme="${theme}" data-render-mode="${renderMode}"${unpaginatedAttr}`;
    // Non-standalone: fragment for framework injection (React, Svelte, Vue, etc.)
    // htexPaginate() is a named SDK export the app calls after mounting.
    // No <script> tag: frameworks like React intentionally ignore injected scripts.
    if (options.standalone === false) {
        return `<style class="htex-styles">\n${css}\n</style>\n<div ${docAttrs}>\n${body}\n</div>`;
    }
    // Standalone: full HTML document opened directly in a browser.
    // Inline the paginator as a <script> — the browser executes it on load.
    const inlineScript = renderMode === 'paged'
        ? `<script>(${HTEX_PAGINATE_IMPL.toString()})(document)</script>`
        : '';
    return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(docTitle || 'Document')}</title>
<style>
${katexCss()}
${css}
</style>
</head>
<body>
<div ${docAttrs}>
${body}
</div>
${inlineScript}
</body>
</html>`;
}
// =============================================================================
// htexPaginate — SDK-level DOM pagination
// =============================================================================
//
// DESIGN: The core function (HTEX_PAGINATE_IMPL) is a plain JS function that:
//   - Takes a root Element/Document and finds all unpaginated htex documents
//   - Measures block heights using a hidden sandbox at exact A4 text-column width
//   - Greedily packs blocks into A4-height page cards
//   - Is exported as htexPaginate() for framework callers
//   - Is serialised via .toString() for standalone HTML inline scripts
//
// Page geometry (LaTeX article, A4, 25mm margins all sides):
//   Page:        210mm x 297mm
//   Text area:   160mm x 247mm
//
// USAGE (framework apps):
//   import { htexPaginate } from '@htex/core'
//
//   // React
//   useEffect(() => { htexPaginate(ref.current) }, [rendered])
//
//   // Svelte
//   afterUpdate(() => htexPaginate(el))
//
//   // Vue
//   nextTick(() => htexPaginate(el.value))
//
//   // Vanilla
//   div.innerHTML = latexToHtml(src, { renderMode: 'paged' })
//   htexPaginate(div)
function HTEX_PAGINATE_IMPL(root) {
    function mmToPx(mm) {
        const probe = document.createElement('div');
        probe.style.cssText = `position:absolute;top:-99999px;left:-99999px;width:${mm}mm;height:0;visibility:hidden`;
        document.body.appendChild(probe);
        const px = probe.getBoundingClientRect().width;
        document.body.removeChild(probe);
        return px;
    }
    // A4 text area: 297mm - 25mm top - 25mm bottom = 247mm.
    // We use 240mm (7mm safety buffer) to absorb:
    //   - CSS margin-collapse differences between sandbox and real page layout
    //   - Sub-pixel rounding in getBoundingClientRect()
    //   - Web-font load timing causing slightly different metrics
    const TEXT_H_MM = 240;
    const TEXT_W_MM = 160;
    const queryRoot = root || document;
    const targets = Array.from(queryRoot.querySelectorAll('.htex-document[data-htex-unpaginated]'));
    for (const docEl of targets) {
        const canvas = docEl.querySelector('.htex-canvas');
        const pagesEl = docEl.querySelector('.htex-pages');
        if (!canvas || !pagesEl)
            continue;
        const pageH = mmToPx(TEXT_H_MM);
        const textW = mmToPx(TEXT_W_MM);
        // ── Off-screen measurement sandbox ──────────────────────────────────
        // Key design: we measure the ACCUMULATED PAGE height (all blocks together)
        // rather than summing individual heights. This correctly accounts for CSS
        // margin-collapse — adjacent blocks collapse margins, so summing individual
        // heights overcounts and breaks pages too early.
        const sandbox = document.createElement('div');
        sandbox.setAttribute('aria-hidden', 'true');
        sandbox.className = 'htex-document';
        sandbox.style.cssText = [
            'position:absolute',
            'top:-99999px',
            'left:-99999px',
            `width:${textW}px`,
            'visibility:hidden',
            'overflow:visible',
            'pointer-events:none',
        ].join(';');
        document.body.appendChild(sandbox);
        // pageBox: a wrapper inside sandbox that holds clones of the current page.
        // Measuring pageBox.getBoundingClientRect().height gives the true collapsed height.
        let pageBox = document.createElement('div');
        sandbox.appendChild(pageBox);
        const children = Array.from(canvas.children);
        const pages = [];
        let current = [];
        function pageBoxH() {
            return pageBox.getBoundingClientRect().height;
        }
        function flushPage() {
            if (current.length > 0) {
                pages.push(current);
                current = [];
                pageBox.innerHTML = '';
            }
        }
        // Check if an element is a widow (should not be alone at the bottom of a page)
        // Widows include: headings, images/figures, and list items
        function isWidow(el) {
            const tag = el.tagName?.toLowerCase() ?? '';
            const isHead = tag === 'h1' || tag === 'h2' || tag === 'h3' ||
                (tag === 'section' && !!el.querySelector(':scope > h1,:scope > h2,:scope > h3'));
            const hasImg = !!el.querySelector(':scope > img, :scope > figure');
            const isImg = tag === 'img' || tag === 'figure' || hasImg;
            return isHead || isImg;
        }
        // Would adding `el` to the current page push it over the limit?
        function wouldOverflow(el) {
            const clone = el.cloneNode(true);
            pageBox.appendChild(clone);
            const over = pageBoxH() > pageH;
            pageBox.removeChild(clone);
            return over;
        }
        for (const child of children) {
            const breakType = child.getAttribute('data-htex-break');
            if (breakType === 'hard') {
                flushPage();
                continue;
            }
            if (breakType === 'titlepage') {
                flushPage();
                pages.push([child]);
                current = [];
                pageBox.innerHTML = '';
                continue;
            }
            if (wouldOverflow(child)) {
                if (current.length === 0) {
                    // Block taller than a full page — accept it alone, never skip content
                    pageBox.appendChild(child.cloneNode(true));
                    current.push(child);
                    flushPage();
                }
                else {
                    // Widow detection: if the last item on this page is a widow element,
                    // move it to the next page so it stays with the content after it
                    const last = current[current.length - 1];
                    if (current.length > 1 && isWidow(last)) {
                        const orphan = current.pop();
                        // Remove orphan clone from pageBox
                        const kids = Array.from(pageBox.children);
                        if (kids.length > 0)
                            pageBox.removeChild(kids[kids.length - 1]);
                        flushPage();
                        pageBox.appendChild(orphan.cloneNode(true));
                        current.push(orphan);
                    }
                    else {
                        flushPage();
                    }
                    pageBox.appendChild(child.cloneNode(true));
                    current.push(child);
                }
            }
            else {
                pageBox.appendChild(child.cloneNode(true));
                current.push(child);
            }
        }
        flushPage();
        document.body.removeChild(sandbox);
        // ── Build page cards ─────────────────────────────────────────────────
        // Filter out empty pages (should not occur but safety check)
        const nonEmptyPages = pages.filter(p => p.length > 0);
        pagesEl.innerHTML = '';
        nonEmptyPages.forEach((bucket, idx) => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'htex-page';
            pageDiv.setAttribute('data-page-num', String(idx + 1));
            bucket.forEach(node => pageDiv.appendChild(node.cloneNode(true)));
            pagesEl.appendChild(pageDiv);
        });
        canvas.style.display = 'none';
        pagesEl.style.display = '';
        docEl.removeAttribute('data-htex-unpaginated');
    }
}
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
export function htexPaginate(root = document) {
    HTEX_PAGINATE_IMPL(root);
}
// ── Node renderer dispatch ────────────────────────────────────────────────
function renderNode(node, theme, diagUrl = '') {
    switch (node.type) {
        case 'document': return renderDocument(node, theme, diagUrl);
        case 'section': return renderSection(node, theme, diagUrl);
        case 'paragraph': return renderParagraph(node, theme, diagUrl);
        case 'text': return escWithDashes(node.content);
        case 'inlineCode': return `<code class="htex-tt">${esc(node.content)}</code>`;
        case 'bold': return `<strong>${renderChildren(node.children, theme, diagUrl)}</strong>`;
        case 'italic': return `<em>${renderChildren(node.children, theme, diagUrl)}</em>`;
        case 'underline': return `<span style="text-decoration:underline">${renderChildren(node.children, theme, diagUrl)}</span>`;
        case 'color': return `<span style="color:${esc(node.color)}">${renderChildren(node.children, theme, diagUrl)}</span>`;
        case 'mathInline': return `<span class="htex-math-inline">${renderMathKatex(node.latex, false)}</span>`;
        case 'mathDisplay': return `<div class="htex-display-math">${renderMathKatex(node.latex, true)}</div>`;
        case 'codeBlock': return renderCodeBlock(node);
        case 'table': return renderTable(node, theme, diagUrl);
        case 'tableRow': return `<tr>${renderChildren(node.children, theme, diagUrl)}</tr>`;
        case 'tableCell': return renderTableCell(node, theme, diagUrl);
        case 'tableRule': return renderTableRule(node);
        case 'figure': return `<figure>${renderChildren(node.children, theme, diagUrl)}</figure>`;
        case 'image': return `<img src="${esc(node.src)}" alt="${esc(node.alt ?? node.src)}"${node.width ? ` style="max-width:${esc(node.width)}"` : ''} loading="lazy">`;
        case 'caption': return `<figcaption>${renderChildren(node.children, theme, diagUrl)}</figcaption>`;
        case 'list': return renderList(node, theme, diagUrl);
        case 'listItem': return `<li>${renderListItemChildren(node.children, theme, diagUrl)}</li>`;
        case 'customBox': return renderCustomBox(node, theme, diagUrl);
        case 'link': return `<a href="${esc(node.href)}">${renderChildren(node.children, theme, diagUrl)}</a>`;
        case 'reference': return `<a href="#${esc(node.targetId)}" class="htex-ref">${esc(node.resolvedText)}</a>`;
        case 'toc': return renderToc(node, theme);
        case 'titlePage': return renderTitlePage(node, theme, diagUrl);
        case 'center': return `<div class="htex-center">${renderChildren(node.children, theme, diagUrl)}</div>`;
        case 'abstract': return renderAbstract(node, theme, diagUrl);
        case 'tikz': return renderTikz(node, theme, diagUrl);
        case 'plot': return renderTikz(node, theme, diagUrl);
        case 'hRule': return `<hr>`;
        case 'pageBreak': return `<!-- page break -->`;
        case 'styledText': return renderStyledText(node, theme, diagUrl);
        default: return '';
    }
}
// ── Styled text ({\Huge\bfseries ...}, \color{red} ..., etc.) ─────────────
function renderStyledText(node, theme, diagUrl = '') {
    const styles = [];
    if (node.fontSize)
        styles.push(`font-size:${node.fontSize}`);
    if (node.fontWeight)
        styles.push(`font-weight:${node.fontWeight}`);
    if (node.fontStyle)
        styles.push(`font-style:${node.fontStyle}`);
    if (node.fontVariant)
        styles.push(`font-variant:${node.fontVariant}`);
    if (node.fontFamily)
        styles.push(`font-family:${node.fontFamily}`);
    if (node.color)
        styles.push(`color:${node.color}`);
    if (node.textAlign)
        styles.push(`text-align:${node.textAlign}`);
    const styleAttr = styles.length ? ` style="${styles.join(';')}"` : '';
    const isBlock = node.textAlign != null ||
        (node.fontSize != null && parseFloat(node.fontSize) >= 12);
    const tag = isBlock ? 'div' : 'span';
    return `<${tag} class="htex-styled"${styleAttr}>${renderChildren(node.children, theme, diagUrl)}</${tag}>`;
}
// ── Title page (\maketitle or \begin{titlepage}) ──────────────────────────
function renderTitlePage(node, theme, diagUrl = '') {
    // If the titlepage has real body content (from \begin{titlepage}...\end{titlepage})
    // render that directly — it already contains styled groups, tikz, boxes etc.
    if (node.children && node.children.length > 0) {
        const inner = renderChildren(node.children, theme, diagUrl);
        return `<div class="htex-titlepage">\n${inner}\n</div>\n`;
    }
    // Fallback: \maketitle with metadata only
    const m = node.metadata ?? {};
    let html = `<div class="htex-titlepage">\n`;
    if (m.title)
        html += `<div class="htex-title">${escWithDashes(m.title)}</div>\n`;
    if (m.author)
        html += `<div class="htex-author">${escWithDashes(m.author)}</div>\n`;
    if (m.date)
        html += `<div class="htex-date">${escWithDashes(m.date)}</div>\n`;
    html += `</div>\n`;
    return html;
}
// ── Document node ─────────────────────────────────────────────────────────
function renderDocument(node, theme, diagUrl = '') {
    return renderChildren(node.children, theme, diagUrl);
}
// ── Sections ─────────────────────────────────────────────────────────────
function renderSection(node, theme, diagUrl = '') {
    const tag = `h${node.level}`;
    const numHtml = node.number ? `<span class="htex-section-num">${esc(node.number)}</span>&ensp;` : '';
    const titleHtml = renderChildren(node.title, theme, diagUrl);
    const childrenHtml = renderChildren(node.children, theme, diagUrl);
    return `<section id="${esc(node.id)}">\n<${tag}>${numHtml}${titleHtml}</${tag}>\n${childrenHtml}</section>\n`;
}
// ── Paragraphs ────────────────────────────────────────────────────────────
function renderParagraph(node, theme, diagUrl = '') {
    const inner = renderChildren(node.children, theme, diagUrl);
    if (!inner.trim())
        return '';
    return `<p>${inner}</p>`;
}
// ── Code blocks ──────────────────────────────────────────────────────────
function renderCodeBlock(node) {
    const langClass = node.language ? ` class="language-${esc(node.language)}"` : '';
    const cap = node.caption ? `<figcaption class="htex-code-caption">${esc(node.caption)}</figcaption>` : '';
    return `<pre class="htex-pre"><code${langClass}>${esc(node.code)}</code></pre>${cap}`;
}
// ── Tables ────────────────────────────────────────────────────────────────
function renderTable(node, theme, diagUrl = '') {
    const caption = node.caption
        ? `<caption style="caption-side:top;text-align:left;padding-bottom:4pt">${renderChildren(node.caption, theme, diagUrl)}</caption>`
        : '';
    const rows = node.children.map(r => renderNode(r, theme)).join('\n');
    return `<div class="htex-table-wrap"><table>${caption}<tbody>\n${rows}\n</tbody></table></div>`;
}
function renderTableCell(node, theme, diagUrl = '') {
    const attrs = [];
    if (node.colspan > 1)
        attrs.push(`colspan="${node.colspan}"`);
    if (node.rowspan > 1)
        attrs.push(`rowspan="${node.rowspan}"`);
    if (node.align !== 'left')
        attrs.push(`style="text-align:${node.align}"`);
    const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
    return `<td${attrStr}>${renderChildren(node.children, theme, diagUrl)}</td>`;
}
function renderTableRule(node) {
    return `<tr class="htex-rule-${esc(node.ruleKind)}"><td colspan="100" style="padding:0;border:none"></td></tr>`;
}
// ── Lists ─────────────────────────────────────────────────────────────────
function renderList(node, theme, diagUrl = '') {
    const tag = node.ordered ? 'ol' : 'ul';
    return `<${tag}>${renderChildren(node.children, theme, diagUrl)}</${tag}>`;
}
function renderListItemChildren(children, theme, diagUrl = '') {
    // Unwrap single paragraph inside list item to avoid double-indent
    if (children.length === 1 && children[0]?.type === 'paragraph') {
        return renderChildren(children[0].children, theme);
    }
    return renderChildren(children, theme, diagUrl);
}
// ── Custom boxes ──────────────────────────────────────────────────────────
function renderCustomBox(node, theme, diagUrl = '') {
    // mdframed uses a full rectangular border; others use left-bar style
    const isMdframed = node.label === 'mdframed';
    let style;
    if (isMdframed) {
        style = `border-color:${node.borderColor}`;
    }
    else {
        style = `border-left-color:${node.borderColor}`;
    }
    if (node.bgColor && node.bgColor !== 'transparent') {
        style += `;background-color:${node.bgColor}`;
    }
    return `<div class="htex-box htex-box--${esc(node.label)}" style="${style}">${renderChildren(node.children, theme, diagUrl)}</div>`;
}
// ── Abstract ─────────────────────────────────────────────────────────────
function renderAbstract(node, theme, diagUrl = '') {
    return `<div class="htex-abstract"><div class="htex-abstract-title">Abstract</div>${renderChildren(node.children, theme, diagUrl)}</div>`;
}
// ── TOC ───────────────────────────────────────────────────────────────────
function renderToc(node, _theme) {
    if (node.entries.length === 0)
        return '';
    const items = node.entries.map(e => {
        const indent = e.level > 1 ? ` style="margin-left:${(e.level - 1) * 1.5}em"` : '';
        return `<li${indent}><a href="#${esc(e.id)}">${esc(e.number)}&nbsp;&nbsp;${esc(e.title)}</a></li>`;
    }).join('\n');
    return `<nav class="htex-toc" aria-label="Table of contents"><p>Contents</p><ol>\n${items}\n</ol></nav>`;
}
// ── TikZ renderer — pre-rendered SVG asset or smart placeholder ──────────
function renderTikz(node, _theme, diagUrl = '') {
    const src = node.rawSource;
    const idx = node.diagramIndex;
    // If a pre-rendered SVG asset base URL is configured and we have an index,
    // render as an <img> pointing at the pre-rendered file.
    if (diagUrl && idx != null) {
        const padded = String(idx).padStart(2, '0');
        const svgSrc = `${diagUrl}/tikz-${padded}.svg`;
        return `<div class="htex-diagram" style="text-align:center;margin:1em 0">` +
            `<img src="${esc(svgSrc)}" alt="Diagram ${idx}" ` +
            `style="max-width:100%;height:auto;display:block;margin:0 auto" loading="lazy">` +
            `</div>`;
    }
    // Detect simple \fill[color, rounded corners=Xpt] (0,0) rectangle (W,H)
    // This handles the titlepage decorative green bar
    const fillMatch = src.match(/\\fill\[([^\]]+)\]\s*\(([^)]+)\)\s*rectangle\s*\(([^)]+)\)/);
    if (fillMatch) {
        const opts = fillMatch[1];
        const p1 = fillMatch[2].split(',').map(Number);
        const p2 = fillMatch[3].split(',').map(Number);
        const w = Math.abs((p2[0] ?? 0) - (p1[0] ?? 0));
        const h = Math.abs((p2[1] ?? 0) - (p1[1] ?? 0));
        const colorName = opts.split(',')[0].trim();
        const fillColor = colorName.startsWith('bq')
            ? `var(--htex-color-${colorName}, #3ECF8E)`
            : colorName === 'black' ? '#000' : colorName === 'white' ? '#fff' : colorName;
        const roundedMatch = opts.match(/rounded corners=([0-9.]+)pt/);
        const rx = roundedMatch ? parseFloat(roundedMatch[1]) : 0;
        const scale = 28;
        const svgW = Math.max(w * scale, 20);
        const svgH = Math.max(h * scale, 8);
        const rxPx = rx * (scale / 10);
        return `<div class="htex-tikz-figure" style="text-align:center;margin:0.5em 0">` +
            `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" ` +
            `viewBox="0 0 ${svgW} ${svgH}" style="display:block;max-width:100%">` +
            `<rect x="0" y="0" width="${svgW}" height="${svgH}" ` +
            `fill="${esc(fillColor)}" rx="${rxPx}" ry="${rxPx}"/>` +
            `</svg></div>`;
    }
    // Complex TikZ without pre-rendered asset — show styled placeholder
    const isPgfplots = src.includes('\\begin{axis}') || src.includes('\\addplot');
    const label = isPgfplots ? 'pgfplots diagram' : 'TikZ diagram';
    const nodeMatch = src.match(/\\node[^;]*\{([^}]{1,40})\}/);
    const desc = nodeMatch ? nodeMatch[1].trim() : '';
    return `<div class="htex-tikz" role="img" aria-label="${esc(label)}">` +
        `<span class="htex-tikz-label">[${label}${idx ? ` ${idx}` : ''}]</span>` +
        (desc ? `<span style="display:block;margin-top:0.2em;font-size:0.85em;opacity:0.7">${esc(desc)}...</span>` : '') +
        `</div>`;
}
// ── Children ──────────────────────────────────────────────────────────────
function renderChildren(children, theme, diagUrl = '') {
    return children.map(c => renderNode(c, theme, diagUrl)).join('');
}
//# sourceMappingURL=html.js.map