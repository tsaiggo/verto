import { expect, test, type Page } from "playwright/test";

const PERSONAL = "alex.morgan@example.com";
const WORK = "alexandria.morgan@product-strategy.northstar-example.com";
const WORK_SUBJECT =
  "Research handoff: reading workflows, account switching, and the decisions we need to review before the next design session";

async function chooseAccount(page: Page, label: string) {
  await page.getByRole("button", { name: /^Switch mail account/ }).click();
  await page.getByRole("menuitemradio").filter({ hasText: label }).click();
  await expect(page.getByRole("button", { name: /^Switch mail account/ })).toContainText(label);
}

test.use({ viewport: { width: 1207, height: 900 } });

test("switches mailboxes with scoped folders and restores reading, filters, and an unfinished draft", async ({
  page,
}) => {
  await page.goto("/mail?demo=1&folder=INBOX&message=demo-coffee");
  await page.getByLabel("Search loaded messages", { exact: true }).fill("Coffee");
  const detail = page.getByTestId("mail-message-detail");
  await expect(
    detail.getByRole("heading", { name: "Coffee after the workshop?", exact: true })
  ).toBeVisible();
  await chooseAccount(page, WORK);
  await expect(page).toHaveURL(/account=microsoft%3Ademo-microsoft-example/);
  await expect(page.getByTestId("workspace-mail-panel")).toContainText(WORK);
  await page
    .getByTestId("mail-message-list")
    .getByRole("link", { name: new RegExp(WORK_SUBJECT) })
    .click();
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  let composer = page.getByRole("form", { name: "Message draft" });
  await composer.getByLabel("Subject", { exact: true }).fill("A work draft to finish later");
  await composer.getByLabel("Message body", { exact: true }).fill("Kept with the work account.");
  await chooseAccount(page, PERSONAL);
  await expect(page.getByLabel("Search loaded messages", { exact: true })).toHaveValue("Coffee");
  await expect(
    detail.getByRole("heading", { name: "Coffee after the workshop?", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("form", { name: "Message draft" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Local drafts/ })).toContainText("0");
  await chooseAccount(page, WORK);
  composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.getByLabel("Subject", { exact: true })).toHaveValue(
    "A work draft to finish later"
  );
  await expect(composer.locator("header")).toContainText(WORK);
  await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
    "Kept with the work account."
  );
});

test("combines inboxes with explicit ownership and replies using the receiving account", async ({
  page,
}) => {
  const providerCalls: string[] = [];
  page.on("request", (request) => {
    if (/gmail\.googleapis\.com|graph\.microsoft\.com/.test(request.url()))
      providerCalls.push(request.url());
  });
  await page.goto("/mail?demo=1");
  await chooseAccount(page, "All inboxes");
  const list = page.getByTestId("mail-message-list");
  await expect(list.getByRole("link")).toHaveCount(7);
  const sidebar = page.getByTestId("workspace-mail-panel");
  await expect(sidebar).toContainText("2 sample accounts");
  await expect(sidebar.getByRole("link", { name: "Sent", exact: true })).toHaveCount(0);
  await expect(list.getByRole("link", { name: new RegExp(WORK_SUBJECT) })).toContainText(WORK);
  await list.getByRole("link", { name: new RegExp(WORK_SUBJECT) }).click();
  const detail = page.getByTestId("mail-message-detail");
  await expect(detail).toContainText(`Received by ${WORK}`);
  await detail.getByRole("button", { name: "Reply", exact: true }).click();
  const composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.locator("header")).toContainText(WORK);
  await expect(composer.getByLabel("To", { exact: true })).toHaveValue(
    /research-and-platform-experience@northstar-example\.com/
  );
  await composer
    .getByLabel("Message body", { exact: true })
    .fill("Preview response from the work mailbox.");
  await composer.getByRole("button", { name: "Send preview", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("No email was sent");
  expect(providerCalls).toEqual([]);
});

test("changes Compose From explicitly without leaving a duplicate in the original account", async ({
  page,
}) => {
  await page.goto("/mail?demo=1");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  let composer = page.getByRole("form", { name: "Message draft" });
  await composer.getByLabel("Subject", { exact: true }).fill("A draft from my work address");
  await composer
    .getByLabel("Message body", { exact: true })
    .fill("Keep this text while changing From.");
  await composer.getByRole("button", { name: /^From account:/ }).click();
  await page.getByRole("menuitem").filter({ hasText: WORK }).click();
  composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.locator("header")).toContainText(WORK);
  await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
    "Keep this text while changing From."
  );
  await composer.getByRole("button", { name: "Save & close", exact: true }).click();
  await expect(page.getByRole("button", { name: /Local drafts/ })).toContainText("0");
  await chooseAccount(page, WORK);
  await page.getByRole("button", { name: /Local drafts/ }).click();
  await page.getByRole("button", { name: /A draft from my work address/ }).click();
  composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.locator("header")).toContainText(WORK);
  await page.reload();
  await page.getByRole("button", { name: /Local drafts/ }).click();
  await page.getByRole("button", { name: /A draft from my work address/ }).click();
  await expect(page.getByRole("form", { name: "Message draft" }).locator("header")).toContainText(
    WORK
  );
});

test("manages sample accounts with wrapped identities and keyboard dismissal", async ({ page }) => {
  await page.goto("/mail?demo=1");
  await page.getByRole("button", { name: /^Switch mail account/ }).click();
  await page.getByRole("menuitem", { name: "Manage accounts", exact: true }).click();
  const manager = page.getByRole("dialog", { name: "Mail accounts" });
  await expect(manager).toContainText(PERSONAL);
  await expect(manager).toContainText(WORK);
  await expect(manager.getByRole("link", { name: "Connect your own accounts" })).toHaveAttribute(
    "href",
    "/mail"
  );
  const geometry = await manager.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  await page.keyboard.press("Escape");
  await expect(manager).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Switch mail account/ })).toBeFocused();
});
