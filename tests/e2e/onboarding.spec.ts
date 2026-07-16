import { expect, test } from "playwright/test";

test.describe("Onboarding source choice", () => {
  test("keeps every setup step navigable and sends source actions to their exact task", async ({
    page,
  }) => {
    await page.goto("/onboarding/source");

    const steps = [
      ["Welcome", "/onboarding"],
      ["Connect source", "/onboarding/source"],
      ["Connect AI", "/onboarding/ai"],
      ["Next steps", "/onboarding/ready"],
    ] as const;
    for (const [label, href] of steps) {
      await expect(page.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "href",
        href
      );
    }
    await expect(page.getByRole("link", { name: "Connect source", exact: true })).toHaveAttribute(
      "aria-current",
      "step"
    );

    await expect(page.getByRole("link", { name: "Choose folder" })).toHaveAttribute(
      "href",
      "/integrations?from=onboarding#local-files"
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
});

test.describe("Onboarding source choice on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps progress links and source actions readable without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/onboarding/source");

    await expect(page.getByRole("link", { name: "Connect source", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Choose folder" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add feed" })).toBeVisible();

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });
});
