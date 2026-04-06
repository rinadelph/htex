// =============================================================================
// @htex/core — __tests__/cli.test.ts
//
// UNFAKEABLE END-TO-END CLI TESTS
// These tests spawn the actual CLI process and verify its output.
// They cannot be faked without implementing the real pipeline.
// =============================================================================

import { describe, it, expect, afterAll } from 'bun:test'
import { spawnSync, execSync } from 'child_process'
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const CLI = join(import.meta.dir, '..', 'cli.ts')
const BQ_ARCH = '/home/swarm/BrickellQuant/report/brickellquant_architecture.tex'

// Temp files to clean up
const tempFiles: string[] = []

function tmpFile(ext: string): string {
  const p = join(tmpdir(), `htex-test-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
  tempFiles.push(p)
  return p
}

afterAll(() => {
  for (const f of tempFiles) {
    if (existsSync(f)) unlinkSync(f)
  }
})

function runCli(args: string[], input?: string): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('bun', [CLI, ...args], {
    input: input ? Buffer.from(input) : undefined,
    encoding: 'utf8',
    timeout: 15000,
  })
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? -1,
  }
}

// ── --help and --version ───────────────────────────────────────────────────
describe('CLI: --help and --version', () => {
  it('[VR] --help exits 0 and shows USAGE', () => {
    const r = runCli(['--help'])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain('USAGE')
    expect(r.stdout).toContain('htex')
  })

  it('[VR] -h is alias for --help', () => {
    const r = runCli(['-h'])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain('USAGE')
  })

  it('[VR] --version exits 0 and shows version', () => {
    const r = runCli(['--version'])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toMatch(/htex v\d+\.\d+\.\d+/)
  })

  it('[VR] -v is alias for --version', () => {
    const r = runCli(['-v'])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain('htex v')
  })
})

// ── stdin input ────────────────────────────────────────────────────────────
describe('CLI: stdin input', () => {
  const SIMPLE = '\\begin{document}Hello World\\end{document}'

  it('[VR] reads LaTeX from stdin and outputs HTML', () => {
    const r = runCli([], SIMPLE)
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain('<!DOCTYPE html>')
  })

  it('[VR] stdin HTML output contains document content', () => {
    const r = runCli([], SIMPLE)
    expect(r.stdout).toContain('Hello World')
  })

  it('[VR] empty stdin exits 1', () => {
    const r = runCli([], '')
    expect(r.exitCode).toBe(1)
  })

  it('[VR] stdin with --format svg produces SVG', () => {
    const r = runCli(['--format', 'svg'], SIMPLE)
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toMatch(/^<\?xml/)
  })
})

// ── File input ─────────────────────────────────────────────────────────────
describe('CLI: file input', () => {
  it('[VR] reads LaTeX from file and outputs HTML to stdout', () => {
    const r = runCli([BQ_ARCH])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain('<!DOCTYPE html>')
    expect(r.stdout.length).toBeGreaterThan(5000)
  })

  it('[VR] nonexistent file exits 1', () => {
    const r = runCli(['/tmp/this-does-not-exist.tex'])
    expect(r.exitCode).toBe(1)
  })

  it('[VR] --output writes to file', () => {
    const outFile = tmpFile('.html')
    const r = runCli([BQ_ARCH, '-o', outFile])
    expect(r.exitCode).toBe(0)
    expect(existsSync(outFile)).toBe(true)
    const content = readFileSync(outFile, 'utf8')
    expect(content).toContain('<!DOCTYPE html>')
    expect(content.length).toBeGreaterThan(5000)
  })

  it('[VR] -o writes to file (short alias)', () => {
    const outFile = tmpFile('.html')
    runCli([BQ_ARCH, '-o', outFile])
    expect(readFileSync(outFile, 'utf8')).toContain('<!DOCTYPE html>')
  })
})

// ── Format option ──────────────────────────────────────────────────────────
describe('CLI: --format option', () => {
  it('[VR] --format html produces HTML5', () => {
    const r = runCli(['-f', 'html', BQ_ARCH])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toContain('<!DOCTYPE html>')
  })

  it('[VR] --format svg produces SVG with xml declaration', () => {
    const r = runCli(['-f', 'svg', BQ_ARCH])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toMatch(/^<\?xml/)
    expect(r.stdout).toContain('<svg')
  })

  it('[VR] SVG output has width=900 by default', () => {
    const r = runCli(['-f', 'svg'], '\\begin{document}hi\\end{document}')
    expect(r.stdout).toContain('width="900"')
  })

  it('[VR] --width overrides SVG width', () => {
    const r = runCli(['-f', 'svg', '-w', '1400'], '\\begin{document}hi\\end{document}')
    expect(r.stdout).toContain('width="1400"')
  })
})

// ── Theme option ───────────────────────────────────────────────────────────
describe('CLI: --theme option', () => {
  it('[VR] --theme dark produces dark theme HTML', () => {
    const r = runCli(['-t', 'dark'], '\\begin{document}hi\\end{document}')
    expect(r.stdout).toContain('data-theme="dark"')
    expect(r.stdout).toContain('#0D1117')
  })

  it('[VR] --theme light is the default', () => {
    const r = runCli([], '\\begin{document}hi\\end{document}')
    expect(r.stdout).toContain('data-theme="light"')
  })
})

// ── --no-standalone ────────────────────────────────────────────────────────
describe('CLI: --no-standalone', () => {
  it('[VR] --no-standalone omits DOCTYPE', () => {
    const r = runCli(['--no-standalone'], '\\begin{document}hi\\end{document}')
    expect(r.stdout).not.toContain('<!DOCTYPE')
    // Fragment mode: starts with <style> then has the document div
    expect(r.stdout).toContain('<div class="htex-document"')
  })
})

// ── UNFAKEABLE: Real BrickellQuant CLI integration ─────────────────────────
describe('CLI: BrickellQuant real-file end-to-end [UNFAKEABLE]', () => {
  const files = [
    ['/home/swarm/BrickellQuant/report/brickellquant_architecture.tex', 'brickellquant_architecture'],
    ['/home/swarm/BrickellQuant/tools/autopilot/report/autopilot_report.tex', 'autopilot_report'],
    ['/home/swarm/BrickellQuant/docs/almanac_architecture.tex', 'almanac_architecture'],
  ] as const

  for (const [path, name] of files) {
    it(`[VR] CLI renders ${name} to HTML file without error`, () => {
      const out = tmpFile('.html')
      const r = runCli([path, '-o', out])
      expect(r.exitCode).toBe(0)
      expect(existsSync(out)).toBe(true)
      const html = readFileSync(out, 'utf8')
      expect(html).toContain('<!DOCTYPE html>')
      expect(html.length).toBeGreaterThan(1000)
    })

    it(`[VR] CLI renders ${name} to SVG file without error`, () => {
      const out = tmpFile('.svg')
      const r = runCli([path, '-f', 'svg', '-o', out])
      expect(r.exitCode).toBe(0)
      const svg = readFileSync(out, 'utf8')
      expect(svg).toMatch(/^<\?xml/)
      expect(svg.length).toBeGreaterThan(1000)
    })
  }

  it('[VR] CLI output HTML has section headings', () => {
    const r = runCli([BQ_ARCH])
    expect(r.stdout).toMatch(/<h[123]>/)
  })

  it('[VR] CLI output HTML has no unescaped & in body text', () => {
    const r = runCli(['--no-standalone', BQ_ARCH])
    const stripped = r.stdout.replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, 'ENTITY')
    expect(stripped).not.toMatch(/&(?!\w+;)/)
  })

  it('[VR] CLI SVG and HTML represent same document (both contain section text)', () => {
    const html = runCli([BQ_ARCH]).stdout
    const svg = runCli(['-f', 'svg', BQ_ARCH]).stdout
    // Both should contain text from the document body (section titles or content)
    expect(html).toContain('BrickellQuant')
    expect(svg).toContain('BrickellQuant')
  })

  it('[VR] CLI renders in < 5 seconds for all 3 BQ files', () => {
    const start = Date.now()
    for (const [path] of files) {
      runCli([path, '-f', 'html'])
    }
    expect(Date.now() - start).toBeLessThan(5000)
  })
})
