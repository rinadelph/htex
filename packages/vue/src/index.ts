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

export const VERSION = '0.1.0'

import { ref, computed, watch, onUnmounted, defineComponent, h } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import {
  latexToHtml,
  latexToSvg,
  latexToRenderTree,
  renderToHtml,
  renderToSvg,
} from '@htex/core'
import type {
  RenderTree,
  ConvertOptions,
  Theme,
} from '@htex/core'
import type { HtmlRenderOptions } from '@htex/core'
import type { SvgRenderOptions } from '@htex/core'

export type { RenderTree, ConvertOptions, Theme }
export type RenderTarget = 'html' | 'svg'

export interface VueHtexOptions extends ConvertOptions, HtmlRenderOptions {
  target?: RenderTarget
  svgWidth?: number
}

// ── useHtex composable ────────────────────────────────────────────────────

export interface UseHtexResult {
  html: ComputedRef<string>
  svg: ComputedRef<string>
  tree: ComputedRef<RenderTree | null>
  error: Ref<Error | null>
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
export function useHtex(
  source: Ref<string> | string,
  options: VueHtexOptions = {},
): UseHtexResult {
  const sourceRef = typeof source === 'string' ? ref(source) : source
  const error = ref<Error | null>(null)

  const tree = computed<RenderTree | null>(() => {
    try {
      error.value = null
      return latexToRenderTree(sourceRef.value, options)
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      return null
    }
  })

  const html = computed<string>(() => {
    if (!tree.value) return ''
    try {
      return renderToHtml(tree.value, { ...options, standalone: false })
    } catch (err) {
      return `<div class="htex-error">${String(err)}</div>`
    }
  })

  const svg = computed<string>(() => {
    if (!tree.value) return ''
    try {
      return renderToSvg(tree.value, { ...options, standalone: false })
    } catch (err) {
      return ''
    }
  })

  return { html, svg, tree, error }
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
    theme: { type: String as () => Theme, default: 'light' },
    target: { type: String as () => RenderTarget, default: 'html' },
    className: { type: String, default: 'htex-document' },
    mathEngine: { type: String, default: undefined },
    codeHighlighter: { type: String, default: undefined },
  },
  emits: ['rendered', 'error'],
  setup(props, { emit }) {
    const sourceRef = computed(() => props.source)
    const { html, svg, error } = useHtex(sourceRef, {
      theme: props.theme as Theme,
      mathEngine: props.mathEngine as any,
      codeHighlighter: props.codeHighlighter as any,
    })

    watch(error, (err) => { if (err) emit('error', err) })
    watch(html, (val) => emit('rendered', val))

    return () => h('div', {
      class: props.className,
      innerHTML: props.target === 'svg' ? svg.value : html.value,
    })
  },
})

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
    theme: { type: String as () => Theme, default: 'light' },
    tag: { type: String, default: 'span' },
  },
  setup(props) {
    const fullSource = computed(() => {
      const src = props.source
      return src.includes('\\begin{document}')
        ? src
        : `\\begin{document}${src}\\end{document}`
    })

    const { html } = useHtex(fullSource, {
      theme: props.theme as Theme,
    })

    return () => h(props.tag, { innerHTML: html.value })
  },
})

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
  install(app: { component: (name: string, comp: unknown) => void }): void {
    app.component('HtexDocument', HtexDocument)
    app.component('HtexFragment', HtexFragment)
  },
}

export default HtexPlugin

// ── Re-exports ────────────────────────────────────────────────────────────
export {
  latexToHtml,
  latexToSvg,
  latexToRenderTree,
  renderToHtml,
  renderToSvg,
} from '@htex/core'
