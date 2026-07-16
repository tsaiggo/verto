import { expect, test } from "playwright/test";

test.describe("Agent workspace", () => {
  test("shows a clear next step when the assistant has not been configured", async ({ page }) => {
    test.skip(
      process.env.NEXT_PUBLIC_VERTO_ASSISTANT === "mock" ||
        process.env.NEXT_PUBLIC_VERTO_ASSISTANT === "github",
      "This setup state requires the disabled assistant build."
    );
    await page.goto("/agent");

    const composer = page.getByRole("textbox", { name: "Message the agent" });
    await expect(composer).toBeDisabled();
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
    await expect(
      page.getByText("AI is not enabled in this version of Verto", { exact: false })
    ).toBeVisible();
    const settings = page.getByRole("link", { name: "Open AI & Agent settings" });
    await expect(settings).toBeVisible();
    const library = page.getByRole("link", { name: "Browse your library" });
    await expect(library).toHaveAttribute("href", "/library");
    await settings.click();
    await expect(page).toHaveURL(/\/settings\/agent$/);
    await expect(page.getByRole("status", { name: "Assistant unavailable" })).toBeVisible();
    await expect(
      page.getByText("No assistant provider is included in this build.", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(
        "Agent remains available for local thread history, but it cannot send AI requests.",
        { exact: true }
      )
    ).toBeVisible();

    await page
      .getByRole("complementary", { name: "Primary navigation" })
      .getByRole("link", { name: "Library", exact: true })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    await page
      .getByRole("complementary", { name: "Primary navigation" })
      .getByRole("link", { name: "Agent", exact: true })
      .click();
    await expect(page).toHaveURL(/\/agent$/);
    await expect(composer).toBeDisabled();

    await page.getByRole("link", { name: "Browse your library" }).click();
    await expect(page).toHaveURL(/\/library$/);
  });
});

test.describe("Agent workspace on mobile", () => {
  test.skip(
    process.env.NEXT_PUBLIC_VERTO_ASSISTANT === "mock" ||
      process.env.NEXT_PUBLIC_VERTO_ASSISTANT === "github",
    "This setup state requires the disabled assistant build."
  );
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps conversation controls and setup guidance available", async ({ page }) => {
    await page.goto("/agent");

    const history = page.locator(".ag-history");
    await expect(history).toBeVisible();
    await expect(history).toHaveCSS("display", "flex");
    await expect(history.getByRole("button", { name: "New conversation" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message the agent" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Open AI & Agent settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse your library" })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });
});
test.describe("Agent workspace geometry", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("keeps the Context rail stacked and the composer inside the app viewport", async ({
    page,
  }) => {
    await page.goto("/agent");

    const workspace = page.locator(".ag-workspace");
    const context = page.getByRole("complementary", { name: "Context" });
    const composer = page.locator(".ag-composer");
    await expect(workspace).toBeVisible();
    await expect(context).toBeVisible();
    await expect(composer).toBeVisible();
    await expect(context).toHaveCSS("flex-direction", "column");
    await expect(page.locator(".ag-grounding")).toHaveCSS("border-radius", "0px");
    await expect(page.locator(".ag-grounding-bar")).toHaveCount(0);

    const geometry = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing ${selector}`);
        const rect = element.getBoundingClientRect();
        return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
      };

      return {
        viewportHeight: window.innerHeight,
        workspace: box(".ag-workspace"),
        composer: box(".ag-composer"),
        contextHead: box(".ag-context-head"),
        sourceList: box(".ag-source-list"),
      };
    });

    expect(geometry.workspace.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.composer.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.composer.top).toBeGreaterThanOrEqual(geometry.workspace.top);
    expect(geometry.sourceList.top).toBeGreaterThanOrEqual(geometry.contextHead.bottom - 1);
  });
});

test.describe("Agent workspace mobile geometry", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps navigation, conversation controls, and the composer inside the viewport", async ({
    page,
  }) => {
    await page.goto("/agent");

    await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
    await expect(page.locator(".ag-history")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message the agent" })).toBeVisible();
    await expect(page.locator(".ag-session-head")).toBeHidden();
    const deleteAction = page.locator(".ag-history-delete").first();
    await expect(deleteAction).toBeVisible();
    await expect(deleteAction).toHaveCSS("opacity", "1");

    const geometry = await page.evaluate(() => {
      const composer = document.querySelector<HTMLElement>(".ag-composer");
      const deleteAction = document.querySelector<HTMLElement>(".ag-history-delete");
      if (!composer || !deleteAction) throw new Error("Missing Agent mobile controls");
      const rect = composer.getBoundingClientRect();
      const deleteRect = deleteAction.getBoundingClientRect();
      const root = document.documentElement;
      return {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        composer: { left: rect.left, right: rect.right, bottom: rect.bottom },
        deleteAction: { width: deleteRect.width, height: deleteRect.height },
        viewportHeight: window.innerHeight,
      };
    });

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.composer.left).toBeGreaterThanOrEqual(0);
    expect(geometry.composer.right).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.composer.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.deleteAction.width).toBeGreaterThanOrEqual(34);
    expect(geometry.deleteAction.height).toBeGreaterThanOrEqual(34);
  });
});
