import { expect, test } from "playwright/test";

test.describe("Desktop Mail navigation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("uses product names and opens the Mail workspace", async ({ page }) => {
    await page.goto("/mail");

    const rail = page.getByRole("navigation", { name: "App navigation" });
    await expect(rail.getByRole("link", { name: "Mail", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(rail.getByRole("link", { name: "Recent" })).toHaveAttribute("href", "/recent");
    await expect(rail.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");
    await expect(rail.getByRole("link", { name: "Sources" })).toHaveAttribute(
      "href",
      "/integrations"
    );
    await expect(rail.getByRole("link", { name: "Settings" })).toHaveCount(1);
    await expect(rail.getByRole("button", { name: "Messages" })).toHaveCount(0);

    await expect(page.getByRole("heading", { name: "Mail", level: 1 })).toBeVisible();
    const googleConfigured = Boolean(process.env.NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID);
    const microsoftConfigured = Boolean(process.env.NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID);
    await expect(
      page.getByRole("heading", {
        name:
          googleConfigured || microsoftConfigured ? "Connect your mail" : "Mail is not configured",
        exact: true,
      })
    ).toBeVisible();
    await expect(page.locator('[data-testid="workspace-mail-panel"]')).toBeVisible();
    if (googleConfigured) {
      await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeEnabled();
    } else {
      await expect(page.getByRole("button", { name: "Connect Gmail" })).toHaveCount(0);
    }
    if (microsoftConfigured) {
      await expect(page.getByRole("button", { name: "Connect Outlook" })).toBeEnabled();
    } else {
      await expect(page.getByRole("button", { name: "Connect Outlook" })).toHaveCount(0);
    }

    const sampleInbox = page.getByRole("link", { name: "Explore a sample inbox" });
    await expect(sampleInbox).toHaveAttribute("href", "/mail?demo=1");
    await sampleInbox.click();
    await expect(page).toHaveURL(/\/mail\?demo=1$/);
    await expect(page.locator('[data-mail-demo="true"]')).toBeVisible();
    await expect(
      page.locator('[data-mail-demo="true"]').getByText("Sample inbox", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Connect your account" })).toHaveAttribute(
      "href",
      "/mail"
    );
    await expect(rail.getByRole("link", { name: "Mail", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
