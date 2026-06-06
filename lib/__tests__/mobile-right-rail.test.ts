import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

async function readProjectFile(file: string) {
  return fs.readFile(path.join(process.cwd(), file), 'utf-8');
}

function tabletTocSidebarRule(css: string) {
  const mediaStart = css.indexOf('@media (max-width: 1100px)');
  expect(mediaStart).toBeGreaterThanOrEqual(0);

  const selectorStart = css.indexOf('.docs-layout > .toc-sidebar', mediaStart);
  expect(selectorStart).toBeGreaterThanOrEqual(0);

  const blockStart = css.indexOf('{', selectorStart);
  const blockEnd = css.indexOf('}', blockStart);
  return css.slice(blockStart + 1, blockEnd);
}

function tabletMainRule(css: string) {
  const mediaStart = css.indexOf('@media (max-width: 1100px)');
  expect(mediaStart).toBeGreaterThanOrEqual(0);

  const selectorStart = css.indexOf('.docs-layout > .main', mediaStart);
  expect(selectorStart).toBeGreaterThanOrEqual(0);

  const blockStart = css.indexOf('{', selectorStart);
  const blockEnd = css.indexOf('}', blockStart);
  return css.slice(blockStart + 1, blockEnd);
}

function tabletRailPanelRule(css: string) {
  const mediaStart = css.indexOf('@media (max-width: 1100px)');
  expect(mediaStart).toBeGreaterThanOrEqual(0);

  const selectorStart = css.indexOf(
    '.docs-layout > .toc-sidebar > .rail-panel',
    mediaStart,
  );
  expect(selectorStart).toBeGreaterThanOrEqual(0);

  const blockStart = css.indexOf('{', selectorStart);
  const blockEnd = css.indexOf('}', blockStart);
  return css.slice(blockStart + 1, blockEnd);
}

describe('mobile right rail access', () => {
  it('keeps the document right rail reachable below desktop widths', async () => {
    const css = await readProjectFile('app/globals.css');
    const mainRule = tabletMainRule(css);
    const tocSidebarRule = tabletTocSidebarRule(css);
    const railPanelRule = tabletRailPanelRule(css);

    expect(mainRule).toContain('flex-basis: 100%');
    expect(mainRule).toContain('width: 100%');
    expect(tocSidebarRule).not.toContain('display: none');
    expect(tocSidebarRule).toContain('order: 2');
    expect(railPanelRule).toContain('width: 100%');
    expect(railPanelRule).toContain('max-width: var(--reading-max-w, 720px)');
  });
});
