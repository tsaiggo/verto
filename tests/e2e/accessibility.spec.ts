import axe, { type Result as AxeViolation } from "axe-core";
import { expect, test, type Page } from "playwright/test";

const DESKTOP_ROUTES = [
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
] as const;

const MOBILE_ROUTES = [
  "/",
  "/library",
  "/read/demo",
  "/agent",
  "/editor",
  "/settings",
  "/onboarding/welcome",
] as const;

function summarizeViolations(violations: AxeViolation[]) {
  return violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.slice(0, 4).map((node) => node.target.join(" ")),
  }));
}

async function expectNoSeriousAccessibilityViolations(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.locator("main").first()).toBeVisible();
  const topbar = page.locator(".vx-topbar");
  if ((await topbar.count()) > 0) {
    await expect(topbar).toHaveAttribute("data-shortcuts-ready", "true");
  }
  await page.waitForFunction(
    () =>
      !document.documentElement.hasAttribute("aria-hidden") &&
      !document.body.hasAttribute("aria-hidden")
  );
  await page.waitForFunction(() =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>('.task-list input[type="checkbox"]')
    ).every((checkbox) => checkbox.hasAttribute("aria-label"))
  );
  await page.addScriptTag({ content: axe.source });

  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return result.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious"
    );
  });

  expect(
    summarizeViolations(violations),
    `${route} should have no critical or serious WCAG violations`
  ).toEqual([]);
}

test.describe("Primary product accessibility", () => {
  for (const route of DESKTOP_ROUTES) {
    test(`${route} has no serious automated WCAG violations`, async ({ page }) => {
      await expectNoSeriousAccessibilityViolations(page, route);
    });
  }
});

test.describe("Primary product accessibility on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of MOBILE_ROUTES) {
    test(`${route} has no serious automated WCAG violations at 390px`, async ({ page }) => {
      await expectNoSeriousAccessibilityViolations(page, route);
    });
  }
});

declare global {
  interface Window {
    axe: typeof axe;
  }
}
