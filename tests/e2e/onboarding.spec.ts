import { expect, test } from "playwright/test";

test.describe("Onboarding source choice", () => {
  test("keeps every setup step navigable and sends source actions to their exact task", async ({
    page,
  }) => {
    await page.goto("/onboarding/source");

    const steps = [
      ["Welcome", "/onboarding"],
      ["Choose folder", "/onboarding/source"],
      ["Index files", "/onboarding/indexing"],
      ["Connect AI", "/onboarding/ai"],
      ["Ready", "/onboarding/ready"],
    ] as const;
    for (const [label, href] of steps) {
      await expect(page.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "href",
        href
      );
    }
    await expect(page.getByRole("link", { name: "Choose folder", exact: true })).toHaveAttribute(
      "aria-current",
      "step"
    );

    const addFeed = page.getByRole("link", { name: "Add feed" });
    await expect(addFeed).toHaveAttribute("href", "/inbox?from=onboarding#subscriptions");

    await addFeed.click();
    await expect(page).toHaveURL(/\/inbox\?from=onboarding#subscriptions$/);
    await expect(page.getByRole("link", { name: "Back to setup" })).toHaveAttribute(
      "href",
      "/onboarding/source"
    );
    await expect(page.getByRole("textbox", { name: "Feed URL" })).toBeVisible();

    await page.goto("/integrations?from=onboarding#local-files");
    await expect(page.getByRole("link", { name: "Back to setup" })).toHaveAttribute(
      "href",
      "/onboarding/source"
    );
  });

  test("keeps indexing honest when no personal folder is selected", async ({ page }) => {
    await page.goto("/onboarding/indexing");

    await expect(page.getByRole("heading", { name: "Check what Verto can read" })).toBeVisible();
    await expect(page.getByText("No personal folder selected", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/onboarding/ai"
    );
    await expect(page.getByText("Workspace indexed", { exact: true })).toHaveCount(0);
  });
});

test.describe("Onboarding source choice on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps progress links and source actions readable without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/onboarding/source");

    await expect(page.getByRole("link", { name: "Choose folder", exact: true })).toBeVisible();
    await expect(page.getByText("Markdown folder", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add feed" })).toBeVisible();

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });
});
