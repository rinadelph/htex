// =============================================================================
// @htex/core — parser/index.ts
// Recursive descent parser. Input: Token[]. Output: DocumentAST.
// Never throws — attaches ParseError objects to nodes on bad input.
// =============================================================================
import { TokenKind, ParseError } from '../types.js';
// ── Colour parsing helpers ─────────────────────────────────────────────────
function hexFromHtml(raw) {
    const s = raw.trim().replace(/^#/, '');
    if (s.length === 3)
        return '#' + s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    return '#' + s.toUpperCase().padStart(6, '0');
}
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function resolveColorHex(model, raw) {
    const m = model.trim().toUpperCase();
    if (m === 'HTML')
        return hexFromHtml(raw);
    if (m === 'RGB') {
        const [r, g, b] = raw.split(',').map(Number);
        return rgbToHex(r ?? 0, g ?? 0, b ?? 0);
    }
    if (m === 'RGB' || m === 'rgb') {
        const [r, g, b] = raw.split(',').map(v => Math.round(Number(v.trim()) * 255));
        return rgbToHex(r ?? 0, g ?? 0, b ?? 0);
    }
    if (m === 'GRAY' || m === 'GREY') {
        const v = Math.round(Number(raw.trim()) * 255);
        return rgbToHex(v, v, v);
    }
    // Fallback: treat as HTML hex
    return hexFromHtml(raw);
}
// ── Option string parser ───────────────────────────────────────────────────
function parseOptionString(raw) {
    return raw.split(',').map(part => {
        const eq = part.indexOf('=');
        if (eq === -1)
            return { key: part.trim(), value: '' };
        return { key: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
    }).filter(o => o.key.length > 0);
}
// ── Token cursor ──────────────────────────────────────────────────────────
class Cursor {
    tokens;
    pos = 0;
    errors = [];
    constructor(tokens) {
        this.tokens = tokens;
    }
    get position() { return this.pos; }
    peek(offset = 0) {
        return this.tokens[this.pos + offset] ?? { kind: TokenKind.EOF, value: '', line: 0, col: 0 };
    }
    consume() {
        return this.tokens[this.pos++] ?? { kind: TokenKind.EOF, value: '', line: 0, col: 0 };
    }
    check(kind) {
        return this.peek().kind === kind;
    }
    checkValue(kind, value) {
        const t = this.peek();
        return t.kind === kind && t.value === value;
    }
    /** Check if the next token is a TEXT token with the given exact value */
    checkText(value) {
        const t = this.peek();
        return t.kind === TokenKind.TEXT && t.value === value;
    }
    eat(kind) {
        if (this.check(kind))
            return this.consume();
        return null;
    }
    skipWhitespace() {
        while (this.check(TokenKind.WHITESPACE) || this.check(TokenKind.COMMENT)) {
            this.consume();
        }
    }
    /** Save current position for potential restore */
    save() { return this.pos; }
    /** Restore to a previously saved position */
    restore(savedPos) { this.pos = savedPos; }
    error(msg) {
        const t = this.peek();
        const e = new ParseError(msg, t.line, t.col);
        this.errors.push(e);
        return e;
    }
    atEnd() {
        return this.peek().kind === TokenKind.EOF;
    }
}
// ── Main parser ────────────────────────────────────────────────────────────
export function parse(tokens) {
    const cursor = new Cursor(tokens);
    // Split tokens into preamble (before \begin{document}) and body
    const preambleTokens = [];
    const bodyTokens = [];
    let inDocument = false;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (!inDocument) {
            if (t.kind === TokenKind.ENV_BEGIN && t.value === 'document') {
                inDocument = true;
                continue;
            }
            preambleTokens.push(t);
        }
        else {
            if (t.kind === TokenKind.ENV_END && t.value === 'document') {
                continue;
            }
            bodyTokens.push(t);
        }
    }
    // Add EOF to both
    const eofToken = { kind: TokenKind.EOF, value: '', line: 0, col: 0 };
    preambleTokens.push(eofToken);
    bodyTokens.push(eofToken);
    // Parse preamble
    const preambleCursor = new Cursor(preambleTokens);
    const preamble = parsePreamble(preambleCursor);
    // Parse body
    const bodyCursor = new Cursor(bodyTokens);
    const body = parseNodeSequence(bodyCursor, null);
    return {
        preamble,
        body,
        errors: [...preambleCursor.errors, ...bodyCursor.errors],
    };
}
// ── Preamble parser ────────────────────────────────────────────────────────
function parsePreamble(cursor) {
    let documentClass = 'article';
    let documentOptions = '';
    const packages = [];
    const colors = [];
    const customEnvs = [];
    const commands = [];
    let lstset = {};
    const rawPreambleNodes = [];
    while (!cursor.atEnd()) {
        cursor.skipWhitespace();
        if (cursor.atEnd())
            break;
        const t = cursor.peek();
        if (t.kind === TokenKind.COMMAND) {
            cursor.consume();
            const name = t.value;
            if (name === 'documentclass') {
                const opts = parseOptionalArg(cursor);
                const cls = parseSingleRequiredText(cursor);
                documentClass = cls;
                documentOptions = opts.map(o => (o.value ? `${o.key}=${o.value}` : o.key)).join(',');
            }
            else if (name === 'usepackage') {
                const opts = parseOptionalArg(cursor);
                const pkg = parseSingleRequiredText(cursor);
                // Handle comma-separated package lists: \usepackage{a,b,c}
                const pkgNames = pkg.split(',').map(s => s.trim()).filter(Boolean);
                for (const pkgName of pkgNames) {
                    packages.push({ name: pkgName, options: opts.map(o => (o.value ? `${o.key}=${o.value}` : o.key)).join(',') });
                }
            }
            else if (name === 'definecolor') {
                const colorName = parseSingleRequiredText(cursor);
                const model = parseSingleRequiredText(cursor);
                const rawValue = parseSingleRequiredText(cursor);
                const hex = resolveColorHex(model, rawValue);
                colors.push({ name: colorName, model, rawValue, hex });
            }
            else if (name === 'newmdenv') {
                // \newmdenv[options]{envname}
                const optTokens = parseOptionalArg(cursor);
                const envName = parseSingleRequiredText(cursor);
                const optsMap = {};
                for (const o of optTokens)
                    optsMap[o.key] = o.value;
                customEnvs.push({ name: envName, basedOn: 'mdframed', options: optsMap });
            }
            else if (name === 'newenvironment') {
                const envName = parseSingleRequiredText(cursor);
                skipGroup(cursor); // begin code
                skipGroup(cursor); // end code
                customEnvs.push({ name: envName, basedOn: 'newenvironment', options: {} });
            }
            else if (name === 'newcommand' || name === 'renewcommand') {
                const cmdNameGroup = parseGroup(cursor);
                const cmdName = flattenToText(cmdNameGroup).replace(/^\\/, '');
                // Optional arg count
                const argCountOpts = parseOptionalArg(cursor);
                const argCount = argCountOpts.length > 0 ? parseInt(argCountOpts[0]?.key ?? '0') : 0;
                const bodyNodes = parseGroup(cursor);
                commands.push({ name: cmdName, argCount, body: bodyNodes });
            }
            else if (name === 'lstset') {
                const raw = parseSingleRequiredText(cursor);
                const opts = parseOptionString(raw);
                for (const o of opts) {
                    ;
                    lstset[o.key] = o.value;
                }
            }
            else if (name === 'lstdefinestyle') {
                skipGroup(cursor); // style name
                skipGroup(cursor); // style def
            }
            else if (name === 'usetikzlibrary') {
                skipGroup(cursor);
            }
            else if (name === 'pgfplotsset') {
                skipGroup(cursor);
            }
            else if (name === 'title' || name === 'author' || name === 'date') {
                // Capture \title{...}, \author{...}, \date{...} into raw preamble nodes
                const reqArg = parseGroup(cursor);
                const pos = { line: t.line, col: t.col };
                rawPreambleNodes.push({ type: 'command', name, optArgs: [], reqArgs: [reqArg], pos });
            }
            else {
                // Unknown preamble command — skip its arguments
                skipCommandArgs(cursor);
            }
            continue;
        }
        // Skip everything else in preamble (comments, text, etc.)
        cursor.consume();
    }
    return {
        documentClass,
        documentOptions,
        packages,
        colors,
        customEnvs,
        commands,
        lstset,
        rawPreambleNodes,
    };
}
// ── Body parser ────────────────────────────────────────────────────────────
function parseNodeSequence(cursor, stopEnv) {
    const nodes = [];
    while (!cursor.atEnd()) {
        // Check for stop condition
        if (stopEnv !== null && cursor.checkValue(TokenKind.ENV_END, stopEnv)) {
            cursor.consume();
            break;
        }
        // Break on any ENV_END when inside an environment (mismatched)
        if (stopEnv !== null && cursor.check(TokenKind.ENV_END)) {
            break;
        }
        const posBefore = cursor.position;
        const node = parseNode(cursor);
        // Guard: if no tokens consumed, force-advance to prevent infinite loop
        if (cursor.position === posBefore) {
            cursor.consume();
            continue;
        }
        if (node !== null)
            nodes.push(node);
    }
    return nodes;
}
function parseNode(cursor) {
    const t = cursor.peek();
    switch (t.kind) {
        case TokenKind.COMMAND:
            return parseCommand(cursor);
        case TokenKind.ENV_BEGIN:
            return parseEnvironment(cursor);
        case TokenKind.ENV_END:
            // Unexpected end — consume and skip
            cursor.error(`Unexpected \\end{${cursor.peek().value}}`);
            cursor.consume();
            return null;
        case TokenKind.TEXT:
            return parseText(cursor);
        case TokenKind.MATH_INLINE:
            return parseMath(cursor, 'inline');
        case TokenKind.MATH_DISPLAY:
            return parseMath(cursor, 'display');
        case TokenKind.LBRACE:
            return parseGroupNode(cursor);
        case TokenKind.COMMENT:
            return parseComment(cursor);
        case TokenKind.WHITESPACE:
            return parseText(cursor); // treat as whitespace text
        case TokenKind.NEWLINE: {
            // \\ line-break token 	 CommandNode named '\\' so transformer can drop it
            if (t.value === '\\\\') {
                const tok = cursor.consume();
                return { type: 'command', name: '\\', optArgs: [], reqArgs: [], pos: { line: tok.line, col: tok.col } };
            }
            // Blank-line paragraph break 	 treat as text (paragraph separator)
            return parseText(cursor);
        }
        case TokenKind.RBRACE:
        case TokenKind.RBRACKET:
        case TokenKind.LBRACKET:
        case TokenKind.EOF:
            return null;
        case TokenKind.AMPERSAND:
            {
                // & in table body = column separator 	 emit as text node '&' for transformer
                const tok = cursor.consume();
                return { type: 'text', content: '&', pos: { line: tok.line, col: tok.col } };
            }
            return null;
        default:
            cursor.consume();
            return null;
    }
}
function parseCommand(cursor) {
    const t = cursor.consume();
    const pos = { line: t.line, col: t.col };
    let name = t.value;
    // Handle starred command variants: \vspace*{}, \hspace*{}, \section*{}, etc.
    // The '*' tokenizes as a separate TEXT token right after the COMMAND token.
    // Consume it so \vspace* is treated as a single command name.
    if (cursor.checkText('*')) {
        cursor.consume();
        name = name + '*';
    }
    // CRITICAL: Do NOT skipWhitespace() unconditionally here.
    // After \color{bqdark} the space before "text" is significant and must be
    // preserved as a TextASTNode for correct inter-word spacing in styled groups.
    // We only skip whitespace immediately before a '{' or '[' argument.
    const optArgs = [];
    const reqArgs = [];
    // Commands with known arg structure
    const multiArgCommands = new Set([
        'textcolor', 'colorbox', 'fcolorbox', 'definecolor',
        'multicolumn', 'multirow', 'hyperref', 'href',
        'newcommand', 'renewcommand', 'newmdenv', 'lstdefinestyle',
    ]);
    // Collect optional args [...] — peek past whitespace to find [, restore if not found
    {
        const saved = cursor.save();
        cursor.skipWhitespace();
        if (cursor.check(TokenKind.LBRACKET)) {
            while (cursor.check(TokenKind.LBRACKET)) {
                optArgs.push(parseOptionalArgNodes(cursor));
                cursor.skipWhitespace();
            }
        }
        else {
            cursor.restore(saved);
        }
    }
    // Collect required args {...} — peek past whitespace to find {, restore if not found
    {
        const saved = cursor.save();
        cursor.skipWhitespace();
        if (cursor.check(TokenKind.LBRACE)) {
            reqArgs.push(parseGroupContent(cursor));
            if (multiArgCommands.has(name)) {
                cursor.skipWhitespace();
                while (cursor.check(TokenKind.LBRACE)) {
                    reqArgs.push(parseGroupContent(cursor));
                    cursor.skipWhitespace();
                }
            }
        }
        else {
            cursor.restore(saved);
        }
    }
    return { type: 'command', name, optArgs, reqArgs, pos };
}
function parseEnvironment(cursor) {
    const t = cursor.consume(); // ENV_BEGIN token
    const pos = { line: t.line, col: t.col };
    const name = t.value;
    const optArgs = [];
    const reqArgs = [];
    cursor.skipWhitespace();
    // Collect optional args [...]
    while (cursor.check(TokenKind.LBRACKET)) {
        const raw = collectBracketText(cursor);
        optArgs.push(...parseOptionString(raw));
        cursor.skipWhitespace();
    }
    // Collect required args (e.g. tabular column spec)
    let columnSpec;
    if (cursor.check(TokenKind.LBRACE)) {
        const content = collectBraceText(cursor);
        reqArgs.push([makeTextNode(content, pos)]);
        if (name === 'tabular' || name === 'longtable' || name === 'tabularx' || name === 'array') {
            columnSpec = content;
        }
        cursor.skipWhitespace();
    }
    // Verbatim environments already consumed by tokenizer as VERBATIM token
    // Token format: "[options]\nbody" if options present, else just "body"
    if (cursor.check(TokenKind.VERBATIM)) {
        const verbToken = cursor.consume();
        const raw = verbToken.value;
        const lines = raw.split('\n');
        const firstLine = lines[0] ?? '';
        // Determine if first line is an options line (starts with '[')
        let langOpts;
        let bodyContent;
        if (firstLine.trimStart().startsWith('[') && firstLine.includes(']')) {
            // First line is option string like "[language=Python, frame=single]"
            langOpts = parseOptionString(firstLine.trim().replace(/^\[/, '').replace(/\].*$/, ''));
            bodyContent = lines.slice(1).join('\n');
        }
        else {
            // No option line — entire value is the verbatim body
            langOpts = optArgs; // fall back to args collected before (e.g. from [language=Python] in \begin line)
            bodyContent = raw;
        }
        const verbOpts = langOpts.length > 0 ? langOpts : optArgs;
        const verbNode = {
            type: 'verbatim',
            envName: name,
            content: bodyContent,
            options: verbOpts,
            pos,
        };
        // ENV_END is already consumed by the tokenizer for verbatim envs
        return columnSpec !== undefined
            ? { type: 'environment', name, optArgs: verbOpts, reqArgs, body: [verbNode], columnSpec, pos }
            : { type: 'environment', name, optArgs: verbOpts, reqArgs, body: [verbNode], pos };
    }
    const body = parseNodeSequence(cursor, name);
    const envNode = columnSpec !== undefined
        ? { type: 'environment', name, optArgs, reqArgs, body, columnSpec, pos }
        : { type: 'environment', name, optArgs, reqArgs, body, pos };
    return envNode;
}
function parseText(cursor) {
    const t = cursor.consume();
    const pos = { line: t.line, col: t.col };
    let content = t.value;
    // Accumulate adjacent text/whitespace tokens.
    // IMPORTANT: Do NOT consume NEWLINE("\\\\") — those are \\ line breaks which
    // need to be emitted as CommandNodes so the transformer can drop them cleanly.
    while (cursor.check(TokenKind.TEXT) ||
        cursor.check(TokenKind.WHITESPACE) ||
        (cursor.check(TokenKind.NEWLINE) && cursor.peek().value !== '\\\\')) {
        content += cursor.consume().value;
    }
    return { type: 'text', content, pos };
}
function parseMath(cursor, kind) {
    const t = cursor.consume();
    return { type: 'math', kind, content: t.value, pos: { line: t.line, col: t.col } };
}
function parseGroupNode(cursor) {
    const t = cursor.consume(); // LBRACE
    const pos = { line: t.line, col: t.col };
    const children = [];
    while (!cursor.atEnd() && !cursor.check(TokenKind.RBRACE)) {
        const posBefore = cursor.position;
        const node = parseNode(cursor);
        if (cursor.position === posBefore) {
            cursor.consume();
            continue;
        }
        if (node !== null)
            children.push(node);
    }
    cursor.eat(TokenKind.RBRACE);
    return { type: 'group', children, pos };
}
function parseComment(cursor) {
    const t = cursor.consume();
    return { type: 'comment', content: t.value, pos: { line: t.line, col: t.col } };
}
// ── Argument helpers ───────────────────────────────────────────────────────
function parseOptionalArg(cursor) {
    cursor.skipWhitespace();
    if (!cursor.check(TokenKind.LBRACKET))
        return [];
    const raw = collectBracketText(cursor);
    return parseOptionString(raw);
}
function parseOptionalArgNodes(cursor) {
    cursor.consume(); // LBRACKET
    const nodes = [];
    while (!cursor.atEnd() && !cursor.check(TokenKind.RBRACKET)) {
        const posBefore = cursor.position;
        const n = parseNode(cursor);
        if (cursor.position === posBefore) {
            cursor.consume();
            continue;
        }
        if (n !== null)
            nodes.push(n);
    }
    cursor.eat(TokenKind.RBRACKET);
    return nodes;
}
function parseGroupContent(cursor) {
    if (!cursor.check(TokenKind.LBRACE))
        return [];
    cursor.consume(); // LBRACE
    const nodes = [];
    while (!cursor.atEnd() && !cursor.check(TokenKind.RBRACE)) {
        const posBefore = cursor.position;
        const n = parseNode(cursor);
        if (cursor.position === posBefore) {
            cursor.consume();
            continue;
        }
        if (n !== null)
            nodes.push(n);
    }
    cursor.eat(TokenKind.RBRACE);
    return nodes;
}
function parseGroup(cursor) {
    return parseGroupContent(cursor);
}
function parseSingleRequiredText(cursor) {
    cursor.skipWhitespace();
    if (cursor.check(TokenKind.LBRACE)) {
        return collectBraceText(cursor);
    }
    // If next token is TEXT, consume it
    if (cursor.check(TokenKind.TEXT)) {
        return cursor.consume().value;
    }
    return '';
}
function collectBraceText(cursor) {
    cursor.consume(); // LBRACE
    let depth = 1;
    let text = '';
    while (!cursor.atEnd() && depth > 0) {
        const t = cursor.consume();
        if (t.kind === TokenKind.LBRACE) {
            depth++;
            text += '{';
        }
        else if (t.kind === TokenKind.RBRACE) {
            depth--;
            if (depth > 0)
                text += '}';
        }
        else if (t.kind === TokenKind.COMMAND)
            text += '\\' + t.value;
        else if (t.kind === TokenKind.MATH_INLINE)
            text += '$' + t.value + '$';
        else if (t.kind === TokenKind.AMPERSAND)
            text += '&';
        else
            text += t.value;
    }
    return text.trim();
}
function collectBracketText(cursor) {
    cursor.consume(); // LBRACKET
    let text = '';
    let depth = 1;
    while (!cursor.atEnd()) {
        const t = cursor.peek();
        if (t.kind === TokenKind.LBRACKET) {
            depth++;
            text += cursor.consume().value;
        }
        else if (t.kind === TokenKind.RBRACKET) {
            cursor.consume();
            depth--;
            if (depth <= 0)
                break;
            text += ']';
        }
        else if (t.kind === TokenKind.COMMAND) {
            text += '\\' + cursor.consume().value;
        }
        else if (t.kind === TokenKind.LBRACE) {
            text += collectBraceText(cursor);
        }
        else {
            text += cursor.consume().value;
        }
    }
    return text.trim();
}
function skipGroup(cursor) {
    cursor.skipWhitespace();
    if (cursor.check(TokenKind.LBRACE)) {
        collectBraceText(cursor);
    }
}
function skipCommandArgs(cursor) {
    cursor.skipWhitespace();
    if (cursor.check(TokenKind.LBRACKET))
        collectBracketText(cursor);
    cursor.skipWhitespace();
    if (cursor.check(TokenKind.LBRACE))
        collectBraceText(cursor);
}
// ── Utility helpers ────────────────────────────────────────────────────────
function makeTextNode(content, pos) {
    return { type: 'text', content, pos };
}
function flattenToText(nodes) {
    return nodes.map(n => {
        if (n.type === 'text')
            return n.content;
        if (n.type === 'command')
            return '\\' + n.name;
        if (n.type === 'group')
            return flattenToText(n.children);
        return '';
    }).join('');
}
//# sourceMappingURL=index.js.map