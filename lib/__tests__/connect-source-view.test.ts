import { describe, expect, it } from "vitest";

import {
  fieldsFor,
  initialProviderFor,
  isConnectedProvider,
  previewRowsFor,
} from "@/components/integrations/connect-source-data";
import type { ConnectionDetails } from "@/lib/connection-info";

const localConnection: ConnectionDetails = {
  kind: "local",
  name: "Local Library",
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
  it("selects the connected local provider instead of falling back to GitHub", () => {
    expect(initialProviderFor(localConnection)).toBe("local");
    expect(isConnectedProvider("local", localConnection)).toBe(true);
    expect(isConnectedProvider("github", localConnection)).toBe(false);
  });

  it("renders local preview rows from the connected folder", () => {
    const fields = fieldsFor("local", localConnection);
    const rows = previewRowsFor("local", localConnection, fields, "/vault");

    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Provider", "Local Library"],
      ["Folder", "/vault"],
      ["File filter", "**/*.{mdx,md}"],
      ["Preview mode", "Local preview"],
    ]);
  });

  it("derives GitHub provider fields and preview rows from the connection", () => {
    expect(initialProviderFor(githubConnection)).toBe("github");
    expect(isConnectedProvider("github", githubConnection)).toBe(true);

    const fields = fieldsFor("github", githubConnection);
    const rows = previewRowsFor("github", githubConnection, fields, "");

    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Provider", "GitHub"],
      ["Repository", "tsaiggo/verto"],
      ["Branch", "main"],
      ["Path", "/docs"],
      ["File filter", "**/*.{mdx,md}"],
      ["Preview mode", "Remote preview"],
    ]);
  });
});
