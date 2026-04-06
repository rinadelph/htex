// =============================================================================
// @htex/vue — Vue 3 adapter for @htex/core
//
// Provides Vue 3 composable and components for rendering LaTeX documents.
//
// USAGE:
//   import { HtexDocument, useHtex } from '@htex/vue'
//   // In template: <HtexDocument :source="myLatex" theme="dark" />
//   // In setup:    const { html } = useHtex(computed(() => myLatex.value))
// =============================================================================
export const VERSION = '0.1.0';
import { ref, computed, watch, defineComponent, h } from 'vue';
import { latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
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
export function useHtex(source, options = {}) {
    const sourceRef = typeof source === 'string' ? ref(source) : source;
    const error = ref(null);
    const tree = computed(() => {
        try {
            error.value = null;
            return latexToRenderTree(sourceRef.value, options);
        }
        catch (err) {
            error.value = err instanceof Error ? err : new Error(String(err));
            return null;
        }
    });
    const html = computed(() => {
        if (!tree.value)
            return '';
        try {
            return renderToHtml(tree.value, { ...options, standalone: false });
        }
        catch (err) {
            return `<div class="htex-error">${String(err)}</div>`;
        }
    });
    const svg = computed(() => {
        if (!tree.value)
            return '';
        try {
            return renderToSvg(tree.value, { ...options, standalone: false });
        }
        catch (err) {
            return '';
        }
    });
    return { html, svg, tree, error };
}
// ── HtexDocument component ────────────────────────────────────────────────
/**
 * HtexDocument — Vue 3 component for rendering a LaTeX document.
 *
 * @example
 * ```vue
 * <HtexDocument :source="myLatex" theme="dark" class="paper" />
 * ```
 */
export const HtexDocument = defineComponent({
    name: 'HtexDocument',
    props: {
        source: { type: String, required: true },
        theme: { type: String, default: 'light' },
        target: { type: String, default: 'html' },
        className: { type: String, default: 'htex-document' },
        mathEngine: { type: String, default: undefined },
        codeHighlighter: { type: String, default: undefined },
    },
    emits: ['rendered', 'error'],
    setup(props, { emit }) {
        const sourceRef = computed(() => props.source);
        const { html, svg, error } = useHtex(sourceRef, {
            theme: props.theme,
            mathEngine: props.mathEngine,
            codeHighlighter: props.codeHighlighter,
        });
        watch(error, (err) => { if (err)
            emit('error', err); });
        watch(html, (val) => emit('rendered', val));
        return () => h('div', {
            class: props.className,
            innerHTML: props.target === 'svg' ? svg.value : html.value,
        });
    },
});
// ── HtexFragment component ────────────────────────────────────────────────
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
export const HtexFragment = defineComponent({
    name: 'HtexFragment',
    props: {
        source: { type: String, required: true },
        theme: { type: String, default: 'light' },
        tag: { type: String, default: 'span' },
    },
    setup(props) {
        const fullSource = computed(() => {
            const src = props.source;
            return src.includes('\\begin{document}')
                ? src
                : `\\begin{document}${src}\\end{document}`;
        });
        const { html } = useHtex(fullSource, {
            theme: props.theme,
        });
        return () => h(props.tag, { innerHTML: html.value });
    },
});
// ── Vue plugin ────────────────────────────────────────────────────────────
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
export const HtexPlugin = {
    install(app) {
        app.component('HtexDocument', HtexDocument);
        app.component('HtexFragment', HtexFragment);
    },
};
export default HtexPlugin;
// ── Re-exports ────────────────────────────────────────────────────────────
export { latexToHtml, latexToSvg, latexToRenderTree, renderToHtml, renderToSvg, } from '@htex/core';
//# sourceMappingURL=index.js.map