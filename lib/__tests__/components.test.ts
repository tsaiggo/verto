import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import Steps from '@/components/mdx/Steps';
import { Card, CardGroup } from '@/components/mdx/Card';
import FileTree, { Folder, File } from '@/components/mdx/FileTree';
import { AccordionGroup } from '@/components/mdx/Accordion';
import Tabs from '@/components/mdx/Tabs';

interface CardGroupPropsForTest {
  cols?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}

interface TabsPropsForTest {
  children: React.ReactNode;
  id?: string;
  defaultValue?: string;
}

function AccordionCarrier(_props: {
  title: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  void _props;
  return null;
}

function TabCarrier(_props: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  void _props;
  return null;
}

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
    const props: CardGroupPropsForTest = { cols: 3, children: null };
    const html = renderToStaticMarkup(
      createElement(CardGroup, props, null),
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

describe('MDX compound components', () => {
  it('collects Accordion-shaped children without relying on component identity', () => {
    const html = renderToStaticMarkup(
      createElement(
        AccordionGroup,
        null,
        createElement(
          AccordionCarrier,
          { title: 'First panel', defaultOpen: true },
          'First body',
        ),
        createElement(AccordionCarrier, { title: 'Second panel' }, 'Second body'),
      ),
    );

    expect(html).toContain('First panel');
    expect(html).toContain('Second panel');
    expect(html).toContain('First body');
  });

  it('collects Tab-shaped children without relying on component identity', () => {
    const install = createElement(
      TabCarrier,
      { key: 'install', label: 'Install' },
      'npm install verto',
    );
    const usage = createElement(
      TabCarrier,
      { key: 'usage', label: 'Usage', value: 'usage' },
      'Run the reader',
    );
    const props: TabsPropsForTest = {
      defaultValue: 'usage',
      children: [install, usage],
    };
    const html = renderToStaticMarkup(
      createElement(Tabs, props, install, usage),
    );

    expect(html).toContain('Install');
    expect(html).toContain('Usage');
    expect(html).toContain('Run the reader');
  });
});
