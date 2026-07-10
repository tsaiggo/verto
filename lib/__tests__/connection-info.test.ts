import { describe, it, expect } from "vitest";
import { buildConnectionDetails, DEFAULT_FILE_FILTER } from "@/lib/connection-info";

describe("buildConnectionDetails", () => {
  it("treats a OneDrive share URL as a connected remote source", () => {
    const details = buildConnectionDetails(
      { kind: "onedrive", name: "OneDrive", label: "OneDrive · content" },
      { VERTO_ONEDRIVE_SHARE_URL: "https://1drv.ms/u/s!abc", VERTO_ONEDRIVE_PATH: "content" }
    );
    expect(details.kind).toBe("onedrive");
    expect(details.path).toBe("/content");
    expect(details.filter).toBe(DEFAULT_FILE_FILTER);
    expect(details.remote).toBe(true);
    expect(details.connected).toBe(true);
  });

  it("describes a local source as a non-remote, connected preview", () => {
    const details = buildConnectionDetails(
      { kind: "local", name: "Local Library", label: "Local library" },
      {}
    );
    expect(details.kind).toBe("local");
    expect(details.remote).toBe(false);
    expect(details.connected).toBe(true);
    expect(details.previewMode).toBe("Local preview");
    expect(details.path).toBe("/content");
  });

  it("reflects a custom local folder in the source path", () => {
    const details = buildConnectionDetails(
      { kind: "local", name: "Local Library", label: "Folder · vault" },
      { VERTO_LOCAL_DIR: "vault" }
    );
    expect(details.path).toBe("/vault");
  });
});
