// types.verify.ts — compile-time exhaustiveness check for RenderNode discriminated union.
// This file must compile with zero errors. If a case is missing, tsc reports
// "Argument of type '...' is not assignable to parameter of type 'never'".
// DO NOT REMOVE OR WEAKEN THIS FILE.
import type { RenderNode } from './types.js'
function assertNever(x: never): never {
  throw new Error('Unhandled node type: ' + (x as { type: string }).type)
}
export function visitAll(node: RenderNode): void {
  switch (node.type) {
    case 'document': break
    case 'section': break
    case 'paragraph': break
    case 'text': break
    case 'inlineCode': break
    case 'bold': break
    case 'italic': break
    case 'underline': break
    case 'color': break
    case 'table': break
    case 'tableRow': break
    case 'tableCell': break
    case 'tableRule': break
    case 'figure': break
    case 'image': break
    case 'caption': break
    case 'mathInline': break
    case 'mathDisplay': break
    case 'codeBlock': break
    case 'list': break
    case 'listItem': break
    case 'customBox': break
    case 'link': break
    case 'reference': break
    case 'toc': break
    case 'titlePage': break
    case 'center': break
    case 'abstract': break
    case 'tikz': break
    case 'plot': break
    case 'hRule': break
    case 'pageBreak': break
    case 'styledText': break
    default: assertNever(node)
  }
}
