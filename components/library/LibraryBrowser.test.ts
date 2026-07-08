import { describe, expect, it } from "vitest";
import { runtimeEntryToLibraryDoc } from "@/components/library/LibraryBrowser";

describe("LibraryBrowser runtime local mapping", () => {
  it("maps a local markdown file to a runtime reader link", () => {
    const doc = runtimeEntryToLibraryDoc({
      id: "C:/Users/me/Notes/projects/roadmap.md",
      path: ["projects", "roadmap.md"],
      mtime: 1_717_000_000_000,
    });

    expect(doc).toMatchObject({
      title: "Roadmap",
      ext: ".md",
      section: "Projects",
      kind: "note",
    });
    expect(doc.href).toContain("/runtime/local?");
    expect(doc.href).toContain("file=C%3A%2FUsers%2Fme%2FNotes%2Fprojects%2Froadmap.md");
    expect(doc.href).toContain("title=Roadmap");
    expect(doc.href).toContain("ext=.md");
  });
});
