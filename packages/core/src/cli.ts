#!/usr/bin/env bun
// =============================================================================
// htex CLI — convert LaTeX files to HTML or SVG from the command line
//
// USAGE:
//   htex [options] <input.tex>
//   htex --format svg --width 1200 --theme dark input.tex -o output.svg
//   cat input.tex | htex --format html --standalone > output.html
//
// OPTIONS:
//   -f, --format <html|svg>     Output format (default: html)
//   -o, --output <path>         Output file (default: stdout)
//   -t, --theme <light|dark>    Color theme (default: light)
//   -w, --width <px>            SVG width in pixels (default: 900)
//   --no-standalone             Output fragment instead of full document
//   --title <title>             Override document title
//   -h, --help                  Show this help
//   -v, --version               Show version
// =============================================================================

import { readFileSync, writeFileSync } from 'fs'
import { latexToHtml, latexToSvg, VERSION } from './index.js'
import type { Theme } from './types.js'
import type { HtmlRenderOptions } from './renderers/html.js'
import type { SvgRenderOptions } from './renderers/svg.js'

// ── Argument parsing ──────────────────────────────────────────────────────

interface CliArgs {
  format: 'html' | 'svg'
  output: string | null
  theme: Theme
  width: number
  standalone: boolean
  title: string | null
  input: string | null
  help: boolean
  version: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    format: 'html',
    output: null,
    theme: 'light',
    width: 900,
    standalone: true,
    title: null,
    input: null,
    help: false,
    version: false,
  }

  let i = 2 // skip 'bun' and script name
  while (i < argv.length) {
    const arg = argv[i]!
    switch (arg) {
      case '-h': case '--help':
        args.help = true; break
      case '-v': case '--version':
        args.version = true; break
      case '-f': case '--format':
        args.format = (argv[++i] as 'html' | 'svg') ?? 'html'; break
      case '-o': case '--output':
        args.output = argv[++i] ?? null; break
      case '-t': case '--theme':
        args.theme = (argv[++i] as Theme) ?? 'light'; break
      case '-w': case '--width':
        args.width = parseInt(argv[++i] ?? '900') || 900; break
      case '--title':
        args.title = argv[++i] ?? null; break
      case '--no-standalone':
        args.standalone = false; break
      default:
        if (!arg.startsWith('-')) args.input = arg
    }
    i++
  }

  return args
}

const HELP = `
htex v${VERSION} — LaTeX to HTML/SVG converter

USAGE:
  htex [options] [input.tex]
  cat paper.tex | htex [options]

OPTIONS:
  -f, --format <html|svg>     Output format (default: html)
  -o, --output <path>         Output file (default: stdout)
  -t, --theme <light|dark>    Color theme (default: light)
  -w, --width <px>            SVG width in pixels (default: 900)
  --title <title>             Override document title
  --no-standalone             Output HTML fragment (no DOCTYPE)
  -h, --help                  Show this help
  -v, --version               Show version

EXAMPLES:
  htex paper.tex                          # HTML to stdout
  htex paper.tex -o paper.html            # HTML to file
  htex -f svg -t dark paper.tex           # SVG with dark theme
  htex -f svg -w 1200 -o paper.svg paper.tex
  cat paper.tex | htex -f html > out.html # Pipe mode
`.trim()

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv)

  if (args.help) { console.log(HELP); process.exit(0) }
  if (args.version) { console.log(`htex v${VERSION}`); process.exit(0) }

  // Read input
  let source: string
  if (args.input) {
    try {
      source = readFileSync(args.input, 'utf8')
    } catch (err) {
      console.error(`htex: cannot read file '${args.input}': ${(err as Error).message}`)
      process.exit(1)
    }
  } else {
    // Read from stdin
    const chunks: Uint8Array[] = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    source = Buffer.concat(chunks).toString('utf8')
  }

  if (!source.trim()) {
    console.error('htex: no input provided')
    process.exit(1)
  }

  // Render
  let output: string
  try {
    if (args.format === 'svg') {
      const opts: SvgRenderOptions = {
        theme: args.theme,
        svgWidth: args.width,
        standalone: args.standalone,
      }
      output = latexToSvg(source, opts)
    } else {
      const opts: HtmlRenderOptions = args.title
        ? { theme: args.theme, standalone: args.standalone, title: args.title }
        : { theme: args.theme, standalone: args.standalone }
      output = latexToHtml(source, opts)
    }
  } catch (err) {
    console.error(`htex: render error: ${(err as Error).message}`)
    process.exit(1)
  }

  // Write output
  if (args.output) {
    try {
      writeFileSync(args.output, output, 'utf8')
      console.error(`htex: wrote ${output.length} bytes to ${args.output}`)
    } catch (err) {
      console.error(`htex: cannot write to '${args.output}': ${(err as Error).message}`)
      process.exit(1)
    }
  } else {
    process.stdout.write(output)
  }
}

main().catch(err => {
  console.error('htex: unexpected error:', err)
  process.exit(1)
})
