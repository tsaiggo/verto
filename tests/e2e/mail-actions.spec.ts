import { expect, test, type Page } from "playwright/test";

const PERSONAL =
  "/mail?demo=1&local=1&account=google%3Ademo-google-example&folder=INBOX&message=demo-design-review";
const WORK =
  "/mail?demo=1&local=1&account=microsoft%3Ademo-microsoft-example&folder=inbox&message=demo-work-long";

async function openMailbox(page: Page, url = PERSONAL) {
  await page.goto(url);
  await expect(page.getByTestId("mail-message-body")).toBeVisible();
  await expect(page.getByTestId("mail-local-status")).toHaveAttribute("data-phase", "idle");
}

test.use({ viewport: { width: 1280, height: 900 } });

test("the sample inbox keeps refreshing counts after consecutive message actions", async ({
  page,
}) => {
  await page.goto("/mail?demo=1");
  const reader = page.getByTestId("mail-message-detail");
  await expect(reader.getByTestId("mail-message-body")).toBeVisible();
  const sidebar = page.getByTestId("workspace-mail-panel");
  await reader.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(sidebar.getByRole("link", { name: "Inbox 2", exact: true })).toBeVisible();
  await reader.getByRole("button", { name: "Mark unread", exact: true }).click();
  await expect(sidebar.getByRole("link", { name: "Inbox 3", exact: true })).toBeVisible();
});

test("read and star actions update the list, counters and saved body through reload and offline reading", async ({
  page,
  context,
}) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    if (/gmail\.googleapis\.com|graph\.microsoft\.com/.test(request.url()))
      providerRequests.push(request.url());
  });
  await openMailbox(page);
  const reader = page.getByTestId("mail-message-detail");
  await reader.getByRole("button", { name: "Mark read", exact: true }).click();
  await expect(reader.getByRole("button", { name: "Mark unread", exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Messages", exact: true })
      .getByRole("link")
      .filter({ hasText: "Maya Chen" })
  ).toHaveAccessibleName(/^Read Maya Chen/);
  await expect(
    page.getByTestId("workspace-mail-panel").getByRole("link", { name: "Inbox 2", exact: true })
  ).toBeVisible();
  await reader.getByRole("button", { name: "Star message", exact: true }).click();
  await expect(reader.getByRole("button", { name: "Unstar message", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await page.reload();
  await expect(reader.getByRole("button", { name: "Mark unread", exact: true })).toBeVisible();
  await expect(reader.getByRole("button", { name: "Unstar message", exact: true })).toBeVisible();
  await context.setOffline(true);
  await reader.getByRole("button", { name: "Mark unread", exact: true }).click();
  await expect(reader.getByRole("alert")).toContainText("offline");
  await expect(reader.getByRole("button", { name: "Mark unread", exact: true })).toBeVisible();
  await expect(reader.getByTestId("mail-message-body")).toContainText("Hi Alex and Noah");
  expect(providerRequests).toEqual([]);
});

test("Archive and Trash move messages between folders and retain readable saved detail", async ({
  page,
}) => {
  await openMailbox(page);
  const reader = page.getByTestId("mail-message-detail");
  await reader.getByRole("button", { name: "Archive message", exact: true }).click();
  await expect(page).not.toHaveURL(/message=/);
  await expect(page.getByRole("region", { name: "Messages", exact: true })).not.toContainText(
    "Maya Chen"
  );
  await page
    .getByTestId("workspace-mail-panel")
    .getByRole("link", { name: "Archive", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Messages", exact: true })
    .getByRole("link")
    .filter({ hasText: "Maya Chen" })
    .click();
  await expect(
    reader.getByRole("heading", { name: "Design review notes and next steps" })
  ).toBeVisible();
  await reader.getByRole("button", { name: "Move to Trash", exact: true }).click();
  await expect(page).not.toHaveURL(/message=/);
  await page
    .getByTestId("workspace-mail-panel")
    .getByRole("link", { name: "Trash", exact: true })
    .click();
  await page
    .getByRole("region", { name: "Messages", exact: true })
    .getByRole("link")
    .filter({ hasText: "Maya Chen" })
    .click();
  await expect(reader.getByTestId("mail-message-body")).toContainText("Hi Alex and Noah");
});

test("All inboxes applies actions to the owning account and keeps the other mailbox unchanged", async ({
  page,
}) => {
  await openMailbox(page, WORK);
  await page.getByRole("button", { name: /^Switch mail account/ }).click();
  await page.getByRole("menuitemradio", { name: /All inboxes/ }).click();
  const list = page.getByRole("region", { name: "Messages", exact: true });
  await list.getByRole("link").filter({ hasText: "Research handoff:" }).click();
  const reader = page.getByTestId("mail-message-detail");
  await reader.getByRole("button", { name: "Mark read", exact: true }).click();
  await reader.getByRole("button", { name: "Archive message", exact: true }).click();
  await expect(list).not.toContainText("Research handoff:");
  await expect(list).toContainText("Maya Chen");
  await page.getByRole("button", { name: /^Switch mail account/ }).click();
  await page.getByRole("menuitemradio").filter({ hasText: "alex.morgan@example.com" }).click();
  await list.getByRole("link").filter({ hasText: "Maya Chen" }).click();
  await expect(reader.getByRole("button", { name: "Mark read", exact: true })).toBeVisible();
});

test("an open second tab observes read state and cache clearing without recreating cleared mail", async ({
  page,
  context,
}) => {
  await openMailbox(page);
  const other = await context.newPage();
  await openMailbox(other);
  await page
    .getByTestId("mail-message-detail")
    .getByRole("button", { name: "Mark read", exact: true })
    .click();
  await expect(
    other
      .getByTestId("mail-message-detail")
      .getByRole("button", { name: "Mark unread", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: /^Switch mail account/ }).click();
  await page.getByRole("menuitem", { name: /Manage accounts/ }).click();
  const manager = page.getByRole("dialog", { name: "Mail accounts" });
  await manager
    .getByRole("button", { name: "Clear saved mail for alex.morgan@example.com", exact: true })
    .click();
  await manager.getByRole("button", { name: "Clear saved mail", exact: true }).click();
  await expect(other.getByTestId("mail-local-status")).toContainText("0 saved");
  await expect(other.getByTestId("mail-message-detail")).toContainText("Saved mail was cleared");
  await expect(other.getByRole("region", { name: "Messages", exact: true })).not.toContainText(
    "Maya Chen"
  );
});

test("two tabs save separate local drafts without overwriting either draft", async ({
  page,
  context,
}) => {
  await openMailbox(page);
  const other = await context.newPage();
  await openMailbox(other);
  await Promise.all([
    page.getByRole("button", { name: "Compose", exact: true }).click(),
    other.getByRole("button", { name: "Compose", exact: true }).click(),
  ]);
  await Promise.all([
    page.getByRole("textbox", { name: "Subject", exact: true }).fill("First tab draft"),
    other.getByRole("textbox", { name: "Subject", exact: true }).fill("Second tab draft"),
  ]);
  await Promise.all([
    page.getByRole("button", { name: "Save & close", exact: true }).click(),
    other.getByRole("button", { name: "Save & close", exact: true }).click(),
  ]);
  await page.getByRole("button", { name: /Local drafts/ }).click();
  const list = page.getByRole("region", { name: "Messages", exact: true });
  await expect(list).toContainText("First tab draft");
  await expect(list).toContainText("Second tab draft");
  await page.reload();
  await page.getByRole("button", { name: /Local drafts/ }).click();
  await expect(list).toContainText("First tab draft");
  await expect(list).toContainText("Second tab draft");
});
