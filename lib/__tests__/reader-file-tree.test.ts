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

    const html = renderToStaticMarkup(createElement(FileTree, { root, pathname: "/read" }));

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

    const html = renderToStaticMarkup(createElement(FileTree, { root, pathname: "/read" }));

    expect(html).not.toContain('href="/read/notes"');
    expect(html).not.toContain('href="/read/notes/danger"');
    expect(html).toContain("/runtime/local?file=");
    expect(html).toContain("%2FUsers%2Fme%2FNotes%2Fnotes%2FREADME.md");
    expect(html).toContain("%2FUsers%2Fme%2FNotes%2Fnotes%2Fdanger.md");
    expect(html).toContain("Notes");
    expect(html).toContain("Danger<span");
    expect(html).toContain('class="rail-tree-ext">.md</span>');
  });

  it("renders github runtime files and indexes as runtime reader links", () => {
    const root: ContentDirNode = {
      type: "dir",
      slug: [],
      href: "/read/",
      title: "Home",
      children: [
        {
          type: "dir",
          slug: ["docs"],
          href: "/read/docs",
          title: "Docs",
          index: {
            type: "file",
            slug: ["docs"],
            href: "/read/docs",
            title: "Docs",
            mtime: 0,
            id: "sha-docs-readme",
            ext: ".md",
            runtime: true,
            runtimeSource: "github",
          },
          children: [
            {
              type: "file",
              slug: ["docs", "readme"],
              href: "/read/docs/readme",
              title: "README",
              mtime: 0,
              id: "sha-readme",
              ext: ".md",
              runtime: true,
              runtimeSource: "github",
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(createElement(FileTree, { root, pathname: "/read" }));

    expect(html).not.toContain("loaded after build time");
    expect(html).not.toContain('href="/read/docs"');
    expect(html).not.toContain('href="/read/docs/readme"');
    expect(html).toContain("/runtime/github?file=sha-docs-readme");
    expect(html).toContain("/runtime/github?file=sha-readme");
    expect(html).toContain("README<span");
    expect(html).toContain('class="rail-tree-ext">.md</span>');
  });
});
