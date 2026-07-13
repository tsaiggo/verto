import { describe, it, expect } from "vitest";
import { formatDate } from "@/lib/format";

describe("formatDate", () => {
  it("formats a date string correctly", () => {
    expect(formatDate("2026-03-06")).toBe("March 6, 2026");
  });

  it("formats another date string", () => {
    expect(formatDate("2025-12-15")).toBe("December 15, 2025");
  });

  it("preserves a date-only value in a timezone west of UTC", () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";

    try {
      expect(formatDate("2026-03-06")).toBe("March 6, 2026");
    } finally {
      if (originalTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = originalTimeZone;
      }
    }
  });
});
