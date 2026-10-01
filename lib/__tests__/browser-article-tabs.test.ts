import { describe, expect, it } from "vitest";
import { resolveDocumentTab } from "../document-tabs";

describe("browser article tab identity", () => {
  it("keeps two browser articles as distinct navigable tabs", () => {
    expect(resolveDocumentTab("/read/local", "document=article-a&view=read")).toEqual({
      path: "/read/local?document=article-a",
      title: "Browser article",
    });
    expect(resolveDocumentTab("/read/local", "document=article-b")?.path).toBe(
      "/read/local?document=article-b"
    );
    expect(resolveDocumentTab("/read/local", "document=a%2Fb")?.path).toBe(
      "/read/local?document=a%2Fb"
    );
  });
  it("does not create an unusable tab when no article is selected", () => {
    expect(resolveDocumentTab("/read/local")).toBeNull();
  });
});
