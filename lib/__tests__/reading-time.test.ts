import { describe, expect, it } from "vitest";

import { estimateReadingTime, formatReadingTime } from "@/lib/reading-time";

describe("estimateReadingTime", () => {
  it("returns at least one minute for a short document", () => {
    expect(estimateReadingTime("# Intro\n\nA compact note.")).toBe(1);
  });

  it("rounds up based on readable words", () => {
    const words = Array.from({ length: 451 }, (_, index) => `word${index}`).join(" ");

    expect(estimateReadingTime(words)).toBe(3);
  });

  it("ignores frontmatter and fenced code blocks", () => {
    const frontmatter = "---\ntitle: Example\ntags: [alpha, beta]\n---";
    const code = "```ts\n" + Array.from({ length: 800 }, () => "code").join(" ") + "\n```";

    expect(estimateReadingTime(`${frontmatter}\n\nShort readable paragraph.\n\n${code}`)).toBe(1);
  });
});

describe("formatReadingTime", () => {
  it("formats singular and plural labels", () => {
    expect(formatReadingTime(1)).toBe("1 min read");
    expect(formatReadingTime(4)).toBe("4 min read");
  });
});
