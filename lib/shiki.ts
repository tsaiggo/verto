import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import {
  transformerNotationHighlight,
  transformerNotationDiff,
  transformerNotationFocus,
  transformerNotationWordHighlight,
  transformerMetaHighlight,
  transformerMetaWordHighlight,
} from '@shikijs/transformers';
import type { ShikiTransformer } from 'shiki';

// Import ONLY needed language grammars
import langTypescript from 'shiki/langs/typescript.mjs';
import langJavascript from 'shiki/langs/javascript.mjs';
import langJsx from 'shiki/langs/jsx.mjs';
import langTsx from 'shiki/langs/tsx.mjs';
import langJson from 'shiki/langs/json.mjs';
import langBash from 'shiki/langs/bash.mjs';
import langCss from 'shiki/langs/css.mjs';
import langHtml from 'shiki/langs/html.mjs';
import langMarkdown from 'shiki/langs/markdown.mjs';
import langMdx from 'shiki/langs/mdx.mjs';
import langDiff from 'shiki/langs/diff.mjs';
import langYaml from 'shiki/langs/yaml.mjs';
import langPython from 'shiki/langs/python.mjs';

// Import ONLY needed themes
import themeGithubLight from 'shiki/themes/github-light.mjs';
import themeGithubDark from 'shiki/themes/github-dark.mjs';

let highlighter: Awaited<ReturnType<typeof createHighlighterCore>> | null =
  null;

export async function getHighlighter() {
  if (!highlighter) {
    highlighter = await createHighlighterCore({
      themes: [themeGithubLight, themeGithubDark],
      langs: [
        langTypescript,
        langJavascript,
        langJsx,
        langTsx,
        langJson,
        langBash,
        langCss,
        langHtml,
        langMarkdown,
        langMdx,
        langDiff,
        langYaml,
        langPython,
      ],
      engine: createOnigurumaEngine(import('shiki/wasm')),
    });
  }
  return highlighter;
}

export async function getRehypeShikiPlugin() {
  const hl = await getHighlighter();
  // rehypeShikiFromHighlighter returns a transformer, not a plugin factory.
  // Wrap it so unified's .use() receives a plugin that returns the transformer.
  // @ts-expect-error rehypeShikiFromHighlighter expects HighlighterGeneric but createHighlighterCore returns a narrower type
  const transformer = rehypeShikiFromHighlighter(hl, {
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    defaultColor: false, // Use CSS variables for theme switching
    transformers: [
      transformerNotationHighlight(),
      transformerNotationDiff(),
      transformerNotationFocus(),
      transformerNotationWordHighlight(),
      transformerMetaHighlight(),
      transformerMetaWordHighlight(),
      transformerCodeMeta(),
    ],
  });
  // Return a proper unified plugin (a function that returns the transformer)
  const plugin = () => transformer;
  return plugin;
}

/**
 * Custom transformer that pulls extra metadata out of the fence info string
 * (e.g. `title="x.ts" showLineNumbers`) and exposes it as `data-*`
 * attributes on the wrapping `<pre>` for the React `CodeBlock` to consume.
 *
 * Recognised tokens:
 *   - `title="…"` or `filename="…"` → `data-title`
 *   - `showLineNumbers`             → `data-line-numbers="true"`
 *   - `noCopy`                      → `data-no-copy="true"`
 */
function transformerCodeMeta(): ShikiTransformer {
  return {
    name: 'verto:code-meta',
    pre(node) {
      const meta = (this.options.meta?.__raw ?? '') as string;
      if (!meta) return;
      const titleMatch = meta.match(/(?:title|filename)\s*=\s*"([^"]+)"/);
      if (titleMatch) {
        node.properties['data-title'] = titleMatch[1];
      }
      if (/\bshowLineNumbers\b/.test(meta)) {
        node.properties['data-line-numbers'] = 'true';
      }
      if (/\bnoCopy\b/.test(meta)) {
        node.properties['data-no-copy'] = 'true';
      }
    },
  };
}
