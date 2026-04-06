<script lang="ts">
  import { latexToHtml, latexToSvg, htexPaginate } from '@htex/core'
  import EXAMPLE from './example.tex?raw'

  // ── State ─────────────────────────────────────────────────────────────────
  let source      = $state(EXAMPLE)
  let format      = $state<'html' | 'svg'>('html')
  let theme       = $state<'light' | 'dark'>('light')
  let renderMode  = $state<'paged' | 'canvas'>('paged')
  let isDragging  = $state(false)
  let fileName    = $state('')
  let copied      = $state(false)
  let previewEl   = $state<HTMLElement | null>(null)

  // ── Derived: pure render, no side effects ─────────────────────────────────
  let _r = $derived.by(() => {
    if (!source.trim()) return { out: '', ms: 0, err: '' }
    const t0 = performance.now()
    try {
      const out = format === 'svg'
        ? latexToSvg(source, { theme, standalone: false })
        : latexToHtml(source, { theme, standalone: false, diagramBaseUrl: '/diagrams', renderMode })
      return { out, ms: Math.round(performance.now() - t0), err: '' }
    } catch (e: unknown) {
      return { out: '', ms: 0, err: e instanceof Error ? e.message : String(e) }
    }
  })
  let rendered   = $derived(_r.out)
  let renderTime = $derived(_r.ms)
  let errorMsg   = $derived(_r.err)
  // ── Paginate after DOM updates in paged mode ───────────────────────────────
  $effect(() => {
    const _ = rendered  // track dependency
    if (format === 'html' && renderMode === 'paged' && previewEl) {
      htexPaginate(previewEl)
    }
  })

  // ── File handling ──────────────────────────────────────────────────────────
  function onDragOver(e: DragEvent) { e.preventDefault(); isDragging = true }
  function onDragLeave(e: DragEvent) {
    if (!(e.currentTarget as Element)?.contains(e.relatedTarget as Node)) isDragging = false
  }
  async function onDrop(e: DragEvent) {
    e.preventDefault(); isDragging = false
    const file = e.dataTransfer?.files?.[0]; if (!file) return
    fileName = file.name; source = await file.text()
  }
  async function onFileInput(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
    fileName = file.name; source = await file.text()
  }
  function download() {
    if (!rendered) return
    const ext  = format === 'svg' ? 'svg' : 'html'
    const mime = format === 'svg' ? 'image/svg+xml' : 'text/html'
    const full = format === 'html'
      ? latexToHtml(source, { theme, standalone: true, diagramBaseUrl: '/diagrams', renderMode })
      : latexToSvg(source, { theme, standalone: true })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([full], { type: mime })),
      download: (fileName.replace(/\.[^.]+$/, '') || 'document') + '.' + ext,
    })
    a.click(); URL.revokeObjectURL(a.href)
  }
  async function copyOutput() {
    if (!rendered) return
    await navigator.clipboard.writeText(rendered)
    copied = true; setTimeout(() => { copied = false }, 1500)
  }
</script>

