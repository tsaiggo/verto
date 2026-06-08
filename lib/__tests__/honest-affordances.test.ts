import fs from 'fs/promises';
import path from 'path';
import { describe, expect, it } from 'vitest';

async function readProjectFile(file: string) {
  return fs.readFile(path.join(process.cwd(), file), 'utf-8');
}

describe('honest affordances', () => {
  it('does not expose unfinished rail navigation actions', async () => {
    const source = await readProjectFile('components/layout/RailContent.tsx');

    expect(source).not.toContain('label: "Bookmarks"');
    expect(source).not.toContain('<Settings className="app-rail-link-icon"');
    expect(source).not.toContain('<span className="flex-1">Settings</span>');
  });

  it('does not present the top breadcrumb as a dropdown or fake sync action', async () => {
    const source = await readProjectFile('components/layout/TopBar.tsx');

    expect(source).not.toContain('app-topbar-crumb-chevron');
    expect(source).not.toContain('app-topbar-sync');
    expect(source).not.toContain('Up to date');
  });

  it('does not render decorative controls as if they were interactive', async () => {
    const home = await readProjectFile('app/page.tsx');
    const search = await readProjectFile('components/search/SearchView.tsx');

    expect(home).not.toContain('<MoreHorizontal');
    expect(search).not.toContain('className="search-select"');
    expect(search).not.toContain('search-filters-pill');
    expect(search).not.toContain('All repositories');
  });

  it('links source management to the integrations page', async () => {
    const search = await readProjectFile('components/search/SearchView.tsx');

    expect(search).toContain('href="/integrations"');
    expect(search).toContain('Manage sources');
  });

  it('keeps connect source provider cards balanced and on the shared card scale', async () => {
    const css = await readProjectFile('app/globals.css');

    // Connect has four providers, so it uses a balanced 4/2/1 grid while
    // borrowing Home source-card scale values for border and icon sizing.
    expect(css).toMatch(/\.connect-cards\s*{[^}]*repeat\(4, minmax\(0, 1fr\)\)/s);
    expect(css).toMatch(/@media \(max-width: 860px\)\s*{[^}]*\.connect-cards\s*{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s);
    expect(css).not.toContain('border: 1.5px solid var(--border)');
    expect(css).toMatch(/\.connect-card-icon\s*{[^}]*width: 34px;[^}]*height: 34px;[^}]*border-radius: 9px;/s);
    expect(css).not.toContain('font-weight: 650');
  });
});
