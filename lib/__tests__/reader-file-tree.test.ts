import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import FileTree from "@/components/reader/FileTree";
import type { ContentDirNode } from "@/lib/content-source";

describe("reader FileTree", () => {
  it("renders build-time file nodes as links", () => {
    const root: ContentDirNode = {
      type: "dir",
      slug: [],
      href: "/read/",
      title: "Home",
      children: [
        {
          type: "file",
          slug: ["intro"],
          href: "/read/intro",
          title: "Intro",
          mtime: 0,
          id: "content/intro.md",
          ext: ".md",
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(FileTree, { root, pathname: "/read" }),
    );

    expect(html).toContain('href="/read/intro"');
  });

  it("renders local runtime files and indexes as runtime reader links", () => {
    const root: ContentDirNode = {
      type: "dir",
      slug: [],
      href: "/read/",
      title: "Home",
      children: [
        {
          type: "dir",
          slug: ["notes"],
          href: "/read/notes",
          title: "Notes",
          index: {
            type: "file",
            slug: ["notes"],
            href: "/read/notes",
            title: "Notes",
            mtime: 0,
            id: "/Users/me/Notes/notes/README.md",
            ext: ".md",
            runtime: true,
            runtimeSource: "local",
          },
          children: [
            {
              type: "file",
              slug: ["notes", "danger"],
              href: "/read/notes/danger",
              title: "Danger",
              mtime: 0,
              id: "/Users/me/Notes/notes/danger.md",
              ext: ".md",
              runtime: true,
              runtimeSource: "local",
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(FileTree, { root, pathname: "/read" }),
    );

    expect(html).not.toContain('href="/read/notes"');
    expect(html).not.toContain('href="/read/notes/danger"');
    expect(html).toContain("/runtime/local?file=");
    expect(html).toContain("%2FUsers%2Fme%2FNotes%2Fnotes%2FREADME.md");
    expect(html).toContain("%2FUsers%2Fme%2FNotes%2Fnotes%2Fdanger.md");
    expect(html).toContain("Notes");
    expect(html).toContain("Danger.md");
  });
});
