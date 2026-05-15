import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

describe('rehype-mermaid', () => {
  it('rewrites ```mermaid fenced blocks into <mermaid-block>', async () => {
    const { compileMDXContent } = await import('@/lib/mdx');
    const { content } = await compileMDXContent(
      '```mermaid\nflowchart LR\n  A --> B\n```\n',
    );
    const html = renderToStaticMarkup(content);
    // Server-rendered output should NOT include a Shiki-highlighted <pre>
    expect(html).not.toContain('language-mermaid');
    // The MermaidBlock client component renders a wrapper with `mermaid` class
    expect(html).toContain('class="mermaid"');
  });

  it('leaves non-mermaid code blocks alone', async () => {
    const { compileMDXContent } = await import('@/lib/mdx');
    const { content } = await compileMDXContent(
      '```ts\nconst x = 1;\n```\n',
    );
    const html = renderToStaticMarkup(content);
    // Shiki should still emit a <pre> for normal languages
    expect(html).toContain('<pre');
  });
});
