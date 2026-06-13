import { describe, it, expect } from "vitest";
import manifest, { dynamic } from "@/app/manifest";

describe("app manifest metadata route", () => {
  it("is forced static for export builds", () => {
    expect(dynamic).toBe("force-static");
  });

  it("returns stable manifest metadata", () => {
    const data = manifest();
    expect(data.name).toBe("Verto");
    expect(data.start_url).toBe("/");
    expect(data.icons?.length).toBeGreaterThan(0);
  });
});
