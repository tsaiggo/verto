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
});
