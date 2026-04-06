function assertNever(x) {
    throw new Error('Unhandled node type: ' + x.type);
}
export function visitAll(node) {
    switch (node.type) {
        case 'document': break;
        case 'section': break;
        case 'paragraph': break;
        case 'text': break;
        case 'inlineCode': break;
        case 'bold': break;
        case 'italic': break;
        case 'underline': break;
        case 'color': break;
        case 'table': break;
        case 'tableRow': break;
        case 'tableCell': break;
        case 'tableRule': break;
        case 'figure': break;
        case 'image': break;
        case 'caption': break;
        case 'mathInline': break;
        case 'mathDisplay': break;
        case 'codeBlock': break;
        case 'list': break;
        case 'listItem': break;
        case 'customBox': break;
        case 'link': break;
        case 'reference': break;
        case 'toc': break;
        case 'titlePage': break;
        case 'center': break;
        case 'abstract': break;
        case 'tikz': break;
        case 'plot': break;
        case 'hRule': break;
        case 'pageBreak': break;
        case 'styledText': break;
        default: assertNever(node);
    }
}
//# sourceMappingURL=types.verify.js.map