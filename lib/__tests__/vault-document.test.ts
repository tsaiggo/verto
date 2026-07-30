import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import {
  VERTO_BLOCKS_FORMAT,
  contentRevision,
  createVaultDocument,
  inspectMdxBlockSupport,
  readVertoDocumentMetadata,
  updateVaultDocumentMetadata,
} from "@/lib/vault-document";

describe("vault document MDX support inspection", () => {
  it("keeps plain Markdown and code examples block-editable", () => {
    const codeMark = String.fromCharCode(96);
    const fence = codeMark.repeat(3);
    const source = [
      "---",
      "title: Plain note",
      "---",
      "",
      "# Hello",
      "",
      "Use " + codeMark + "<Component />" + codeMark + " as an example in inline code.",
      "",
      fence + "tsx",
      'import Card from "./Card";',
      "<Card active={true} />",
      fence,
      "",
    ].join("\n");

    expect(inspectMdxBlockSupport(source)).toEqual({
      blockEditable: true,
      sourceOnly: false,
      issues: [],
    });
  });

  it("routes imports and exports to source mode", () => {
    const support = inspectMdxBlockSupport(
      ['import Card from "./Card";', "export const answer = 42;", "", "# Page"].join("\n")
    );

    expect(support.blockEditable).toBe(false);
    expect(support.sourceOnly).toBe(true);
    expect(support.issues.map((issue) => issue.kind)).toEqual(["import", "export"]);
    expect(support.issues[0]).toMatchObject({ line: 1, column: 1 });
  });

  it("routes MDX components, fragments, and expressions to source mode", () => {
    const support = inspectMdxBlockSupport(
      [
        '<Callout tone="tip">Hello</Callout>',
        "",
        "<div title={name}>HTML with an expression</div>",
        "",
        "{currentUser}",
      ].join("\n")
    );

    expect(support.blockEditable).toBe(false);
    expect(support.issues.map((issue) => issue.kind)).toEqual([
      "jsx-component",
      "jsx-expression",
      "jsx-expression",
    ]);
    expect(inspectMdxBlockSupport("<></>").issues[0]?.kind).toBe("jsx-component");
  });

  it("uses source mode for malformed MDX instead of guessing how to edit it", () => {
    const support = inspectMdxBlockSupport("<Callout>");

    expect(support).toMatchObject({ blockEditable: false, sourceOnly: true });
    expect(support.issues[0]?.kind).toBe("parse-error");
  });
});

