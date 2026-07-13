import { expect, test } from "playwright/test";

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
