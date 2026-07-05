import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

async function readProjectFile(file: string) {
  return fs.readFile(path.join(process.cwd(), file), "utf-8");
}

describe("honest affordances", () => {
  it("does not expose unfinished rail navigation actions", async () => {
    const source = await readProjectFile("components/layout/RailContent.tsx");

    expect(source).not.toContain('label: "Bookmarks"');
    expect(source).not.toContain('<Settings className="app-rail-link-icon"');
    expect(source).not.toContain('<span className="flex-1">Settings</span>');
  });

  it("does not present the top breadcrumb as a dropdown or fake sync action", async () => {
    const source = await readProjectFile("components/layout/TopBar.tsx");

    expect(source).not.toContain("app-topbar-crumb-chevron");
    expect(source).not.toContain("app-topbar-sync");
    expect(source).not.toContain("Up to date");
  });

  it("does not render decorative controls as if they were interactive", async () => {
    const home = await readProjectFile("app/page.tsx");
    const search = await readProjectFile("components/search/SearchView.tsx");

    expect(home).toContain('aria-label="More home actions"');
    expect(home).toContain("<MoreHorizontal");
    expect(search).not.toContain('className="search-select"');
    expect(search).not.toContain("search-filters-pill");
    expect(search).not.toContain("All repositories");
  });

  it("links source management to the integrations page", async () => {
    const search = await readProjectFile("components/search/SearchView.tsx");

    expect(search).toContain('href="/integrations"');
    expect(search).toContain("Manage sources");
  });

  it("keeps connect source provider cards balanced and on the shared card scale", async () => {
    const css = await readProjectFile("app/globals.css");

    // Connect now renders four providers on the same two-column card scale used
    // elsewhere, then collapses to a single column on phones.
    expect(css).toMatch(/\.connect-cards\s*{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s);
    expect(css).toContain("@media (max-width: 640px) {\n  .connect-page");
    expect(css).toContain(".connect-cards {\n    grid-template-columns: 1fr;");
    expect(css).not.toContain("border: 1.5px solid var(--border)");
    expect(css).toMatch(/\.connect-card-icon\s*{[^}]*width: 26px;[^}]*height: 26px;/s);
    expect(css).not.toContain(".connect-save");
  });

  it("uses shared connect source card icons and form actions", async () => {
    const connectView = await readProjectFile("components/integrations/ConnectSourceView.tsx");

    expect(connectView).toContain('<Icon className="h-5 w-5" />');
    expect(connectView).not.toContain('<Icon className="h-6 w-6" />');
    expect(connectView).not.toContain('className="connect-save"');
  });
});
