export declare const VERSION = "0.1.0";
import type { Ref, ComputedRef } from 'vue';
import type { RenderTree, ConvertOptions, Theme } from '@htex/core';
import type { HtmlRenderOptions } from '@htex/core';
export type { RenderTree, ConvertOptions, Theme };
export type RenderTarget = 'html' | 'svg';
export interface VueHtexOptions extends ConvertOptions, HtmlRenderOptions {
    target?: RenderTarget;
    svgWidth?: number;
}
export interface UseHtexResult {
    html: ComputedRef<string>;
    svg: ComputedRef<string>;
    tree: ComputedRef<RenderTree | null>;
    error: Ref<Error | null>;
}
/**
 * useHtex — Vue 3 composable for rendering LaTeX.
 * Reactively recomputes when `source` or `options` change.
 *
 * @example
 * ```vue
 * <script setup>
 * import { ref } from 'vue'
 * import { useHtex } from '@htex/vue'
 * const latex = ref('\\begin{document}Hello $x^2$\\end{document}')
 * const { html } = useHtex(latex)
 * </script>
 * <template>
 *   <div v-html="html" />
 * </template>
 * ```
 */
export declare function useHtex(source: Ref<string> | string, options?: VueHtexOptions): UseHtexResult;
/**
 * HtexDocument — Vue 3 component for rendering a LaTeX document.
 *
 * @example
 * ```vue
 * <HtexDocument :source="myLatex" theme="dark" class="paper" />
 * ```
 */
export declare const HtexDocument: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    source: {
        type: StringConstructor;
        required: true;
    };
    theme: {
        type: () => Theme;
        default: string;
    };
    target: {
        type: () => RenderTarget;
        default: string;
    };
    className: {
        type: StringConstructor;
        default: string;
    };
    mathEngine: {
        type: StringConstructor;
        default: undefined;
    };
    codeHighlighter: {
        type: StringConstructor;
        default: undefined;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, ("rendered" | "error")[], "rendered" | "error", import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    source: {
        type: StringConstructor;
        required: true;
    };
    theme: {
        type: () => Theme;
        default: string;
    };
    target: {
        type: () => RenderTarget;
        default: string;
    };
    className: {
        type: StringConstructor;
        default: string;
    };
    mathEngine: {
        type: StringConstructor;
        default: undefined;
    };
    codeHighlighter: {
        type: StringConstructor;
        default: undefined;
    };
}>> & Readonly<{
    onRendered?: (...args: any[]) => any;
    onError?: (...args: any[]) => any;
}>, {
    theme: Theme;
    mathEngine: string;
    codeHighlighter: string;
    target: RenderTarget;
    className: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/**
 * HtexFragment — Vue 3 component for rendering a LaTeX fragment inline.
 *
 * @example
 * ```vue
 * <span>
 *   See <HtexFragment source="$E = mc^2$" /> for the energy equation.
 * </span>
 * ```
 */
export declare const HtexFragment: import("vue").DefineComponent<import("vue").ExtractPropTypes<{
    source: {
        type: StringConstructor;
        required: true;
    };
    theme: {
        type: () => Theme;
        default: string;
    };
    tag: {
        type: StringConstructor;
        default: string;
    };
}>, () => import("vue").VNode<import("vue").RendererNode, import("vue").RendererElement, {
    [key: string]: any;
}>, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<import("vue").ExtractPropTypes<{
    source: {
        type: StringConstructor;
        required: true;
    };
    theme: {
        type: () => Theme;
        default: string;
    };
    tag: {
        type: StringConstructor;
        default: string;
    };
}>> & Readonly<{}>, {
    theme: Theme;
    tag: string;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
/**
 * Vue plugin — registers HtexDocument and HtexFragment globally.
 *
 * @example
 * ```ts
 * import { createApp } from 'vue'
 * import HtexPlugin from '@htex/vue'
 * createApp(App).use(HtexPlugin).mount('#app')
 * ```
 */
export declare const HtexPlugin: {
    install(app: {
        component: (name: string, comp: unknown) => void;
    }): void;
};
export default HtexPlugin;
export { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
//# sourceMappingURL=index.d.ts.map