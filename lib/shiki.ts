import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { transformerNotationHighlight } from '@shikijs/transformers';

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
  const transformer = rehypeShikiFromHighlighter(hl as any, {
    themes: {
      light: 'github-light',
      dark: 'github-dark',
    },
    defaultColor: false, // Use CSS variables for theme switching
    transformers: [transformerNotationHighlight()],
  });
  // Return a proper unified plugin (a function that returns the transformer)
  const plugin = () => transformer;
  return plugin;
}
