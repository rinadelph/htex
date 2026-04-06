// =============================================================================
// @htex/core — tokenizer/index.ts
// Character-level LaTeX lexical scanner.
// Input:  raw LaTeX string
// Output: Token[]  — never throws, recovers from malformed input
// =============================================================================
import { TokenKind, type Token } from '../types.js'

// Environments whose body must be captured verbatim (not re-tokenised).
const VERBATIM_ENVS = new Set([
  'lstlisting', 'verbatim', 'Verbatim', 'minted', 'lstinline', 'verb',
])

function isAlpha(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '@'
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let col  = 1

  function peek(offset = 0): string { return source[i + offset] ?? '' }

  function advance(): string {
    const ch = source[i++] ?? ''
    if (ch === '\n') { line++; col = 1 } else { col++ }
    return ch
  }

  function push(kind: TokenKind, value: string, tl: number, tc: number): void {
    tokens.push({ kind, value, line: tl, col: tc })
  }

  while (i < source.length) {
    const tl = line, tc = col
    const ch = peek()

    // ── Comment ─────────────────────────────────────────────────────────
    if (ch === '%') {
      advance()
      let val = ''
      while (i < source.length && peek() !== '\n') val += advance()
      push(TokenKind.COMMENT, val, tl, tc)
      continue
    }

    // ── Backslash ────────────────────────────────────────────────────────
    if (ch === '\\') {
      advance()
      const nx = peek()

      // \\ — row separator / line break
      if (nx === '\\') {
        advance()
        // Consume optional [vspace] argument, e.g. \\[0.5em] — swallow it entirely
        // so it never leaks into the token stream as LBRACKET/TEXT/RBRACKET
        {
          // Peek ahead to see if a '[' follows (with optional spaces)
          let j = i
          while (j < source.length && (source[j] === ' ' || source[j] === '\t')) j++
          if (source[j] === '[') {
            // Advance cursor to the '[' 
            while (i < j) advance() // skip spaces
            advance() // skip '['
            // Consume until ']' or newline
            while (i < source.length && source[i] !== ']' && source[i] !== '\n') advance()
            if (i < source.length && source[i] === ']') advance() // skip ']'
          }
        }
        push(TokenKind.NEWLINE, '\\\\', tl, tc)
        continue
      }

      // \<special>  →  literal character text
      if ('{}$&#_~^,;!|/ %'.includes(nx) && nx !== '') {
        push(TokenKind.TEXT, advance(), tl, tc)
        continue
      }

      // \[ ... \]  display math
      if (nx === '[') {
        advance()
        let math = ''
        while (i < source.length) {
          if (peek() === '\\' && peek(1) === ']') { advance(); advance(); break }
          math += advance()
        }
        push(TokenKind.MATH_DISPLAY, math.trim(), tl, tc)
        continue
      }

      // \( ... \)  inline math
      if (nx === '(') {
        advance()
        let math = ''
        while (i < source.length) {
          if (peek() === '\\' && peek(1) === ')') { advance(); advance(); break }
          math += advance()
        }
        push(TokenKind.MATH_INLINE, math, tl, tc)
        continue
      }

      // Named command
      if (isAlpha(nx)) {
        let name = ''
        while (i < source.length && isAlpha(peek())) name += advance()

        if (name === 'begin' || name === 'end') {
          // skip whitespace before {
          while (i < source.length && ' \t\n'.includes(peek())) advance()
          if (peek() === '{') {
            advance()
            let envName = ''
            while (i < source.length && peek() !== '}') envName += advance()
            if (peek() === '}') advance()

            if (name === 'begin') {
              if (VERBATIM_ENVS.has(envName)) {
                // Collect [options] on same line
                let optStr = ''
                while (i < source.length && peek() !== '\n') optStr += advance()
                push(TokenKind.ENV_BEGIN, envName, tl, tc)
                // Capture body verbatim until \end{envName}
                const endMark = `\\end{${envName}}`
                let body = ''
                while (i < source.length && !source.startsWith(endMark, i)) body += advance()
                // Consume the \end{envName}
                if (source.startsWith(endMark, i)) {
                  for (let k = 0; k < endMark.length; k++) advance()
                }
                // Strip surrounding newlines
                if (body.startsWith('\n')) body = body.slice(1)
                if (body.endsWith('\n')) body = body.slice(0, -1)
                // Emit: "optStr\nbody" trimmed from left
                push(TokenKind.VERBATIM, (optStr.trim() + '\n' + body).trimStart(), tl, tc)
              } else {
                push(TokenKind.ENV_BEGIN, envName, tl, tc)
              }
            } else {
              push(TokenKind.ENV_END, envName, tl, tc)
            }
          } else {
            push(TokenKind.COMMAND, name, tl, tc)
          }
          continue
        }

        push(TokenKind.COMMAND, name, tl, tc)
        continue
      }

      // Lone backslash — emit as empty newline token (handles \  etc.)
      push(TokenKind.NEWLINE, '\\', tl, tc)
      continue
    }

    // ── Display math $$ ─────────────────────────────────────────────────
    if (ch === '$' && peek(1) === '$') {
      advance(); advance()
      let math = ''
      while (i < source.length) {
        if (peek() === '$' && peek(1) === '$') { advance(); advance(); break }
        math += advance()
      }
      push(TokenKind.MATH_DISPLAY, math.trim(), tl, tc)
      continue
    }

    // ── Inline math $ ───────────────────────────────────────────────────
    if (ch === '$') {
      advance()
      let math = ''
      while (i < source.length) {
        if (peek() === '\\') { math += advance(); if (i < source.length) math += advance(); continue }
        if (peek() === '$') { advance(); break }
        math += advance()
      }
      push(TokenKind.MATH_INLINE, math, tl, tc)
      continue
    }

    // ── Structural ───────────────────────────────────────────────────────
    if (ch === '{') { advance(); push(TokenKind.LBRACE,   '{', tl, tc); continue }
    if (ch === '}') { advance(); push(TokenKind.RBRACE,   '}', tl, tc); continue }
    if (ch === '[') { advance(); push(TokenKind.LBRACKET, '[', tl, tc); continue }
    if (ch === ']') { advance(); push(TokenKind.RBRACKET, ']', tl, tc); continue }
    if (ch === '&') { advance(); push(TokenKind.AMPERSAND,'&', tl, tc); continue }

    // ── Whitespace ───────────────────────────────────────────────────────
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      let ws = ''
      while (i < source.length && ' \t\r'.includes(peek())) ws += advance()
      push(TokenKind.WHITESPACE, ws, tl, tc)
      continue
    }

    if (ch === '\n') {
      advance()
      // Blank line → paragraph separator
      if (peek() === '\n') {
        while (i < source.length && peek() === '\n') advance()
        push(TokenKind.NEWLINE, '\n\n', tl, tc)
      } else {
        push(TokenKind.WHITESPACE, '\n', tl, tc)
      }
      continue
    }

    // ── Plain text ───────────────────────────────────────────────────────
    let text = ''
    while (
      i < source.length &&
      !'\\${}[]&% \t\n\r'.includes(peek())
    ) {
      text += advance()
    }
    if (text) push(TokenKind.TEXT, text, tl, tc)
  }

  push(TokenKind.EOF, '', line, col)
  return tokens
}
