// =============================================================================
// @htex/core — measurement/index.ts
// Text measurement service wrapping @chenglou/pretext.
// Walks the RenderTree and attaches LayoutHints to text-bearing nodes.
// =============================================================================
import { DEFAULT_FONT_CONFIG } from '../types.js';
let _pretext = null;
let _loadPromise = null;
async function loadPretext() {
    if (_pretext)
        return _pretext;
    if (_loadPromise)
        return _loadPromise;
    _loadPromise = (async () => {
        try {
            const mod = await import('@chenglou/pretext');
            _pretext = mod;
            return _pretext;
        }
        catch {
            // SSR / no-canvas environment — fall back to heuristics
            return null;
        }
    })();
    return _loadPromise;
}
// ── Cache ─────────────────────────────────────────────────────────────────
// Map<fontString, Map<textContent, PreparedText>>
const _cache = new Map();
export function getMeasurementCacheSize() {
    let total = 0;
    for (const m of _cache.values())
        total += m.size;
    return total;
}
export function clearMeasurementCache() {
    _cache.clear();
    if (_pretext?.clearCache)
        _pretext.clearCache();
}
export function setMeasurementLocale(locale) {
    if (_pretext)
        _pretext.setLocale(locale);
}
function getCached(font, text) {
    return _cache.get(font)?.get(text);
}
function setCached(font, text, prepared) {
    if (!_cache.has(font))
        _cache.set(font, new Map());
    _cache.get(font).set(text, prepared);
}
// ── Heuristic fallback (SSR / no canvas) ──────────────────────────────────
function heuristicMeasure(text, font, maxWidth, lineHeight) {
    // Rough approximation: 8px average character width at 16px, scale by font size
    const fontSize = parseFloat(font) || 16;
    const charWidth = fontSize * 0.5;
    const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));
    const lineCount = Math.max(1, Math.ceil(text.length / charsPerLine));
    return { height: lineCount * lineHeight, lineCount };
}
// ── Text extraction helpers ────────────────────────────────────────────────
function extractText(node) {
    if (node.type === 'text')
        return node.content;
    if ('children' in node && node.children) {
        return node.children.map(extractText).join(' ');
    }
    if (node.type === 'mathInline')
        return node.latex;
    if (node.type === 'mathDisplay')
        return node.latex;
    if (node.type === 'codeBlock')
        return node.code;
    return '';
}
// ── Main measure function ─────────────────────────────────────────────────
export async function measure(tree, config = {}) {
    const fontConfig = { ...DEFAULT_FONT_CONFIG, ...config };
    const maxWidth = config.maxWidth ?? 800;
    const pretext = await loadPretext();
    if (fontConfig.locale && pretext) {
        pretext.setLocale(fontConfig.locale);
    }
    return measureNodes(Array.from(tree), fontConfig, maxWidth, pretext);
}
/** Synchronous measurement using heuristics (SSR-safe) */
export function measureSync(tree, config = {}) {
    const fontConfig = { ...DEFAULT_FONT_CONFIG, ...config };
    const maxWidth = config.maxWidth ?? 800;
    return measureNodes(Array.from(tree), fontConfig, maxWidth, null);
}
function measureNodes(nodes, config, maxWidth, pretext) {
    return nodes.map(node => measureNode(node, config, maxWidth, pretext));
}
function measureNode(node, config, maxWidth, pretext) {
    const font = getFontForNode(node, config);
    const text = extractText(node);
    let layout;
    if (text.trim().length > 0) {
        if (pretext) {
            try {
                let prepared = getCached(font, text);
                if (!prepared) {
                    prepared = pretext.prepare(text, font);
                    setCached(font, text, prepared);
                }
                const result = pretext.layout(prepared, maxWidth, config.lineHeight);
                layout = { measuredHeight: result.height, lineCount: result.lineCount };
            }
            catch {
                // Fallback to heuristic
                const h = heuristicMeasure(text, font, maxWidth, config.lineHeight);
                layout = { measuredHeight: h.height, lineCount: h.lineCount };
            }
        }
        else {
            const h = heuristicMeasure(text, font, maxWidth, config.lineHeight);
            layout = { measuredHeight: h.height, lineCount: h.lineCount };
        }
    }
    // Recurse into children
    const withLayout = layout ? { ...node, layout } : node;
    if ('children' in withLayout && withLayout.children) {
        const measuredChildren = measureNodes(Array.from(withLayout.children), config, maxWidth, pretext);
        return { ...withLayout, children: measuredChildren };
    }
    return withLayout;
}
function getFontForNode(node, config) {
    switch (node.type) {
        case 'section':
            return config.heading;
        case 'codeBlock':
            return config.mono;
        case 'bold':
            return config.heading;
        default:
            return config.body;
    }
}
// ── Table column measurement ──────────────────────────────────────────────
export async function measureTableColumns(tableNode, config = {}) {
    const fontConfig = { ...DEFAULT_FONT_CONFIG, ...config };
    const pretext = await loadPretext();
    // Find max columns
    let maxCols = 0;
    const dataRows = tableNode.children.filter(r => r.type === 'tableRow');
    for (const row of dataRows) {
        if (row.type === 'tableRow')
            maxCols = Math.max(maxCols, row.children.length);
    }
    const colWidths = new Array(maxCols).fill(0);
    for (const row of dataRows) {
        if (row.type !== 'tableRow')
            continue;
        let colIdx = 0;
        for (const cell of row.children) {
            const text = cell.children.map(extractText).join(' ');
            let width = 0;
            if (pretext && text.trim()) {
                try {
                    let prepared = getCached(fontConfig.body, text);
                    if (!prepared) {
                        prepared = pretext.prepare(text, fontConfig.body);
                        setCached(fontConfig.body, text, prepared);
                    }
                    const result = pretext.layout(prepared, 9999, fontConfig.lineHeight);
                    // measureNaturalWidth not available in all versions — use layout at very wide width
                    width = text.length * 8; // fallback approximation
                    void result; // suppress unused
                }
                catch {
                    width = text.length * 8;
                }
            }
            else {
                width = text.length * 8;
            }
            const span = cell.colspan ?? 1;
            const perCol = width / span;
            for (let c = colIdx; c < colIdx + span && c < maxCols; c++) {
                colWidths[c] = Math.max(colWidths[c] ?? 0, perCol);
            }
            colIdx += span;
        }
    }
    return colWidths;
}
/** Cheap re-layout after viewport resize — no canvas calls */
export function relayout(tree, newMaxWidth, config = {}) {
    const fontConfig = { ...DEFAULT_FONT_CONFIG, ...config };
    return relayoutNodes(tree, newMaxWidth, fontConfig);
}
function relayoutNodes(nodes, maxWidth, config) {
    return nodes.map(node => relayoutNode(node, maxWidth, config));
}
function relayoutNode(node, maxWidth, config) {
    const text = extractText(node);
    let layout;
    if (text.trim().length > 0 && node.layout) {
        // Re-compute from cached prepared text (no canvas calls)
        const font = getFontForNode(node, config);
        const prepared = getCached(font, text);
        if (prepared && _pretext) {
            try {
                const result = _pretext.layout(prepared, maxWidth, config.lineHeight);
                layout = { measuredHeight: result.height, lineCount: result.lineCount };
            }
            catch {
                layout = heuristicMeasure(text, font, maxWidth, config.lineHeight);
            }
        }
        else {
            layout = heuristicMeasure(text, font, maxWidth, config.lineHeight);
        }
    }
    const withLayout = layout ? { ...node, layout } : node;
    if ('children' in withLayout && withLayout.children) {
        const relayoutedChildren = relayoutNodes(Array.from(withLayout.children), maxWidth, config);
        return { ...withLayout, children: relayoutedChildren };
    }
    return withLayout;
}
//# sourceMappingURL=index.js.map