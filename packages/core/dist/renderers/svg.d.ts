import type { RenderNode, RenderTree, RenderOptions } from '../types.js';
export interface SvgRenderOptions extends RenderOptions {
    /** Total SVG width in pixels. Defaults to 900. */
    readonly svgWidth?: number;
    /** If true, wraps in full SVG document with xml declaration. Defaults to true. */
    readonly standalone?: boolean;
}
export declare function renderToSvg(tree: RenderTree | readonly RenderNode[], options?: SvgRenderOptions): string;
//# sourceMappingURL=svg.d.ts.map