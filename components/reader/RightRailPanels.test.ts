import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RightRailPanels from '@/components/reader/RightRailPanels';

vi.mock('@/components/assistant/AssistantPanel', () => ({
  default: () => createElement('section', { 'aria-label': 'Assistant' }, 'Assistant'),
}));

vi.mock('@/components/summary/SummaryCard', () => ({
  default: () => createElement('section', { 'aria-label': 'Summary' }, 'Summary'),
}));

describe('RightRailPanels', () => {
  it('omits the source status card in article right rails', () => {
    const html = renderToStaticMarkup(
      createElement(RightRailPanels, {
        doc: { href: '/read/docs', slug: ['docs'], title: 'Docs' },
      }),
    );

    expect(html).not.toContain('Connected to');
    expect(html).not.toContain('Source status');
    expect(html).toContain('Need help?');
  });
});
