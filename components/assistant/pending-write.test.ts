import { describe, expect, it } from "vitest";

import { pendingWritePreview } from "./pending-write";

const doc = {
  title: "Release notes",
  href: "/read/release-notes",
  slug: ["release-notes"],
};

describe("pendingWritePreview", () => {
  it("shows the target document and a bounded summary preview", () => {
    const preview = pendingWritePreview(
      "save_summary",
      JSON.stringify({ body: `Summary ${"detail ".repeat(40)}` }),
      doc
    );

    expect(preview).toMatchObject({
      valid: true,
      action: "Save a summary to your library",
      targetTitle: "Release notes",
      targetHref: "/read/release-notes",
    });
    expect(preview.fields[0]).toMatchObject({ label: "Summary" });
    expect(preview.fields[0]?.value.endsWith("…")).toBe(true);
    expect(preview.fields[0]?.value.length).toBeLessThanOrEqual(181);
  });

  it("shows bounded quote and note previews for a highlight", () => {
    const preview = pendingWritePreview(
      "create_highlight_note",
      JSON.stringify({ quote: "A precise quote", note: "Remember this distinction" }),
      doc
    );

    expect(preview.valid).toBe(true);
    expect(preview.fields).toEqual([
      { label: "Quote", value: "A precise quote" },
      { label: "Note", value: "Remember this distinction" },
    ]);
  });

  it.each([
    ["malformed JSON", "save_summary", "{"],
    ["missing payload", "save_summary", "{}"],
    ["hidden field", "save_summary", '{"body":"Visible","other":"hidden"}'],
    ["wrong quote type", "create_highlight_note", '{"quote":42}'],
    ["unknown write", "delete_library", "{}"],
  ])("makes %s non-approvable", (_label, name, args) => {
    expect(pendingWritePreview(name, args, doc).valid).toBe(false);
  });

  it("does not approve a write without an identifiable target document", () => {
    expect(pendingWritePreview("save_summary", '{"body":"Summary"}').valid).toBe(false);
  });
});
