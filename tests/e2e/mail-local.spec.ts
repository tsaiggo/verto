import { expect, test, type Page } from "playwright/test";

const PERSONAL = "alex.morgan@example.com";
const WORK = "alexandria.morgan@product-strategy.northstar-example.com";
const PERSONAL_SCOPE = "demo:google:demo-google-example";
const WORK_SCOPE = "demo:microsoft:demo-microsoft-example";

async function openSavedMail(page: Page) {
  await page.goto("/mail?demo=1&local=1&folder=INBOX");
  await expect(page.getByLabel("Search saved mail", { exact: true })).toBeVisible();
  await expect(page.getByTestId("mail-local-status")).toContainText("5 saved");
  await expect(page.getByTestId("mail-local-status")).toHaveAttribute("data-phase", "idle");
}

async function chooseAccount(page: Page, label: string) {
  await page.getByRole("button", { name: /^Switch mail account/ }).click();
  await page.getByRole("menuitemradio").filter({ hasText: label }).click();
  await expect(page.getByRole("button", { name: /^Switch mail account/ })).toContainText(label);
  await expect(page).toHaveURL(/local=1/);
}

async function savedMessages(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("verto.mail.library");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<Array<{ scope: string; id: string; message: { bodyText: string } }>>(
        (resolve, reject) => {
          const request = database
            .transaction("messages", "readonly")
            .objectStore("messages")
            .getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }
      );
    } finally {
      database.close();
    }
  });
}

test.use({ viewport: { width: 1207, height: 900 } });

test("persists full message bodies through reload and searches saved mail across folders while offline", async ({
  page,
  context,
}) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    if (/gmail\.googleapis\.com|graph\.microsoft\.com/.test(request.url()))
      providerRequests.push(request.url());
  });
  await openSavedMail(page);
  const saved = await savedMessages(page);
  expect(saved.filter((item) => item.scope === PERSONAL_SCOPE)).toHaveLength(5);
  expect(saved.find((item) => item.id === "demo-coffee")?.message.bodyText).toContain("12:30");
  await page.reload();
  await expect(page.getByTestId("mail-local-status")).toContainText("5 saved");
  await page
    .getByTestId("workspace-mail-panel")
    .getByRole("link", { name: "Sent", exact: true })
    .click();
  await expect(page).toHaveURL(/local=1.*folder=SENT/);
  await expect(page.getByTestId("mail-local-status")).toHaveAttribute("data-phase", "idle");
  await page.getByLabel("Saved mail search scope", { exact: true }).selectOption("all");
  await page.getByLabel("Search saved mail", { exact: true }).fill("12:30");
  const list = page.getByTestId("mail-message-list");
  await expect(list.getByRole("link")).toHaveCount(1);
  await list.getByRole("link", { name: /Coffee after the workshop/ }).click();
  await expect(page.getByTestId("mail-message-detail")).toContainText(
    "I’m free from 12:30 until 14:00."
  );

  await context.setOffline(true);
  await expect(page.getByTestId("mail-local-status")).toHaveAttribute("data-phase", "offline");
  await page.getByLabel("Search saved mail", { exact: true }).fill("another afternoon next week");
  await expect(list.getByRole("link")).toHaveCount(1);
  await expect(list).toContainText("Coffee after the workshop?");
  await page.getByLabel("Saved mail search scope", { exact: true }).selectOption("folder");
  await expect(list.getByRole("link")).toHaveCount(0);
  await expect(list).toContainText("No matching messages");
  await expect(page.getByTestId("mail-message-detail")).toContainText(
    "I’m free from 12:30 until 14:00."
  );
  expect(providerRequests).toEqual([]);
});

test("isolates saved accounts and clears one mailbox while preserving another mailbox and local drafts", async ({
  page,
}) => {
  await openSavedMail(page);
  await chooseAccount(page, WORK);
  await expect(page.getByTestId("mail-local-status")).toContainText("2 saved");
  await page.getByLabel("Search saved mail", { exact: true }).fill("12:30");
  await expect(page.getByTestId("mail-message-list").getByRole("link")).toHaveCount(0);
  await chooseAccount(page, PERSONAL);
  await page
    .getByTestId("mail-message-list")
    .getByRole("link", { name: /Coffee after the workshop/ })
    .click();
  await expect(page.getByTestId("mail-message-detail")).toContainText(
    "I’m free from 12:30 until 14:00."
  );
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  let composer = page.getByRole("form", { name: "Message draft" });
  await composer
    .getByLabel("Subject", { exact: true })
    .fill("A draft kept after clearing saved mail");
  await composer
    .getByLabel("Message body", { exact: true })
    .fill("This draft stays with the personal account.");
  await composer.getByRole("button", { name: "Save & close", exact: true }).click();
  await page.getByRole("button", { name: /^Switch mail account/ }).click();
  await page.getByRole("menuitem", { name: "Manage accounts", exact: true }).click();
  const manager = page.getByRole("dialog", { name: "Mail accounts" });
  await manager
    .getByRole("button", { name: `Clear saved mail for ${PERSONAL}`, exact: true })
    .click();
  await manager.getByRole("button", { name: "Clear saved mail", exact: true }).click();
  await expect(manager).toContainText(
    "Saved mail cleared. Your drafts and account connection are kept."
  );
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("mail-local-status")).toContainText("0 saved");
  await expect(page.getByTestId("mail-message-list").getByRole("link")).toHaveCount(0);
  const saved = await savedMessages(page);
  expect(saved.filter((item) => item.scope === PERSONAL_SCOPE)).toHaveLength(0);
  expect(saved.filter((item) => item.scope === WORK_SCOPE)).toHaveLength(2);
  await page.getByRole("button", { name: /Local drafts/ }).click();
  await page.getByRole("button", { name: /A draft kept after clearing saved mail/ }).click();
  composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
    "This draft stays with the personal account."
  );
  await expect(composer.locator("header")).toContainText(PERSONAL);
});

