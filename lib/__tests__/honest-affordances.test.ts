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

  it("does not leave disabled overflow controls in product pages", async () => {
    const home = await readProjectFile("app/page.tsx");
    const search = await readProjectFile("components/search/SearchView.tsx");
    const topBar = await readProjectFile("components/layout/VxTopBar.tsx");
    const primaryNav = await readProjectFile("components/layout/PrimaryNav.tsx");

    expect(home).not.toContain("More home actions");
    expect(topBar).not.toContain("More document actions");
    expect(primaryNav).not.toContain("Collapse sidebar");
    expect(topBar).toContain('aria-label="Product actions"');
    expect(topBar).toContain('href="/integrations"');
    expect(topBar).toContain('href="/settings"');
    expect(topBar).toContain('href="/help"');
    expect(search).not.toContain('className="search-select"');
    expect(search).not.toContain("search-filters-pill");
    expect(search).not.toContain("All repositories");
  });

  it("does not present a sync or save confirmation without a verified backend", async () => {
    const primaryNav = await readProjectFile("components/layout/PrimaryNav.tsx");

    expect(primaryNav).not.toContain("Workspace synced");
    expect(primaryNav).not.toContain("All changes saved");
    expect(primaryNav).not.toContain(">Synced<");
  });

  it("does not seed the home dashboard with representative user activity", async () => {
    const home = await readProjectFile("app/page.tsx");
    const cards = await readProjectFile("components/home/HomeCards.tsx");

    expect(home).not.toContain("home-sample");
    expect(cards).not.toContain("Agent summarised 4 documents");
    expect(cards).not.toContain("5 highlights without notes");
    expect(cards).not.toContain("const more = 5");
    expect(cards).not.toContain("Updated {i < 2");
  });

  it("does not seed Agent context with representative documents", async () => {
    const agent = await readProjectFile("app/agent/page.tsx");

    expect(agent).not.toContain("SAMPLE_DOCS");
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

    expect(source).toContain('name: "Local Library"');
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

  it("does not retain the retired source provider card surface", async () => {
    const css = await readProjectFile("app/globals.css");

    expect(css).not.toContain(".connect-page");
    expect(css).not.toContain(".connect-cards");
    expect(css).not.toContain(".connect-aside");
    expect(css).not.toContain(".connect-card");
  });
  it("removes the /git route — file should not exist on disk", async () => {
    const exists = await fs
      .access(path.join(process.cwd(), "app/git/page.tsx"))
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(false);
  });

  it("onboarding source step only offers Local Library and RSS", async () => {
    const source = await readProjectFile("app/onboarding/[step]/page.tsx");

    expect(source).not.toContain('"GitHub"');
    expect(source).not.toContain('"OneDrive"');
    expect(source).toContain("Local Library");
    expect(source).toContain("RSS feeds");
    expect(source).toContain('href="/integrations#local-files"');
    expect(source).toContain('href="/inbox"');
    expect(source).not.toContain('href="/integrations/connect"');
  });

  it("onboarding only advertises supported AI setup and does not fake completion", async () => {
    const source = await readProjectFile("app/onboarding/[step]/page.tsx");

    // "Skip for now" must navigate somewhere — /onboarding/ready
    // (defined as JS object property: href: "/onboarding/ready")
    expect(source).toMatch(/href:.*\/onboarding\/ready/);
    // No bare <button> Select with no onClick remaining
    expect(source).not.toContain(
      '<button type="button" className="v-btn v-btn--sm">\n                Select\n              </button>'
    );
    expect(source).not.toContain("OpenAI-compatible API key");
    expect(source).not.toContain("Source connected");
    expect(source).not.toContain("AI provider linked");
    expect(source).not.toContain("Workspace indexed");
    expect(source).toContain('href: "/settings/agent"');
    expect(source).toContain('href: "/integrations"');
  });

  it("settings only presents preferences that Verto currently supports", async () => {
    const settings = await readProjectFile("components/settings/settings-panels.tsx");

    expect(settings).toContain("GitHub Models");
    expect(settings).toContain("No anonymous telemetry");
    expect(settings).toContain("Apache-2.0");
    expect(settings).not.toContain("Claude Opus");
    expect(settings).not.toContain("GPT-5");
    expect(settings).not.toContain("Gemini Pro");
    expect(settings).not.toContain("Clear cache");
    expect(settings).not.toContain("Vim keybindings");
  });

  it("trash page shows an honest unavailable placeholder — no fake delete pipeline", async () => {
    const source = await readProjectFile("app/trash/page.tsx");

    expect(source).toContain("not yet available");
    expect(source).not.toContain("Items you delete from Verto");
    expect(source).not.toContain("Trash is empty");
  });
});
