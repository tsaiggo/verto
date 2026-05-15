import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import Steps from '@/components/mdx/Steps';
import { Card, CardGroup } from '@/components/mdx/Card';
import FileTree, { Folder, File } from '@/components/mdx/FileTree';

describe('Steps', () => {
  it('wraps children in a .steps container', () => {
    const html = renderToStaticMarkup(
      createElement(Steps, null, createElement('h3', null, 'First')),
    );
    expect(html).toContain('class="steps"');
    expect(html).toContain('<h3>First</h3>');
  });
});

describe('Card / CardGroup', () => {
  it('renders a card with title and description', () => {
    const html = renderToStaticMarkup(
      createElement(Card, { title: 'Hello', description: 'World' }),
    );
    expect(html).toContain('class="card"');
    expect(html).toContain('Hello');
    expect(html).toContain('World');
  });

  it('uses anchor for external links', () => {
    const html = renderToStaticMarkup(
      createElement(Card, { title: 'Ext', href: 'https://example.com' }),
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
  });

  it('passes cols through as a CSS variable', () => {
    const html = renderToStaticMarkup(
      createElement(CardGroup, { cols: 3 }, null),
    );
    expect(html).toContain('--card-cols:3');
  });
});

describe('FileTree', () => {
  it('renders nested folders and files with the right markup', () => {
    const html = renderToStaticMarkup(
      createElement(
        FileTree,
        null,
        createElement(
          Folder,
          { name: 'content', defaultOpen: true },
          createElement(File, { name: 'intro.md' }),
          createElement(File, { name: 'config.json', comment: 'overrides' }),
        ),
      ),
    );
    expect(html).toContain('class="file-tree"');
    expect(html).toContain('content/');
    expect(html).toContain('intro.md');
    expect(html).toContain('config.json');
    expect(html).toContain('overrides');
  });
});