test("reloads the saved Mail shell and reads full text without a network connection on localhost", async ({
  page,
  context,
}) => {
  await openSavedMail(page);
  await page
    .getByTestId("mail-message-list")
    .getByRole("link", { name: /Coffee after the workshop/ })
    .click();
  await expect(page.getByTestId("mail-message-detail")).toContainText(
    "I’m free from 12:30 until 14:00."
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          if (!navigator.serviceWorker.controller) return false;
          const cache = await caches.open("verto-mail-shell-v1");
          if (!(await cache.match("/mail"))) return false;
          const resources = [
            ...Array.from(document.scripts, (script) => script.src),
            ...Array.from(
              document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
              (link) => link.href
            ),
          ].filter((url) => new URL(url, location.href).pathname.startsWith("/_next/static/"));
          return (
            resources.length > 0 &&
            (await Promise.all(resources.map((url) => cache.match(url)))).every(Boolean)
          );
        }),
      { timeout: 15000 }
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel("Search saved mail", { exact: true })).toBeVisible();
  await expect(page.getByTestId("mail-local-status")).toHaveAttribute("data-phase", "offline");
  await expect(page.getByTestId("mail-message-detail")).toContainText(
    "I’m free from 12:30 until 14:00."
  );
  await page.getByLabel("Search saved mail", { exact: true }).fill("12:30");
  await expect(page.getByTestId("mail-message-list").getByRole("link")).toHaveCount(1);
  await expect(page.getByTestId("mail-message-list")).toContainText("Coffee after the workshop?");
});

test.describe("saved Mail without an offline shell", () => {
  test.use({ serviceWorkers: "block" });

  test("opens unprefetched messages, folders and accounts offline without reloading the open page", async ({
    page,
    context,
  }) => {
    // Prevent a prefetched server payload from masking a query navigation that requires a network.
    await page.route("**/*", (route) =>
      route.request().headers().rsc === "1" ? route.abort() : route.continue()
    );
    await openSavedMail(page);
    await chooseAccount(page, WORK);
    await expect(page.getByTestId("mail-local-status")).toContainText("2 saved");
    await expect(page.getByTestId("mail-local-status")).toHaveAttribute("data-phase", "idle");
    await chooseAccount(page, PERSONAL);
    const sidebar = page.getByTestId("workspace-mail-panel");
    await sidebar.getByRole("link", { name: "Sent", exact: true }).click();
    await expect(page.getByTestId("mail-local-status")).toHaveAttribute("data-phase", "idle");
    await sidebar.getByRole("link", { name: /^Inbox/ }).click();
    await expect(page.getByTestId("mail-local-status")).toContainText("5 saved");
    const openedAt = await page.evaluate(() => performance.timeOrigin);
    const documentRequests: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest()) documentRequests.push(request.url());
    });

    await context.setOffline(true);
    await expect(page.getByTestId("mail-local-status")).toHaveAttribute("data-phase", "offline");
    const list = page.getByTestId("mail-message-list");
    await list.getByRole("link", { name: /Coffee after the workshop/ }).click();
    await expect(page).toHaveURL(/message=demo-coffee/);
    await expect(page.getByTestId("mail-message-detail")).toContainText(
      "I’m free from 12:30 until 14:00."
    );
    await page.getByRole("link", { name: "Back to Inbox", exact: true }).click();
    await expect(page.getByTestId("mail-message-detail")).toContainText(
      "Select a message to read it."
    );
    await sidebar.getByRole("link", { name: "Sent", exact: true }).click();
    await expect(page).toHaveURL(/folder=SENT/);
    await expect(list.getByRole("link")).toHaveCount(0);
    await sidebar.getByRole("link", { name: /^Inbox/ }).click();
    await expect(list.getByRole("link")).toHaveCount(5);
    await chooseAccount(page, WORK);
    await list.getByRole("link", { name: /Tomorrow's planning session/ }).click();
    await expect(page.getByTestId("mail-message-detail")).toContainText(
      "We will start with the open decisions and leave time to review the next iteration."
    );
    await chooseAccount(page, "All inboxes");
    await expect(page.getByTestId("mail-local-status")).toContainText("7 saved");
    await list.getByRole("link", { name: /Coffee after the workshop/ }).click();
    await expect(page.getByTestId("mail-message-detail")).toContainText(
      "I’m free from 12:30 until 14:00."
    );
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(openedAt);
    expect(documentRequests).toEqual([]);
  });
});
