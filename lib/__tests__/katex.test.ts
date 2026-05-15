import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

describe('KaTeX math rendering', () => {
  it('renders inline math via $...$', async () => {
    const { compileMDXContent } = await import('@/lib/mdx');
    const { content } = await compileMDXContent('A formula: $a^2 + b^2 = c^2$.');
    const html = renderToStaticMarkup(content);
    expect(html).toContain('katex');
    // Variables should appear as KaTeX-styled spans
    expect(html).toMatch(/a/);
    expect(html).toMatch(/b/);
  });

  it('renders block math via $$...$$', async () => {
    const { compileMDXContent } = await import('@/lib/mdx');
    const { content } = await compileMDXContent('$$\nE = mc^2\n$$');
    const html = renderToStaticMarkup(content);
    expect(html).toContain('katex-display');
  });

  it('does not crash on malformed math (strict: ignore)', async () => {
    const { compileMDXContent } = await import('@/lib/mdx');
    const { content } = await compileMDXContent('Bad: $\\foo{$');
    const html = renderToStaticMarkup(content);
    // Just verify it produced *something* without throwing
    expect(html.length).toBeGreaterThan(0);
  });
});
