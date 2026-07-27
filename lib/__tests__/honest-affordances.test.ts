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
    const productUtilities = await readProjectFile("components/layout/ProductUtilities.tsx");

    expect(home).not.toContain("More home actions");
    expect(topBar).not.toContain("More document actions");
    expect(topBar).toContain("<ProductUtilities />");
    expect(productUtilities).toContain('aria-label="Product actions"');
    expect(productUtilities).toContain('href="/integrations"');
    expect(productUtilities).toContain('href="/settings"');
    expect(productUtilities).toContain('href="/help"');
    expect(search).not.toContain('className="search-select"');
    expect(search).not.toContain("search-filters-pill");
    expect(search).not.toContain("All repositories");
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

  it("does not seed Agent context with representative documents or invented source hints", async () => {
    const agent = await readProjectFile("app/agent/page.tsx");
    const workspace = await readProjectFile("components/agent/AgentWorkspace.tsx");
    const replies = await readProjectFile("components/agent/agent-replies.ts");

    expect(agent).not.toContain("SAMPLE_DOCS");
    expect(agent).not.toContain("CONTEXT_HINTS");
    expect(replies).toContain("WORKSPACE_TOOLS");
    expect(workspace).not.toContain("sourceCitations(sources)");
  });

  it("does not seed tag, status, or empty-library views with representative documents", async () => {
    const tags = await readProjectFile("app/tags/page.tsx");
    const tagRoute = await readProjectFile("app/read/tags/[[...tag]]/page.tsx");
    const statusRoute = await readProjectFile("app/read/status/[[...status]]/page.tsx");
    const reader = await readProjectFile("app/read/[[...path]]/page.tsx");
    const sampleReaderExists = await fs
      .access(path.join(process.cwd(), "components/reader/SampleReader.tsx"))
      .then(() => true)
      .catch(() => false);

    expect(tags).not.toContain("SAMPLE_TAGS");
    expect(tagRoute).not.toContain("SAMPLE_DOCS");
    expect(statusRoute).not.toContain("SAMPLE_DOCS");
    expect(reader).not.toContain("SampleReader");
    expect(sampleReaderExists).toBe(false);
  });

  it("does not reserve a reader URL for a hard-coded annotation demo", async () => {
    const reader = await readProjectFile("app/read/[[...path]]/page.tsx");
    const demoReaderExists = await fs
      .access(path.join(process.cwd(), "components/reader/AnnotationSystemReader.tsx"))
      .then(() => true)
      .catch(() => false);

    expect(reader).not.toContain("AnnotationSystemReader");
    expect(reader).not.toContain('path: ["annotation-system"]');
    expect(demoReaderExists).toBe(false);
  });

  it("keeps folder-derived collections aligned with an active local library", async () => {
    const collections = await readProjectFile("app/collections/CollectionsClient.tsx");

    expect(collections).toContain("useRuntimeLocalIndex");
    expect(collections).toContain("runtimeHomeWorkspace");
    expect(collections).toContain("function collectionFolderGroups(");
    expect(collections).toContain(
      'return workspace?.groups ?? (runtime.status === "idle" ? bundled : []);'
    );
    expect(collections).toContain(
      "collectionFolderGroups(runtimeLocal, runtimeWorkspace, folderGroups)"
    );
  });

  it("keeps Recent aligned with an active local library", async () => {
    const recent = await readProjectFile("components/reader/RecentDocumentsView.tsx");

    expect(recent).toContain("useRuntimeLocalIndex");
    expect(recent).toContain("sortRecentDocuments(runtimeLocal.index.documents");
    expect(recent).toContain('href="/integrations"');
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
    const source = await readProjectFile("app/onboarding/OnboardingFlow.tsx");

    expect(source).not.toContain('"GitHub"');
    expect(source).toContain("OneDrive");
    expect(source).toContain("Markdown folder");
    expect(source).toContain("RSS feeds");
    expect(source).toContain('href="/inbox?from=onboarding#subscriptions"');
    expect(source).not.toContain('href="/integrations/connect"');
  });

  it("onboarding only advertises supported AI setup and does not fake completion", async () => {
    const source = await readProjectFile("app/onboarding/OnboardingFlow.tsx");

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
    expect(source).toContain('"indexing"');
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
    expect(settings).toContain("OneDrive, Dropbox, and network folders");
  });

  it("keeps deletion and recovery with the local file system", async () => {
    const source = await readProjectFile("app/trash/page.tsx");

    expect(source).toContain("Trash stays with your file system");
    expect(source).toContain("Verto never moves documents into a private recycle bin");
    expect(source).toContain("Explorer, Finder, OneDrive, or your sync provider");
    expect(source).not.toContain("Items you delete from Verto");
    expect(source).not.toContain("Trash is empty");
  });
});
