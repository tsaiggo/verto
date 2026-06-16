import { describe, expect, it } from "vitest";

import {
  fieldsFor,
  initialProviderFor,
  isConnectedProvider,
  previewRowsFor,
} from "@/components/integrations/ConnectSourceView";
import type { ConnectionDetails } from "@/lib/connection-info";

const docsConnection: ConnectionDetails = {
  kind: "docs",
  name: "Showcase",
  path: "/content",
  filter: "**/*.{mdx,md}",
  previewMode: "Bundled preview",
  remote: false,
  connected: true,
};

const localConnection: ConnectionDetails = {
  kind: "local",
  name: "Local Files",
  path: "/vault",
  filter: "**/*.{mdx,md}",
  previewMode: "Local preview",
  remote: false,
  connected: true,
};

const githubConnection: ConnectionDetails = {
  kind: "github",
  name: "GitHub Repo",
  repo: "tsaiggo/verto",
  branch: "main",
  path: "/docs",
  filter: "**/*.{mdx,md}",
  previewMode: "Remote preview",
  remote: true,
  connected: true,
};

describe("ConnectSourceView source helpers", () => {
  it("selects bundled Showcase instead of falling back to GitHub", () => {
    expect(initialProviderFor(docsConnection)).toBe("docs");
    expect(isConnectedProvider("docs", docsConnection)).toBe(true);
    expect(isConnectedProvider("github", docsConnection)).toBe(false);
  });

  it("renders bundled Showcase preview rows without GitHub placeholders", () => {
    const fields = fieldsFor("docs", docsConnection);
    const rows = previewRowsFor("docs", docsConnection, fields, "");

    expect(fields.map((field) => field.value)).toEqual([
      "Bundled showcase content",
      "/content",
      "**/*.{mdx,md}",
    ]);
    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Provider", "Showcase"],
      ["Source", "Bundled showcase content"],
      ["Path", "/content"],
      ["File filter", "**/*.{mdx,md}"],
      ["Preview mode", "Bundled preview"],
    ]);
  });

  it.each([
    ["local", localConnection],
    ["github", githubConnection],
  ] as const)("keeps Showcase defaults when %s is the active source", (_activeKind, connection) => {
    const fields = fieldsFor("docs", connection);
    const rows = previewRowsFor("docs", connection, fields, "");

    expect(fields.map((field) => field.value)).toEqual([
      "Bundled showcase content",
      "/content",
      "**/*.{mdx,md}",
    ]);
    expect(rows.map((row) => [row.label, row.value])).toContainEqual([
      "Preview mode",
      "Bundled preview",
    ]);
  });
});
