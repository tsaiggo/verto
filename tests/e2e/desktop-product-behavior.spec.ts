import { expect, test } from "playwright/test";

test.describe("Home command composer", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("submits a workspace search through the real Search route", async ({ page }) => {
    await page.goto("/");

    const composer = page.getByRole("search");
    await composer.getByRole("searchbox", { name: "Search your workspace" }).fill("demo");
    await composer.getByRole("button", { name: "Search workspace" }).click();

    await expect(page).toHaveURL(/\/search\?q=demo$/);
    await expect(page.getByRole("searchbox", { name: "Search your library" })).toHaveValue("demo");
  });
});

test.describe("Article table of contents", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("uses real article headings and marks the current destination", async ({ page }) => {
    await page.goto("/read/demo");

    const outline = page.getByRole("complementary", { name: "Reader tools" });
    const toc = outline.getByRole("navigation", { name: "Table of contents" });
    await expect(toc.getByText("Verto Feature Demo", { exact: true })).toBeVisible();
    await expect(toc.getByRole("link", { name: "Callouts" })).toHaveAttribute(
      "aria-current",
      "location"
    );

    const toggle = toc.getByRole("link", {
      name: "Toggle — collapsible detail",
      exact: true,
    });
    await toggle.click();
    await expect(page).toHaveURL(/#toggle--collapsible-detail$/);
    await expect(toggle).toHaveAttribute("aria-current", "location");
  });

  test("tracks direct article scrolling and restores deep links", async ({ page }) => {
    await page.goto("/read/demo#toggle--collapsible-detail");

    const toc = page
      .getByRole("complementary", { name: "Reader tools" })
      .getByRole("navigation", { name: "Table of contents" });
    await expect(
      toc.getByRole("link", { name: "Toggle — collapsible detail", exact: true })
    ).toHaveAttribute("aria-current", "location");

    await page.locator("[data-article] #task-list").evaluate((heading) => {
      heading.scrollIntoView({ block: "start" });
    });
    await expect(toc.getByRole("link", { name: "Task list", exact: true })).toHaveAttribute(
      "aria-current",
      "location"
    );
  });
});

test.describe("Pinned navigation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("promotes a real bookmark into Pinned immediately", async ({ page }) => {
    await page.goto("/read/demo");

    await page.getByRole("button", { name: "Bookmark this document" }).click();
    const pinned = page
      .getByRole("region", { name: "Pinned" })
      .getByRole("link", { name: "Verto Feature Demo" });
    await expect(pinned).toHaveAttribute("href", "/read/demo");
    await expect(pinned).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Collections source truth", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps configured folder groups available before a local folder is selected", async ({
    page,
  }) => {
    await page.goto("/collections");

    await expect(page.getByRole("heading", { name: "Make your first collection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create a collection" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "By folder" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Overview 1 document" })).toBeVisible();
  });

  test("adds and removes the current document from a user collection", async ({ page }) => {
    await page.addInitScript(() => {
      if (!window.localStorage.getItem("verto:collections")) {
        window.localStorage.setItem(
          "verto:collections",
          JSON.stringify([
            {
              id: "reading-queue",
              name: "Reading queue",
              docHrefs: [],
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ])
        );
      }
    });

    await page.goto("/read/demo");

    await page.getByRole("button", { name: "Add to collection" }).click();
    await page.getByRole("menuitem", { name: "Add to Reading queue" }).click();
    await expect(page.getByRole("button", { name: "In 1 collection" })).toBeVisible();

    await page.goto("/collections?collection=reading-queue");
    await expect(page.getByRole("link", { name: "Verto Feature Demo" })).toBeVisible();
    await expect(page.getByText("Library document", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Remove Verto Feature Demo" }).click();
    await expect(page.locator(".col-detail").getByText("0 items", { exact: true })).toBeVisible();

    await page.goto("/read/demo");
    await expect(page.getByRole("button", { name: "Add to collection" })).toBeVisible();
  });

  test("keeps collection deletion deliberate and recoverable", async ({ page }) => {
    await page.addInitScript(() => {
      if (window.localStorage.getItem("verto:collections")) return;
      window.localStorage.setItem(
        "verto:collections",
        JSON.stringify([
          {
            id: "project-notes",
            name: "Project notes",
            docHrefs: ["/read/demo"],
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ])
      );
    });

    await page.goto("/collections?collection=project-notes");
    await page.getByRole("button", { name: "Actions for Project notes" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await expect(page.getByRole("heading", { name: "Delete collection?" })).toBeVisible();
    await expect(page.getByText("This does not delete the original documents.")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("link", { name: /Project notes.*1 item/ })).toBeVisible();

    await page.goto("/collections?collection=project-notes");
    await page.getByRole("button", { name: "Actions for Project notes" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete collection" }).click();

    await expect(page).toHaveURL(/\/collections$/);
    await expect(page.getByRole("heading", { name: "Make your first collection" })).toBeVisible();
  });
});

test.describe("Legacy source-state links", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("lands review-board aliases on the live Sources workbench", async ({ page }) => {
    await page.goto("/integrations/source/detail");

    await expect(page).toHaveURL(/\/integrations#local-files$/);
    await expect(page.getByRole("heading", { name: "Sources & Integrations" })).toBeVisible();
    await expect(page.locator("#local-files")).toBeVisible();
    await expect(page.locator(".final-page")).toHaveCount(0);
  });

  test("keeps the internal reference pack out of the default product", async ({ page }) => {
    test.skip(
      process.env.VERTO_SHOW_REFERENCE_PACK === "1",
      "The reference pack was explicitly enabled for this run."
    );
    await page.goto("/final");

    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page).not.toHaveTitle(/Final Implementation Pack/i);
    await expect(page.locator(".final-page")).toHaveCount(0);
  });
});
