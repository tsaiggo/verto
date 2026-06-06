import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

async function readProjectFile(file: string) {
  return fs.readFile(path.join(process.cwd(), file), 'utf-8');
}

describe('reader layout cleanup', () => {
  it('does not keep dead docs-layout sidebar rules', async () => {
    const css = await readProjectFile('app/globals.css');

    expect(css).not.toContain('.docs-layout > .sidebar');
  });

  it('does not render an empty right rail on tag pages', async () => {
    const tagPage = await readProjectFile('app/read/tags/[tag]/page.tsx');

    expect(tagPage).not.toContain('<aside className="toc-sidebar" />');
  });
});