describe("Verto blocks-v1 frontmatter", () => {
  it("creates portable blocks-v1 frontmatter with stable metadata", () => {
    const source = createVaultDocument({
      title: "Project brief",
      body: "# Project brief\n\nShip the first draft.",
      id: "note-0a1b",
      date: "2026-07-24T08:30:00.000Z",
      frontmatter: { tags: ["work"], custom: { owner: "Ada" } },
    });
    const parsed = matter(source);

    expect(parsed.data).toMatchObject({
      title: "Project brief",
      verto_id: "note-0a1b",
      verto_format: VERTO_BLOCKS_FORMAT,
      created: "2026-07-24T08:30:00.000Z",
      updated: "2026-07-24T08:30:00.000Z",
      tags: ["work"],
      custom: { owner: "Ada" },
    });
    expect(parsed.content).toBe("# Project brief\n\nShip the first draft.\n");
    expect(readVertoDocumentMetadata(source)).toEqual({
      id: "note-0a1b",
      format: VERTO_BLOCKS_FORMAT,
      title: "Project brief",
      created: "2026-07-24T08:30:00.000Z",
      updated: "2026-07-24T08:30:00.000Z",
    });
  });

  it("does not allow caller-provided extras to replace Verto-owned fields", () => {
    const parsed = matter(
      createVaultDocument({
        title: "Canonical title",
        id: "stable-id",
        date: "2026-01-01",
        frontmatter: {
          title: "Wrong title",
          verto_id: "wrong-id",
          verto_format: "some-other-format",
          created: "yesterday",
          updated: "tomorrow",
          author: "Ada",
        },
      })
    );

    expect(parsed.data).toMatchObject({
      title: "Canonical title",
      verto_id: "stable-id",
      verto_format: VERTO_BLOCKS_FORMAT,
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-01T00:00:00.000Z",
      author: "Ada",
    });
  });

  it("updates only recognized Verto frontmatter and preserves unknown properties", () => {
    const source = [
      "---",
      "title: Old title",
      "verto_id: note-42",
      "verto_format: blocks-v1",
      'created: "2026-07-01T00:00:00.000Z"',
      'updated: "2026-07-02T00:00:00.000Z"',
      "tags: [work, planning]",
      "custom:",
      "  owner: Ada",
      "  complete: false",
      "---",
      "",
      "# Old title",
      "",
      "Keep this exact body.",
      "",
    ].join("\n");

    const result = updateVaultDocumentMetadata(source, {
      title: "Renamed note",
      updated: "2026-07-24T12:00:00.000Z",
    });
    const parsed = matter(result.source);

    expect(result.changed).toBe(true);
    expect(result.metadata).toEqual({
      id: "note-42",
      format: VERTO_BLOCKS_FORMAT,
      title: "Renamed note",
      created: "2026-07-01T00:00:00.000Z",
      updated: "2026-07-24T12:00:00.000Z",
    });
    expect(parsed.data).toMatchObject({
      title: "Renamed note",
      verto_id: "note-42",
      verto_format: VERTO_BLOCKS_FORMAT,
      created: "2026-07-01T00:00:00.000Z",
      updated: "2026-07-24T12:00:00.000Z",
      tags: ["work", "planning"],
      custom: { owner: "Ada", complete: false },
    });
    expect(parsed.content).toBe("\n# Old title\n\nKeep this exact body.\n");
    expect(readVertoDocumentMetadata(result.source)).not.toBeNull();
  });

  it("retains unknown YAML text, comments, and line endings while updating owned fields", () => {
    const source = [
      "---",
      "# Leave this comment alone",
      'title: "Old title"',
      "verto_id: note-commented",
      'verto_format: "blocks-v1"',
      'created: "2026-07-01T00:00:00.000Z"',
      'updated: "2026-07-02T00:00:00.000Z"',
      "tags: [work, planning] # Keep inline style",
      'custom: {"owner":"Ada"}',
      "---",
      "",
      "Unchanged body.",
      "",
    ].join("\r\n");

    const result = updateVaultDocumentMetadata(source, {
      title: "New title",
      updated: "2026-07-24T12:00:00.000Z",
    });

    expect(result.changed).toBe(true);
    expect(result.source).toContain("# Leave this comment alone\r\n");
    expect(result.source).toContain("tags: [work, planning] # Keep inline style\r\n");
    expect(result.source).toContain('custom: {"owner":"Ada"}\r\n');
    expect(result.source).toContain("\r\n---\r\n\r\nUnchanged body.\r\n");
    expect(result.source).toContain('title: "New title"\r\n');
  });

  it("does not rewrite legacy or invalid frontmatter documents", () => {
    const legacy = "---\ntitle: Existing note\ntags: [portable]\n---\n\nBody\n";
    const noHeader = "# Existing note\n\nBody\n";
    const malformed = "---\nverto_id: note\nverto_format: [blocks-v1\n---\n\nBody\n";

    for (const source of [legacy, noHeader, malformed]) {
      expect(
        updateVaultDocumentMetadata(source, { title: "Changed", updated: "2026-07-24" })
      ).toEqual({
        source,
        changed: false,
      });
    }
  });

  it("keeps an already-matching Verto document byte-for-byte unchanged", () => {
    const source = createVaultDocument({
      title: "Same",
      id: "same-id",
      date: "2026-07-24T00:00:00.000Z",
    });
    const result = updateVaultDocumentMetadata(source, {
      title: "Same",
      updated: "2026-07-24T00:00:00.000Z",
    });

    expect(result).toMatchObject({ source, changed: false });
  });
});

describe("content revision", () => {
  it("computes a deterministic browser-compatible SHA-256 digest", async () => {
    const digest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    await expect(contentRevision("abc")).resolves.toBe(digest);

    await expect(contentRevision("abc\n")).resolves.not.toEqual(await contentRevision("abc"));
  });
});
