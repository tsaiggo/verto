import { describe, expect, it } from "vitest";
import type { LabsSidebarTree } from "./buildLabsTree";
import { selectedAncestorIds } from "./selection";

const tree: LabsSidebarTree = [
  {
    id: "notes",
    label: "Notes",
    href: "/read/notes",
    items: [
      {
        slug: ["notes", "research"],
        href: "/read/notes/research",
        title: "Research",
        children: [
          {
            slug: ["notes", "research", "ai"],
            href: "/read/notes/research/ai",
            title: "AI",
            children: [
              {
                slug: ["notes", "research", "ai", "overview"],
                href: "/read/notes/research/ai/overview",
                title: "Overview",
              },
            ],
          },
        ],
      },
    ],
  },
];

describe("selectedAncestorIds", () => {
  it("opens every parent of a deeply nested document", () => {
    expect(selectedAncestorIds(tree, "/read/notes/research/ai/overview")).toEqual([
      "notes/research",
      "notes/research/ai",
    ]);
  });

  it("opens the selected folder itself", () => {
    expect(selectedAncestorIds(tree, "/read/notes/research")).toEqual(["notes/research"]);
  });

  it("does not expand folders for an unrelated route", () => {
    expect(selectedAncestorIds(tree, "/mail")).toEqual([]);
  });
});
