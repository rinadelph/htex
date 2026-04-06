// =============================================================================
// @htex/core — types.ts
// Central type definitions for the entire library.
// No implementation — only interfaces, enums, and type aliases.
// =============================================================================
// ---------------------------------------------------------------------------
// TOKEN TYPES
// ---------------------------------------------------------------------------
export var TokenKind;
(function (TokenKind) {
    TokenKind["COMMAND"] = "COMMAND";
    TokenKind["ENV_BEGIN"] = "ENV_BEGIN";
    TokenKind["ENV_END"] = "ENV_END";
    TokenKind["TEXT"] = "TEXT";
    TokenKind["MATH_INLINE"] = "MATH_INLINE";
    TokenKind["MATH_DISPLAY"] = "MATH_DISPLAY";
    TokenKind["LBRACE"] = "LBRACE";
    TokenKind["RBRACE"] = "RBRACE";
    TokenKind["LBRACKET"] = "LBRACKET";
    TokenKind["RBRACKET"] = "RBRACKET";
    TokenKind["AMPERSAND"] = "AMPERSAND";
    TokenKind["NEWLINE"] = "NEWLINE";
    TokenKind["COMMENT"] = "COMMENT";
    TokenKind["WHITESPACE"] = "WHITESPACE";
    TokenKind["VERBATIM"] = "VERBATIM";
    TokenKind["EOF"] = "EOF";
})(TokenKind || (TokenKind = {}));
export const DEFAULT_FONT_CONFIG = {
    body: '16px serif',
    heading: 'bold 20px serif',
    mono: '14px monospace',
    lineHeight: 24,
};
// ---------------------------------------------------------------------------
// ERROR TYPES
// ---------------------------------------------------------------------------
export class HtexError extends Error {
    context;
    name = 'HtexError';
    constructor(message, context) {
        super(message);
        this.context = context;
    }
}
export class ParseError extends HtexError {
    line;
    col;
    name = 'ParseError';
    constructor(message, line, col, context) {
        super(`[${line}:${col}] ${message}`, context);
        this.line = line;
        this.col = col;
    }
}
export class TransformError extends HtexError {
    nodeType;
    name = 'TransformError';
    constructor(message, nodeType, context) {
        super(message, context);
        this.nodeType = nodeType;
    }
}
export class MeasureError extends HtexError {
    font;
    name = 'MeasureError';
    constructor(message, font, context) {
        super(message, context);
        this.font = font;
    }
}
export class RenderError extends HtexError {
    renderTarget;
    name = 'RenderError';
    constructor(message, renderTarget, context) {
        super(message, context);
        this.renderTarget = renderTarget;
    }
}
//# sourceMappingURL=types.js.map