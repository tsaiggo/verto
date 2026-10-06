import { expect, test } from "playwright/test";

test("Library view tabs follow the URL and keep source and tag filters", async ({ page }) => {
  await page.goto("/library?source=Workspace&tag=demo&view=notes");

  const tabs = page.getByRole("tablist", { name: "Library views" });
  const nav = page.getByRole("navigation", { name: "Workspace navigation" });
  await expect(page.getByRole("heading", { name: "Notes", level: 1 })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: /Notes/ })).toHaveAttribute("data-state", "active");
  await expect(nav.getByRole("link", { name: "Notes" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Library", exact: true })).toHaveAttribute(
    "data-active",
    "true"
  );
  await expect(nav.getByRole("link", { name: "Library", exact: true })).not.toHaveAttribute(
    "aria-current",
    "page"
  );
  await tabs.getByRole("tab", { name: /Drafts/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBe("drafts");
  expect(new URL(page.url()).searchParams.get("source")).toBe("Workspace");
  expect(new URL(page.url()).searchParams.get("tag")).toBe("demo");
  await expect(nav.getByRole("link", { name: "Library", exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(nav.getByRole("link", { name: "Notes", exact: true })).not.toHaveAttribute(
    "aria-current",
    "page"
  );

  await tabs.getByRole("tab", { name: /All Documents/ }).click();
  await expect(page.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("view")).toBeNull();
  expect(new URL(page.url()).searchParams.get("source")).toBe("Workspace");
  expect(new URL(page.url()).searchParams.get("tag")).toBe("demo");
});
