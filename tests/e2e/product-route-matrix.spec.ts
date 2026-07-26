import { expect, test, type Page } from "playwright/test";

const PRODUCT_ROUTES = [
  "/",
  "/library",
  "/read/demo",
  "/agent",
  "/editor",
  "/inbox",
  "/search",
  "/collections",
  "/studio",
  "/integrations",
  "/settings",
  "/onboarding/welcome",
  "/tags",
  "/bookmarks",
  "/recent",
  "/runtime/local",
  "/help",
] as const;

async function expectHealthyRoute(page: Page, route: (typeof PRODUCT_ROUTES)[number]) {
  const pageErrors: string[] = [];
  const onPageError = (error: Error) => pageErrors.push(error.message);
  page.on("pageerror", onPageError);

  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${route} should return a successful response`).toBeLessThan(400);
  await expect(
    page.locator("main").first(),
    `${route} should expose its main content`
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Application error");

  const viewport = page.viewportSize();
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(
    metrics.scrollWidth,
    `${route} should not overflow a ${viewport?.width ?? "current"}px viewport`
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(pageErrors, `${route} should not emit an uncaught browser error`).toEqual([]);

  page.off("pageerror", onPageError);
}

test.describe("Product route matrix", () => {
  test("keeps every primary product route healthy on desktop", async ({ page }) => {
    for (const route of PRODUCT_ROUTES) {
      await expectHealthyRoute(page, route);
    }
  });
});

test.describe("Product route matrix on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps every primary product route healthy at 390px", async ({ page }) => {
    for (const route of PRODUCT_ROUTES) {
      await expectHealthyRoute(page, route);
    }
  });
});
