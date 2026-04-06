import type { RenderNode, RenderTree, FontConfig } from '../types.js';
export declare function getMeasurementCacheSize(): number;
export declare function clearMeasurementCache(): void;
export declare function setMeasurementLocale(locale: string): void;
export declare function measure(tree: RenderTree | RenderNode[], config?: Partial<FontConfig> & {
    maxWidth?: number;
}): Promise<RenderNode[]>;
/** Synchronous measurement using heuristics (SSR-safe) */
export declare function measureSync(tree: RenderTree | RenderNode[], config?: Partial<FontConfig> & {
    maxWidth?: number;
}): RenderNode[];
export declare function measureTableColumns(tableNode: Extract<RenderNode, {
    type: 'table';
}>, config?: Partial<FontConfig>): Promise<number[]>;
/** Cheap re-layout after viewport resize — no canvas calls */
export declare function relayout(tree: RenderNode[], newMaxWidth: number, config?: Partial<FontConfig>): RenderNode[];
//# sourceMappingURL=index.d.ts.map