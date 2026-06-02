import type { ASTNode, DocumentAST, RenderNode, RenderTree, TOCEntry, TransformOptions } from '../types.js';
export interface TransformContext {
    colors: Map<string, string>;
    customEnvs: Map<string, {
        borderColor: string;
        bgColor: string;
    }>;
    macros: Map<string, {
        argCount: number;
        body: ASTNode[];
    }>;
    labels: Map<string, string>;
    sectionCounters: [number, number, number];
    tocEntries: TOCEntry[];
    options: TransformOptions;
    docTitle: string;
    docAuthor: string;
    docDate: string;
    tikzCounter: number;
    footnoteCounter: number;
    footnotes: Array<{
        id: string;
        number: number;
        content: RenderNode[];
    }>;
    endnoteCounter: number;
    endnotes: Array<{
        id: string;
        number: number;
        content: RenderNode[];
    }>;
}
export declare function transform(ast: DocumentAST, options?: TransformOptions): RenderTree;
//# sourceMappingURL=index.d.ts.map