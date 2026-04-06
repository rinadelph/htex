import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { latexToHtml, latexToSvg, htexPaginate } from '@htex/core'
import EXAMPLE from './example.tex?raw'

type Format     = 'html' | 'svg'
type Theme      = 'light' | 'dark'
type RenderMode = 'paged' | 'canvas'

// ── Pill (segmented control) ──────────────────────────────────────────────
function Pill<T extends string>({ options, value, onChange, accent = '#238636' }: {
  options: { label: string; value: T }[]
  value: T; onChange: (v: T) => void; accent?: string
}) {
  return (
    <div style={{ display:'flex', background:'#161b22', borderRadius:5,
      padding:2, border:'1px solid #30363d', gap:1 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding:'0.15rem 0.55rem', border:'none', borderRadius:3,
          fontSize:'0.7rem', fontWeight:600, cursor:'pointer',
          background: value === o.value ? accent : 'transparent',
          color: value === o.value ? '#fff' : '#8b949e',
          transition:'all 0.1s', whiteSpace:'nowrap',
        }}>{o.label}</button>
      ))}
    </div>
  )
}

export default function App() {
  const [source,     setSource]     = useState<string>(EXAMPLE)
  const [format,     setFormat]     = useState<Format>('html')
  const [theme,      setTheme]      = useState<Theme>('light')
  const [renderMode, setRenderMode] = useState<RenderMode>('paged')
  const [fileName,   setFileName]   = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [copied,     setCopied]     = useState(false)
  const [renderTime, setRenderTime] = useState(0)
  const [zoom,       setZoom]       = useState(() => {
    const stored = localStorage.getItem('htex-zoom')
    return stored ? parseInt(stored) : 100
  })
  const previewRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const { rendered, error } = useMemo(() => {
    if (!source.trim()) return { rendered: '', error: '' }
    const t0 = performance.now()
    try {
      const out = format === 'svg'
        ? latexToSvg(source, { theme, standalone: false })
        : latexToHtml(source, { theme, standalone: false,
            diagramBaseUrl: '/diagrams', renderMode })
      setRenderTime(Math.round(performance.now() - t0))
      return { rendered: out, error: '' }
    } catch (e) {
      return { rendered: '', error: e instanceof Error ? e.message : String(e) }
    }
  }, [source, format, theme, renderMode])

  // After HTML is injected into the DOM, call the SDK paginator.
  // htexPaginate() is idempotent — it only acts on [data-htex-unpaginated] elements.
  useEffect(() => {
    if (format === 'html' && renderMode === 'paged' && rendered && previewRef.current) {
      htexPaginate(previewRef.current)
    }
  }, [rendered, format, renderMode])

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault()
          setZoom(z => {
            const newZoom = Math.min(z + 10, 200)
            localStorage.setItem('htex-zoom', String(newZoom))
            return newZoom
          })
        } else if (e.key === '-') {
          e.preventDefault()
          setZoom(z => {
            const newZoom = Math.max(z - 10, 50)
            localStorage.setItem('htex-zoom', String(newZoom))
            return newZoom
          })
        } else if (e.key === '0') {
          e.preventDefault()
          setZoom(100)
          localStorage.setItem('htex-zoom', '100')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleZoom = useCallback((delta: number) => {
    setZoom(z => {
      const newZoom = Math.max(50, Math.min(200, z + delta))
      localStorage.setItem('htex-zoom', String(newZoom))
      return newZoom
    })
  }, [])

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false)
  }, [])
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer?.files?.[0]; if (!f) return
    setFileName(f.name); setSource(await f.text())
  }, [])
  const onFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setFileName(f.name); setSource(await f.text())
  }, [])
  const download = useCallback(() => {
    if (!rendered) return
    const ext  = format === 'svg' ? 'svg' : 'html'
    const mime = format === 'svg' ? 'image/svg+xml' : 'text/html'
    const full = format === 'html'
      ? latexToHtml(source, { theme, standalone: true,
          diagramBaseUrl: '/diagrams', renderMode })
      : latexToSvg(source, { theme, standalone: true })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([full], { type: mime }))
    a.download = (fileName.replace(/\.[^.]+$/, '') || 'document') + '.' + ext
    a.click(); URL.revokeObjectURL(a.href)
  }, [rendered, format, source, theme, fileName, renderMode])
  const copyOutput = useCallback(async () => {
    if (!rendered) return
    await navigator.clipboard.writeText(rendered)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }, [rendered])

  const dark = '#0d1117', border = '#21262d', muted = '#6e7681'
  const previewLabel = format === 'html'
    ? (renderMode === 'paged' ? 'PAGES' : 'CANVAS')
    : 'SVG'
  const previewBg = (format === 'html' && renderMode === 'paged') ? '#525659' : '#ffffff'

  return (
    <div style={{ display:'grid', gridTemplateRows:'48px 1fr', height:'100vh', overflow:'hidden',
      background:'#0f1117', color:'#e2e8f0',
      fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif' }}>
      {/* ── Header ── */}
      <header style={{ display:'flex', alignItems:'center', gap:'0.75rem',
        padding:'0 1rem', background:dark, borderBottom:`1px solid ${border}`,
        overflow:'hidden', flexShrink:0 }}>
        <div style={{ fontSize:'1rem', fontWeight:800, letterSpacing:'-0.5px',
          color:'#f0f6fc', whiteSpace:'nowrap', flexShrink:0 }}>
          htex <span style={{ fontWeight:400, color:'#8b949e', fontSize:'0.9em' }}>/&nbsp;react</span>
        </div>
        <span style={{ fontSize:'0.6rem', fontWeight:700, padding:'0.1rem 0.4rem',
          borderRadius:3, background:'#3b1d5f', color:'#d2a8ff', flexShrink:0 }}>
          React 19 · Hooks
        </span>
        {source.trim() && <span style={{ fontSize:'0.7rem', color:muted, whiteSpace:'nowrap' }}>
          {renderTime}ms · {source.length.toLocaleString()} chars
        </span>}
        <div style={{ flex:1 }} />
        <div style={{ display:'flex', gap:'0.4rem', alignItems:'center', flexShrink:0 }}>
          <Pill options={[{label:'HTML',value:'html'},{label:'SVG',value:'svg'}]}
            value={format} onChange={setFormat} accent="#1f6feb" />
          {format === 'html' && (
            <Pill<RenderMode>
              options={[{label:'Canvas',value:'canvas'},{label:'Pages',value:'paged'}]}
              value={renderMode} onChange={setRenderMode} accent="#7c3aed" />
          )}
          <Pill options={[{label:'Light',value:'light'},{label:'Dark',value:'dark'}]}
            value={theme} onChange={setTheme} />
          <button disabled={!rendered} onClick={copyOutput} style={{
            padding:'0.2rem 0.65rem', borderRadius:5, border:`1px solid ${border}`,
            background:'#21262d', color: rendered ? '#c9d1d9' : muted,
            fontSize:'0.7rem', fontWeight:600, cursor: rendered ? 'pointer':'default',
            whiteSpace:'nowrap', opacity: rendered ? 1 : 0.35 }}>
            {copied ? '✓ Copied' : '⎘ Copy'}
          </button>
          <button disabled={!rendered} onClick={download} style={{
            padding:'0.2rem 0.65rem', borderRadius:5, border:'1px solid #1f6feb',
            background:'#1f6feb', color: rendered ? '#fff' : muted,
            fontSize:'0.7rem', fontWeight:600, cursor: rendered ? 'pointer':'default',
            whiteSpace:'nowrap', opacity: rendered ? 1 : 0.35 }}>
            ↓ {format.toUpperCase()}
          </button>
        </div>
      </header>
      {/* ── Workspace ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', overflow:'hidden', minHeight:0 }}>
        {/* Left: editor */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden',
          borderRight:`1px solid ${border}`, minHeight:0 }}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 0.75rem', height:32, background:dark, borderBottom:`1px solid ${border}`,
            fontSize:'0.65rem', fontWeight:700, color:muted,
            textTransform:'uppercase', letterSpacing:'0.08em', flexShrink:0 }}>
            LaTeX Source
            {fileName && <span style={{ background:'#1f3a5f', color:'#79c0ff',
              padding:'0.08rem 0.35rem', borderRadius:3, fontSize:'0.62rem',
              fontWeight:600, textTransform:'none', letterSpacing:0 }}>📄 {fileName}</span>}
          </div>
          <div style={{ padding:'0 0.75rem', height:28, display:'flex', alignItems:'center',
            gap:'0.5rem', background:dark, borderBottom:`1px solid ${border}`,
            fontSize:'0.68rem', color:muted, flexShrink:0 }}>
            📂 Drop a <code style={{ fontFamily:'monospace', color:'#8b949e' }}>.tex</code> file, or&nbsp;
            <label style={{ color:'#58a6ff', cursor:'pointer', fontWeight:600 }}>
              browse<input type="file" accept=".tex,.txt" style={{ display:'none' }} onChange={onFileInput}/>
            </label>
          </div>
          <div style={{ position:'relative', flex:1, overflow:'hidden', minHeight:0 }}>
            {isDragging && (
              <div style={{ position:'absolute', inset:0, background:'rgba(31,111,235,0.12)',
                border:'2px dashed #1f6feb', display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:'1rem', fontWeight:700,
                color:'#58a6ff', zIndex:10, pointerEvents:'none' }}>
                Drop .tex file here
              </div>
            )}
            <textarea value={source} onChange={e => setSource(e.target.value)}
              placeholder="Paste or type LaTeX here…" spellCheck={false}
              autoCorrect="off" autoCapitalize="off"
              style={{ width:'100%', height:'100%', background:dark, border:'none',
                outline:'none', resize:'none', padding:'0.75rem 1rem',
                fontFamily:"'Fira Code','Cascadia Code','JetBrains Mono','SF Mono',monospace",
                fontSize:'0.78rem', lineHeight:1.6, color:'#c9d1d9', tabSize:2 }}
            />
          </div>
        </div>
        {/* Right: preview */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden',
          minHeight:0, background: previewBg, transition:'background 0.15s' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'0 0.75rem', height:32, background:dark, borderBottom:`1px solid ${border}`,
            fontSize:'0.65rem', fontWeight:700, color:muted,
            textTransform:'uppercase', letterSpacing:'0.08em', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <span>Preview — {previewLabel}</span>
              {fileName && <span style={{ background:'#2d1b4e', color:'#d2a8ff',
                padding:'0.08rem 0.35rem', borderRadius:3, fontSize:'0.62rem',
                fontWeight:600, textTransform:'none' }}>{fileName}</span>}
            </div>
            {format === 'html' && (
              <div style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                <button onClick={() => handleZoom(-10)} 
                  style={{ padding:'0.15rem 0.35rem', borderRadius:3, border:`1px solid ${border}`,
                    background:'transparent', color:muted, fontSize:'0.65rem', fontWeight:600,
                    cursor:'pointer', transition:'all 0.1s' }}
                  title="Zoom out (Ctrl+-)">−</button>
                <span style={{ fontSize:'0.65rem', color:muted, minWidth:'2.5rem', textAlign:'center' }}>
                  {zoom}%
                </span>
                <button onClick={() => handleZoom(10)} 
                  style={{ padding:'0.15rem 0.35rem', borderRadius:3, border:`1px solid ${border}`,
                    background:'transparent', color:muted, fontSize:'0.65rem', fontWeight:600,
                    cursor:'pointer', transition:'all 0.1s' }}
                  title="Zoom in (Ctrl++)">+</button>
                <button onClick={() => { setZoom(100); localStorage.setItem('htex-zoom', '100') }}
                  style={{ padding:'0.15rem 0.35rem', borderRadius:3, border:`1px solid ${border}`,
                    background:'transparent', color:muted, fontSize:'0.65rem', fontWeight:600,
                    cursor:'pointer', transition:'all 0.1s' }}
                  title="Reset zoom (Ctrl+0)">100</button>
              </div>
            )}
          </div>
          <div style={{ flex:1, overflow:'auto', minHeight:0 }}>
            {error ? (
              <div style={{ background:'rgba(248,81,73,0.1)', border:'1px solid rgba(248,81,73,0.3)',
                borderRadius:6, padding:'1rem', color:'#ff7b72', fontFamily:'monospace',
                fontSize:'0.8rem', whiteSpace:'pre-wrap', lineHeight:1.5,
                maxWidth:760, margin:'2rem auto' }}>
                ⚠ Render error:{'\n\n'}{error}
              </div>
            ) : rendered ? (
              format === 'svg' ? (
                <div style={{ padding:'2rem', background:'#404040', minHeight:'100%',
                  display:'flex', flexDirection:'column', alignItems:'center' }}
                  dangerouslySetInnerHTML={{ __html: rendered }}
                />
              ) : (
                <div style={{ 
                  flex: 1,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '2rem 0'
                }}>
                  <div style={{
                    transformOrigin: '0 0',
                    transform: `scale(${zoom / 100})`,
                    transition: 'transform 0.15s ease-out',
                    willChange: 'transform'
                  }}>
                    <div ref={previewRef} style={{ width: '608px' }}
                      dangerouslySetInnerHTML={{ __html: rendered }}
                    />
                  </div>
                </div>
              )
            ) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', height:'100%', minHeight:300, gap:'0.5rem', color:'#888' }}>
                <div style={{ fontSize:'2rem' }}>⚛</div>
                <div style={{ fontSize:'0.8rem' }}>Rendered document appears here</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
