import { describe, expect, it } from "vitest";
import { selectHomeReading } from "@/components/home/ContinueReadingCard";
import type { RecentDoc, StarterDoc } from "@/components/home/home-data";
import type { ReadingEntry } from "@/lib/reading-state";

function entry(href: string, progress: number): ReadingEntry {
  return {
    href,
    slug: ["notes", href.split("/").at(-1) ?? "note"],
    title: "Stored title",
    path: "",
    lastReadAt: "2026-10-07T00:00:00Z",
    progress,
    scrollTop: 100,
  };
}

const starter: StarterDoc = { href: "/read/start", title: "Start here", section: "Notes" };
const document: RecentDoc = {
  href: "/read/active",
  title: "Current document title",
  section: "Research",
  description: "A real summary from the active source.",
  cover: "/real-cover.jpg",
  iso: null,
  relative: "",
};

describe("selectHomeReading", () => {
  it("resumes active reading with current source metadata and its saved position", () => {
    const selection = selectHomeReading(
      [entry("/read/active", 38.4)],
      ["/read/active", "/read/start"],
      [starter],
      [document]
    );

    expect(selection.hasRecentReading).toBe(true);
    expect(selection.primary).toMatchObject({
      title: document.title,
      description: document.description,
      cover: document.cover,
      progress: 38,
    });
    expect(selection.secondary).toEqual([{ ...starter, progress: null }]);
  });

  it("excludes other libraries and avoids repeating the featured article", () => {
    const selection = selectHomeReading(
      [entry("/read/other-library", 55), entry("/read/start", 100)],
      ["/read/start", "/read/active"],
      [starter],
      [document, { ...document }]
    );

    expect(selection.primary?.href).toBe(starter.href);
    expect(selection.primary?.progress).toBe(100);
    expect(selection.secondary.map((item) => item.href)).toEqual([document.href]);
  });

  it("uses available source articles for an honest first reading and leaves missing covers empty", () => {
    const selection = selectHomeReading([], [starter.href, document.href], [starter], [document]);

    expect(selection.hasRecentReading).toBe(false);
    expect(selection.primary).toEqual({ ...starter, progress: null });
    expect(selection.primary?.cover).toBeUndefined();
    expect(selection.secondary[0]).toMatchObject({ href: document.href, progress: null });
    expect(selectHomeReading([], [], [starter], [document]).primary).toBeUndefined();
  });
});