<style>
  /* ── App chrome ────────────────────────────────────────────────────────── */
  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: #0f1117;
    color: #e2e8f0;
    height: 100vh;
    overflow: hidden;
  }

  .shell {
    display: grid;
    grid-template-rows: 48px 1fr;
    height: 100vh;
    overflow: hidden;
  }

  /* ── Header ── */
  header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 1rem;
    background: #0d1117;
    border-bottom: 1px solid #21262d;
    overflow: hidden;
    flex-shrink: 0;
  }
  .logo {
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: #f0f6fc;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .logo em { font-style: normal; font-weight: 400; color: #8b949e; font-size: 0.9em; }
  .badge {
    font-size: 0.6rem;
    font-weight: 700;
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    background: #1f3a5f;
    color: #58a6ff;
    flex-shrink: 0;
  }
  .stat { font-size: 0.7rem; color: #6e7681; white-space: nowrap; }
  .spacer { flex: 1; }
  .controls { display: flex; gap: 0.4rem; align-items: center; flex-shrink: 0; }

  .pill {
    display: flex;
    background: #161b22;
    border-radius: 5px;
    padding: 2px;
    border: 1px solid #30363d;
    gap: 1px;
  }
  .pill button {
    padding: 0.15rem 0.55rem;
    border: none; border-radius: 3px;
    font-size: 0.7rem; font-weight: 600;
    cursor: pointer;
    background: transparent; color: #8b949e;
    transition: all 0.1s; white-space: nowrap;
  }
  .pill button.on        { background: #238636; color: #fff; }
  .pill button.on.format { background: #1f6feb; }

  .btn {
    padding: 0.2rem 0.65rem; border-radius: 5px;
    border: 1px solid #30363d; background: #21262d; color: #c9d1d9;
    font-size: 0.7rem; font-weight: 600; cursor: pointer;
    white-space: nowrap; transition: border-color 0.1s, background 0.1s;
  }
  .btn:hover:not(:disabled) { border-color: #58a6ff; background: #1c2128; }
  .btn:disabled { opacity: 0.35; cursor: default; }
  .btn.accent { background: #1f6feb; border-color: #1f6feb; color: #fff; }
  .btn.accent:hover:not(:disabled) { background: #388bfd; }

  /* ── Workspace ── */
  .workspace {
    display: grid;
    grid-template-columns: 1fr 1fr;
    overflow: hidden;
    min-height: 0;
  }

  /* ── Left: editor ── */
  .pane {
    display: flex; flex-direction: column;
    overflow: hidden; border-right: 1px solid #21262d; min-height: 0;
  }
  .pane-bar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 0.75rem; height: 32px;
    background: #0d1117; border-bottom: 1px solid #21262d;
    font-size: 0.65rem; font-weight: 700; color: #6e7681;
    text-transform: uppercase; letter-spacing: 0.08em; flex-shrink: 0;
  }
  .file-chip {
    background: #1f3a5f; color: #79c0ff;
    padding: 0.08rem 0.35rem; border-radius: 3px;
    font-size: 0.62rem; font-weight: 600;
    text-transform: none; letter-spacing: 0;
  }
  .drop-hint {
    padding: 0 0.75rem; height: 28px;
    display: flex; align-items: center; gap: 0.5rem;
    background: #0d1117; border-bottom: 1px solid #21262d;
    font-size: 0.68rem; color: #6e7681; flex-shrink: 0;
  }
  .drop-hint code { font-family: monospace; color: #8b949e; }
  .drop-hint label { color: #58a6ff; cursor: pointer; font-weight: 600; }
  .drop-hint label:hover { text-decoration: underline; }

  .editor-wrap {
    position: relative; flex: 1; overflow: hidden; min-height: 0;
  }
  .drag-overlay {
    position: absolute; inset: 0;
    background: rgba(31,111,235,0.12); border: 2px dashed #1f6feb;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; font-weight: 700; color: #58a6ff;
    z-index: 10; pointer-events: none;
  }
  textarea {
    width: 100%; height: 100%;
    background: #0d1117; border: none; outline: none; resize: none;
    padding: 0.75rem 1rem;
    font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 0.78rem; line-height: 1.6; color: #c9d1d9; tab-size: 2;
  }
  textarea::placeholder { color: #30363d; }

  /* ── Right: preview — PDF viewer aesthetic ── */
  .preview-pane {
    display: flex; flex-direction: column;
    overflow: hidden; min-height: 0;
    background: #404040;
  }
  /* Canvas mode: white background to match document */
  .preview-pane.canvas-mode { background: #ffffff; }

  .preview-scroll {
    flex: 1; overflow: auto; min-height: 0;
    /* The engine's .htex-document handles all layout and padding */
  }
  /* Engine output fills the scroll area */
  .preview-scroll :global(.htex-document) {
    min-height: 100%;
    width: 100%;
  }
  /* SVG output: centre on grey canvas */
  .svg-canvas {
    padding: 2rem;
    background: #404040;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .svg-canvas :global(svg) {
    max-width: 760px;
    width: 100%;
    height: auto;
    background: #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.15), 0 4px 20px rgba(0,0,0,0.4);
  }

  /* Error */
  .error-box {
    background: rgba(248,81,73,0.1); border: 1px solid rgba(248,81,73,0.3);
    border-radius: 6px; padding: 1rem; color: #ff7b72;
    font-family: monospace; font-size: 0.8rem; white-space: pre-wrap; line-height: 1.5;
    margin: 2rem auto; max-width: 760px;
  }
  .empty {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100%; min-height: 300px; gap: 0.5rem; color: #888;
  }
  .empty-icon { font-size: 2rem; }
  .empty-text { font-size: 0.8rem; }
</style>

<div class="shell">
  <!-- ── Header ── -->
  <header>
    <div class="logo">htex <em>/ svelte</em></div>
    <span class="badge">Svelte 5 · Runes</span>
    {#if source.trim()}
      <span class="stat">{renderTime}ms · {source.length.toLocaleString()} chars</span>
    {/if}
    <div class="spacer"></div>
    <div class="controls">
      <div class="pill">
        <button class="format" class:on={format === 'html'} onclick={() => format = 'html'}>HTML</button>
        <button class="format" class:on={format === 'svg'}  onclick={() => format = 'svg'}>SVG</button>
      </div>
      {#if format === 'html'}
      <div class="pill">
        <button class:on={renderMode === 'canvas'} onclick={() => renderMode = 'canvas'}>⬜ Canvas</button>
        <button class:on={renderMode === 'paged'}  onclick={() => renderMode = 'paged'}>📄 Pages</button>
      </div>
      {/if}
      <div class="pill">
        <button class:on={theme === 'light'} onclick={() => theme = 'light'}>☀ Light</button>
        <button class:on={theme === 'dark'}  onclick={() => theme = 'dark'}>🌙 Dark</button>
      </div>
      <button class="btn" onclick={copyOutput} disabled={!rendered}>
        {copied ? '✓ Copied' : '⎘ Copy'}
      </button>
      <button class="btn accent" onclick={download} disabled={!rendered}>
        ↓ {format.toUpperCase()}
      </button>
    </div>
  </header>

  <!-- ── Workspace ── -->
  <div class="workspace">

    <!-- Left: LaTeX source editor -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="pane" role="region" aria-label="LaTeX source editor"
      ondragover={onDragOver} ondragleave={onDragLeave} ondrop={onDrop}>
      <div class="pane-bar">
        LaTeX Source
        {#if fileName}<span class="file-chip">📄 {fileName}</span>{/if}
      </div>
      <div class="drop-hint">
        📂 Drop a <code>.tex</code> file here, or
        <label>browse<input type="file" accept=".tex,.txt" style="display:none" onchange={onFileInput}/></label>
        to open
      </div>
      <div class="editor-wrap">
        {#if isDragging}
          <div class="drag-overlay">📄 Drop .tex file here</div>
        {/if}
        <textarea
          bind:value={source}
          placeholder="Paste or type LaTeX here…"
          spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
        ></textarea>
      </div>
    </div>

    <!-- Right: paged/canvas preview — engine manages layout -->
    <div class="preview-pane" class:canvas-mode={renderMode === 'canvas' && format === 'html'}>
      <div class="pane-bar">
        Preview — {format === 'html' ? (renderMode === 'paged' ? 'PAGES' : 'CANVAS') : 'SVG'}
        {#if fileName}<span class="file-chip">{fileName}</span>{/if}
      </div>
      <div class="preview-scroll" bind:this={previewEl}>
        {#if errorMsg}
          <div class="error-box">⚠ Render error:

{errorMsg}</div>
        {:else if rendered}
          {#if format === 'svg'}
            <!-- SVG: centre on grey canvas -->
            <div class="svg-canvas">{@html rendered}</div>
          {:else}
            <!-- HTML: engine wraps pages in .htex-document 	 .htex-page -->
            {@html rendered}
          {/if}
        {:else}
          <div class="empty">
            <div class="empty-icon">📄</div>
            <div class="empty-text">Rendered document appears here</div>
          </div>
        {/if}
      </div>
    </div>

  </div>
</div>