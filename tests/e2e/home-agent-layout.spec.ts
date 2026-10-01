import { expect, test } from "playwright/test";

test("Home uses the full desktop content width and keeps its Agent entry available", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.locator("[data-agent-pane]")).toHaveCount(0);
  const home = page.locator("#main-content");
  await expect(home.locator(".home-agent-entry")).toBeVisible();
  await expect(home.locator(".home-agent-entry")).toHaveAttribute("href", "/agent");
  const heading = home.getByRole("heading", { level: 1 });
  const subtitle = home.locator(".pgh-subtitle");
  const summary = home.locator(".pgh-meta");
  const resume = home.locator(".home-feed");
  const context = home.locator(".home-context");

  const [homeBox, headingBox, subtitleBox, summaryBox, resumeBox, contextBox] = await Promise.all([
    home.boundingBox(),
    heading.boundingBox(),
    subtitle.boundingBox(),
    summary.boundingBox(),
    resume.boundingBox(),
    context.boundingBox(),
  ]);
  expect(
    homeBox && headingBox && subtitleBox && summaryBox && resumeBox && contextBox
  ).toBeTruthy();
  expect(homeBox!.x + homeBox!.width).toBeCloseTo(1280, 0);
  expect(homeBox!.width).toBeGreaterThanOrEqual(990);
  expect(subtitleBox!.y).toBeGreaterThanOrEqual(headingBox!.y + headingBox!.height - 1);
  expect(summaryBox!.y).toBeGreaterThanOrEqual(subtitleBox!.y + subtitleBox!.height - 1);
  expect(resumeBox!.width).toBeGreaterThan(900);
  expect(contextBox!.y).toBeGreaterThanOrEqual(resumeBox!.y + resumeBox!.height - 1);
});
