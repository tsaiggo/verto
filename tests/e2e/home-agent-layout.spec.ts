import { expect, test } from "playwright/test";

test("Home stays readable beside the persistent Agent at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const agent = page.locator("[data-agent-pane]");
  await expect(agent).toBeVisible();
  const home = page.locator("#main-content");
  const heading = home.getByRole("heading", { level: 1 });
  const subtitle = home.locator(".pgh-subtitle");
  const summary = home.locator(".pgh-meta");
  const resume = home.locator(".home-feed");
  const context = home.locator(".home-context");

  const [headingBox, subtitleBox, summaryBox, resumeBox, contextBox] = await Promise.all([
    heading.boundingBox(),
    subtitle.boundingBox(),
    summary.boundingBox(),
    resume.boundingBox(),
    context.boundingBox(),
  ]);
  expect(headingBox && subtitleBox && summaryBox && resumeBox && contextBox).toBeTruthy();
  expect(subtitleBox!.y).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height - 1);
  expect(summaryBox!.y).toBeGreaterThanOrEqual(subtitleBox!.y + subtitleBox!.height - 1);
  expect(resumeBox!.width).toBeGreaterThan(400);
  expect(contextBox!.y).toBeGreaterThanOrEqual(resumeBox!.y + resumeBox!.height - 1);
});
