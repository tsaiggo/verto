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

function desktopTocSidebarRule(css: string) {
  const selectorStart = css.indexOf('.docs-layout > .toc-sidebar');
  expect(selectorStart).toBeGreaterThanOrEqual(0);

  const blockStart = css.indexOf('{', selectorStart);
  const blockEnd = css.indexOf('}', blockStart);
  return css.slice(blockStart + 1, blockEnd);
}

function sourcePanelValueRule(css: string) {
  const selectorStart = css.indexOf('.source-panel-row dd');
  expect(selectorStart).toBeGreaterThanOrEqual(0);

  const blockStart = css.indexOf('{', selectorStart);
  const blockEnd = css.indexOf('}', blockStart);
  return css.slice(blockStart + 1, blockEnd);
}

function sourcePanelRowRule(css: string) {
  const selectorStart = css.indexOf('.source-panel-row {');
  expect(selectorStart).toBeGreaterThanOrEqual(0);

  const blockStart = css.indexOf('{', selectorStart);
  const blockEnd = css.indexOf('}', blockStart);
  return css.slice(blockStart + 1, blockEnd);
}

function sourcePanelBadgeRule(css: string) {
  const selectorStart = css.indexOf('.source-panel-badge {');
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

  it('keeps the desktop document rail in the page flow instead of adding a second scrollbar', async () => {
    const css = await readProjectFile('app/globals.css');
    const tocSidebarRule = desktopTocSidebarRule(css);

    expect(tocSidebarRule).toContain('align-self: flex-start');
    expect(tocSidebarRule).not.toContain('height: calc(100vh - var(--navbar-h))');
    expect(tocSidebarRule).not.toContain('overflow-y: auto');
  });

  it('lets source panel values wrap instead of truncating connected Docs details', async () => {
    const css = await readProjectFile('app/globals.css');
    const rowRule = sourcePanelRowRule(css);
    const valueRule = sourcePanelValueRule(css);

    expect(rowRule).toContain('flex-direction: column');
    expect(rowRule).not.toContain('justify-content: space-between');
    expect(valueRule).toContain('min-width: 0');
    expect(valueRule).toContain('white-space: normal');
    expect(valueRule).toContain('overflow-wrap: anywhere');
    expect(valueRule).toContain('text-align: left');
    expect(valueRule).not.toContain('text-align: right');
    expect(valueRule).not.toContain('text-overflow: ellipsis');
    expect(valueRule).not.toContain('overflow: hidden');
  });

  it('keeps the source status badge intact beside wrapped titles', async () => {
    const css = await readProjectFile('app/globals.css');
    const badgeRule = sourcePanelBadgeRule(css);

    expect(badgeRule).toContain('flex-shrink: 0');
    expect(badgeRule).toContain('white-space: nowrap');
  });
});
