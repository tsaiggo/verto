import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

async function readProjectFile(file: string) {
  const raw = await fs.readFile(path.join(process.cwd(), file), "utf-8");
  // Normalise line endings so content assertions are stable across
  // platforms (git checks out CRLF on Windows).
  return raw.replace(/\r\n/g, "\n");
}

describe("honest affordances", () => {
  it("does not expose unfinished rail navigation actions", async () => {
    const source = await readProjectFile("components/layout/RailContent.tsx");

    expect(source).not.toContain('label: "Bookmarks"');
    expect(source).not.toContain('<Settings className="app-rail-link-icon"');
    expect(source).not.toContain('<span className="flex-1">Settings</span>');
  });

  it("does not present the top breadcrumb as a dropdown or fake sync action", async () => {
    const source = await readProjectFile("components/layout/VxTopBar.tsx");

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

  it("keeps source management on the Sources page with real actions", async () => {
    const source = await readProjectFile("app/integrations/page.tsx");

    expect(source).toContain("<LocalFolderPickerButton />");
    expect(source).toContain('href="/inbox"');
    expect(source).not.toContain('href="/integrations#local-files"');
    expect(source).not.toContain('href="/integrations/connect"');
  });

  it("only surfaces supported source types on the Sources page", async () => {
    const source = await readProjectFile("app/integrations/page.tsx");

    expect(source).toContain('name: "Local Files"');
    expect(source).toContain('name: "RSS"');
    expect(source).not.toContain('name: "GitHub"');
    expect(source).not.toContain('name: "OneDrive"');
    expect(source).not.toContain('name: "Google Drive"');
    expect(source).not.toContain('name: "Notion"');
    expect(source).not.toContain('name: "Dropbox"');
  });
  it("links source management to the integrations page", async () => {
    const search = await readProjectFile("components/search/SearchFilters.tsx");

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
    const connectView = await readProjectFile(
      "components/integrations/connect-source-sections.tsx"
    );

    expect(connectView).toContain('<Icon className="h-5 w-5" />');
    expect(connectView).not.toContain('<Icon className="h-6 w-6" />');
    expect(connectView).not.toContain('className="connect-save"');
  });

  it("removes the /git route — file should not exist on disk", async () => {
    const exists = await fs
      .access(path.join(process.cwd(), "app/git/page.tsx"))
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(false);
  });

  it("onboarding source step only offers Local Files and RSS", async () => {
    const source = await readProjectFile("app/onboarding/[step]/page.tsx");

    expect(source).not.toContain('"GitHub"');
    expect(source).not.toContain('"OneDrive"');
    expect(source).toContain("Local folder");
    expect(source).toContain("RSS feeds");
    expect(source).toContain('href="/integrations#local-files"');
    expect(source).toContain('href="/inbox"');
    expect(source).not.toContain('href="/integrations/connect"');
  });

  it("onboarding AI step uses real links not silent no-op buttons", async () => {
    const source = await readProjectFile("app/onboarding/[step]/page.tsx");

    // "Skip for now" must navigate somewhere — /onboarding/ready
    // (defined as JS object property: href: "/onboarding/ready")
    expect(source).toMatch(/href:.*\/onboarding\/ready/);
    // No bare <button> Select with no onClick remaining
    expect(source).not.toContain(
      '<button type="button" className="v-btn v-btn--sm">\n                Select\n              </button>'
    );
  });

  it("trash page shows an honest unavailable placeholder — no fake delete pipeline", async () => {
    const source = await readProjectFile("app/trash/page.tsx");

    expect(source).toContain("not yet available");
    expect(source).not.toContain("Items you delete from Verto");
    expect(source).not.toContain("Trash is empty");
  });
});
