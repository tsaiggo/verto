import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import Compare from '@/components/mdx/Compare';
import { Timeline, TimelineItem } from '@/components/mdx/Timeline';

describe('Compare', () => {
  it('renders side mode with titles and columns', () => {
    const html = renderToStaticMarkup(
      createElement(
        Compare,
        { mode: 'side', titles: ['A', 'B'] },
        createElement('div', null, 'left'),
        createElement('div', null, 'right'),
      ),
    );
    expect(html).toContain('compare-side');
    expect(html).toContain('compare-side-header');
    expect(html).toContain('>A<');
    expect(html).toContain('>B<');
    expect(html).toContain('left');
    expect(html).toContain('right');
    expect(html).toContain('--compare-cols:2');
  });

  it('renders slider mode with before/after images', () => {
    const html = renderToStaticMarkup(
      createElement(Compare, {
        before: '/before.png',
        after: '/after.png',
        beforeLabel: 'Old',
        afterLabel: 'New',
      }),
    );
    expect(html).toContain('compare-slider');
    expect(html).toContain('src="/before.png"');
    expect(html).toContain('src="/after.png"');
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-valuenow="50"');
    expect(html).toContain('Old');
    expect(html).toContain('New');
  });
});

describe('Timeline', () => {
  it('renders items with status and tags', () => {
    const html = renderToStaticMarkup(
      createElement(
        Timeline,
        null,
        createElement(
          TimelineItem,
          { date: '2024-06', title: 'Release', status: 'done', tags: ['v1'] },
          'Body text',
        ),
        createElement(TimelineItem, {
          date: '2024-09',
          title: 'Plugins',
          status: 'doing',
        }),
      ),
    );
    expect(html).toContain('class="timeline"');
    expect(html).toContain('data-orientation="vertical"');
    expect(html).toContain('data-status="done"');
    expect(html).toContain('data-status="doing"');
    expect(html).toContain('Release');
    expect(html).toContain('Body text');
    expect(html).toContain('v1');
    // Date is formatted to month-year, not raw string
    expect(html).not.toContain('>2024-06<');
  });

  it('renders horizontal orientation', () => {
    const html = renderToStaticMarkup(
      createElement(
        Timeline,
        { orientation: 'horizontal' },
        createElement(TimelineItem, { title: 'One' }),
      ),
    );
    expect(html).toContain('data-orientation="horizontal"');
  });

  it('wraps item in an external link when href is absolute', () => {
    const html = renderToStaticMarkup(
      createElement(TimelineItem, {
        title: 'External',
        href: 'https://example.com',
      }),
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('is-link');
  });

  it('falls back to raw date string when unparseable', () => {
    const html = renderToStaticMarkup(
      createElement(TimelineItem, { title: 'Q1', date: '2025-Q1' }),
    );
    expect(html).toContain('2025-Q1');
  });
});
