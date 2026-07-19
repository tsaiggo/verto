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
  it("uses native desktop decorations without rendering a simulated system menu", async () => {
    const shell = await readProjectFile("components/layout/AppShellClient.tsx");
    const layout = await readProjectFile("app/layout.tsx");
    const windowsConfig = JSON.parse(
      await readProjectFile("src-tauri/tauri.windows.conf.json")
    ) as {
      app: { windows: Array<{ decorations?: boolean }> };
    };
    const macConfig = JSON.parse(await readProjectFile("src-tauri/tauri.macos.conf.json")) as {
      app: { windows: Array<{ decorations?: boolean; titleBarStyle?: string }> };
    };
    const capabilities = await readProjectFile("src-tauri/capabilities/default.json");
    const customTitlebarExists = await fs
      .access(path.join(process.cwd(), "components/desktop/TitleBar.tsx"))
      .then(() => true)
      .catch(() => false);

    expect(shell).not.toContain("TitleBar");
    expect(layout).not.toContain("desktopTitlebarScript");
    expect(customTitlebarExists).toBe(false);
    expect(windowsConfig.app.windows[0]?.decorations).toBe(true);
    expect(macConfig.app.windows[0]?.decorations).toBe(true);
    expect(macConfig.app.windows[0]?.titleBarStyle).toBeUndefined();
    expect(capabilities).not.toContain("core:window:allow-start-dragging");
    expect(capabilities).not.toContain("core:window:allow-toggle-maximize");
  });

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
    expect(topBar).toContain('aria-label="Task actions"');
    expect(topBar).toContain('aria-label="Quick navigation"');
    expect(topBar).toContain("<span>Go to</span>");
    expect(topBar).toContain("<FilePenLine aria-hidden /> New document");
    expect(topBar).toContain("<FolderOpen aria-hidden /> Sources");
    expect(topBar).toContain('aria-label="Appearance settings"');
    expect(topBar).toContain('href="/search"');
    expect(topBar).toContain('href="/settings"');
    expect(topBar).toContain('href="/library"');
    expect(topBar).toContain('href="/editor"');
    expect(topBar).toContain('href="/integrations"');
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

  it("does not retain fake reader collections or an unavailable Trash route in navigation", async () => {
    const primaryNav = await readProjectFile("components/layout/PrimaryNav.tsx");

    expect(primaryNav).not.toContain("READER_COLLECTIONS");
    expect(primaryNav).not.toContain('href: "/trash"');
    expect(primaryNav).not.toContain('label: "Trash"');
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
    expect(collections).toContain('runtimeLocal.status === "idle" ? folderGroups : []');
  });

  it("keeps Recent aligned with an active local library", async () => {
    const recent = await readProjectFile("components/reader/RecentDocumentsView.tsx");

    expect(recent).toContain("useRuntimeLocalIndex");
    expect(recent).toContain("sortRecentDocuments(runtimeLocal.index.documents");
    expect(recent).toContain('href="/integrations"');
  });

  it("keeps source management on the Sources page with real actions", async () => {
    const source = await readProjectFile("components/integrations/SourcesOverview.tsx");

    expect(source).toContain("<LocalFolderPickerButton");
    expect(source).toContain('href="/inbox"');
    expect(source).not.toContain('href="/integrations#local-files"');
    expect(source).not.toContain('href="/integrations/connect"');
  });

  it("keeps runtime source actions honest while surfacing the active build source", async () => {
    const source = await readProjectFile("app/integrations/page.tsx");

    expect(source).toContain('name: "Local Library"');
    expect(source).toContain('name: "RSS"');
    expect(source).toContain('connection.kind === "onedrive"');
    expect(source).toContain('kind: "onedrive"');
    expect(source).not.toContain('name: "GitHub"');
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
    const source = await readProjectFile("components/onboarding/OnboardingFlow.tsx");

    expect(source).not.toContain('"GitHub"');
    expect(source).not.toContain('"OneDrive"');
    expect(source).toContain('title="Local library"');
    expect(source).toContain('title="RSS or Atom"');
    expect(source).toContain('href="/integrations?from=onboarding#local-files"');
    expect(source).toContain('href="/inbox?from=onboarding#subscriptions"');
    expect(source).not.toContain('href="/integrations/connect"');
  });

  it("onboarding only advertises supported AI setup and does not fake completion", async () => {
    const source = await readProjectFile("components/onboarding/OnboardingFlow.tsx");

    // Skipping the optional provider must advance to the review step.
    expect(source).toContain('router.push("/onboarding/ready")');
    // No bare <button> Select with no onClick remaining
    expect(source).not.toContain(
      '<button type="button" className="v-btn v-btn--sm">\n                Select\n              </button>'
    );
    expect(source).not.toContain("OpenAI-compatible API key");
    expect(source).not.toContain("Source connected");
    expect(source).not.toContain("AI provider linked");
    expect(source).not.toContain("Workspace indexed");
    expect(source).toContain('href="/settings/agent?from=onboarding"');
    expect(source).toContain('href="/integrations?from=onboarding"');
  });

  it("settings only presents preferences that Verto currently supports", async () => {
    const settings = await readProjectFile("components/settings/settings-panels.tsx");
    const assistant = await readProjectFile("components/integrations/AssistantConnectPanel.tsx");

    expect(settings).toContain("<AssistantConnectPanel />");
    expect(assistant).toContain("GitHub Models");
    expect(settings).toContain("No anonymous telemetry");
    expect(settings).toContain("Apache-2.0");
    expect(settings).not.toContain("Claude Opus");
    expect(settings).not.toContain("GPT-5");
    expect(settings).not.toContain("Gemini Pro");
    expect(settings).not.toContain("Clear cache");
    expect(settings).not.toContain("Vim keybindings");
  });

  it("does not ship an unsupported Trash product route", async () => {
    const exists = await fs
      .access(path.join(process.cwd(), "app/trash/page.tsx"))
      .then(() => true)
      .catch(() => false);

    expect(exists).toBe(false);
  });

  it("does not claim build-time Library documents are directly editable", async () => {
    const masthead = await readProjectFile("components/reader/DocMasthead.tsx");

    expect(masthead).not.toContain("Edit document");
    expect(masthead).not.toContain("/editor?slug=");
    expect(masthead).toContain('mode === "library"');
  });
});
