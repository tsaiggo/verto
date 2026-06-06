import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

async function readProjectFile(file: string) {
  return fs.readFile(path.join(process.cwd(), file), 'utf-8');
}

describe('accessibility primitives', () => {
  it('exposes a skip link to the application main content', async () => {
    const source = await readProjectFile('components/layout/AppShellClient.tsx');

    expect(source).toContain('href="#main-content"');
    expect(source).toContain('Skip to content');
    expect(source).toContain('id="main-content"');
    expect(source).toContain('tabIndex={-1}');
  });

  it('honors reduced motion preferences for global motion primitives', async () => {
    const css = await readProjectFile('app/globals.css');

    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('scroll-behavior: auto');
    expect(css).toContain('transition-duration: 0.01ms');
    expect(css).toContain('animation-duration: 0.01ms');
  });

  it('keeps read route content from nesting another main landmark', async () => {
    const readPage = await readProjectFile('app/read/[[...path]]/page.tsx');
    const tagPage = await readProjectFile('app/read/tags/[tag]/page.tsx');

    expect(readPage).not.toContain('<main className="main"');
    expect(tagPage).not.toContain('<main className="main"');
  });
});
