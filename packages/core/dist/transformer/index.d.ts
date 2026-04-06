import type { ASTNode, DocumentAST, RenderTree, TOCEntry, TransformOptions } from '../types.js';
export interface TransformContext {
    colors: Map<string, string>;
    customEnvs: Map<string, {
        borderColor: string;
        bgColor: string;
    }>;
    macros: Map<string, ASTNode[]>;
    labels: Map<string, string>;
    sectionCounters: [number, number, number];
    tocEntries: TOCEntry[];
    options: TransformOptions;
    docTitle: string;
    docAuthor: string;
    docDate: string;
    tikzCounter: number;
}
export declare function transform(ast: DocumentAST, options?: TransformOptions): RenderTree;
//# sourceMappingURL=index.d.ts.map