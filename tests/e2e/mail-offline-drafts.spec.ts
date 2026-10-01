import { expect, test, type Page } from "playwright/test";

const PERSONAL = {
  id: "offline-personal-account",
  provider: "google" as const,
  displayName: "Alice Chen",
  address: "alice.chen@example.com",
};
const WORK = {
  id: "offline-work-account",
  provider: "google" as const,
  displayName: "Jordan Wu",
  address: "jordan.wu@example.com",
};
const PERSONAL_SCOPE = `google:${PERSONAL.id}`;
const WORK_SUBJECT = "Cached project handoff";

/** Real mailbox records with no OAuth grant: restored sessions must use their local cache. */
async function openCachedAccounts(page: Page) {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    if (/gmail\.googleapis\.com|graph\.microsoft\.com/.test(request.url()))
      providerRequests.push(request.url());
  });
  // A configured Google client must not turn this local-only fixture into a real login.
  await page.route("https://accounts.google.com/**", (route) => route.abort());
  await page.goto("/");
  await page.evaluate(
    async ({ accounts, activeAccountId }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("verto.mail.library", 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore("accounts", { keyPath: "scope" });
          const messages = db.createObjectStore("messages", { keyPath: ["scope", "id"] });
          messages.createIndex("scope", "scope");
          const folders = db.createObjectStore("folders", {
            keyPath: ["scope", "folderId"],
          });
          folders.createIndex("scope", "scope");
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(
            ["accounts", "folders", "messages"],
            "readwrite"
          );
          transaction.oncomplete = () => resolve();
          transaction.onabort = () => reject(transaction.error);
          transaction.onerror = () => reject(transaction.error);
          accounts.forEach((account, index) => {
            const scope = `${account.provider}:${account.id}`;
            const message = {
              id: `cached-message-${index}`,
              subject: index ? "Cached project handoff" : "Cached personal reading notes",
              from: "Coworker <coworker@example.net>",
              receivedAt: "2026-10-01T08:00:00.000Z",
              preview: index ? "Work notes kept offline." : "Personal notes kept offline.",
              isRead: true,
              hasAttachments: false,
              to: [account.address],
              bodyText: index ? "Work notes kept offline." : "Personal notes kept offline.",
              internetMessageId: `<cached-message-${index}@example.net>`,
            };
            transaction.objectStore("accounts").put({
              scope,
              connection: {
                account,
                folders: [
                  { id: "INBOX", name: "Inbox", kind: "inbox", unreadCount: 0 },
                  { id: "SENT", name: "Sent", kind: "sent" },
                ],
              },
              savedAt: Date.now(),
              generation: 0,
              revision: 0,
            });
            transaction.objectStore("folders").put({
              scope,
              folderId: "INBOX",
              messageIds: [message.id],
              lastSyncedAt: Date.now(),
            });
            transaction.objectStore("messages").put({ scope, id: message.id, message });
          });
        });
        localStorage.setItem(
          "verto.mail.accounts.v1",
          JSON.stringify({ version: 1, accounts, activeAccountId })
        );
      } finally {
        database.close();
      }
    },
    { accounts: [PERSONAL, WORK], activeAccountId: PERSONAL_SCOPE }
  );
  await page.goto(`/mail?account=${encodeURIComponent(PERSONAL_SCOPE)}&folder=INBOX`);
  await expect(page.getByTestId("mail-message-list")).toContainText(
    "Cached personal reading notes"
  );
  await expect(page.getByRole("button", { name: /^Switch mail account/ })).toContainText(
    PERSONAL.address
  );
  return providerRequests;
}

async function chooseAccount(page: Page, address: string) {
  await page.getByRole("button", { name: /^Switch mail account/ }).click();
  await page.getByRole("menuitemradio").filter({ hasText: address }).click();
  await expect(page.getByRole("button", { name: /^Switch mail account/ })).toContainText(address);
}

async function waitForOfflineShell(page: Page) {
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
}

test.use({ viewport: { width: 1207, height: 900 } });

test("creates and reopens a local draft when a cached real account cannot restore OAuth", async ({
  page,
}) => {
  const providerRequests = await openCachedAccounts(page);
  await page.reload();
  await expect(page.getByTestId("mail-message-list")).toContainText(
    "Cached personal reading notes"
  );
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  let composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.locator("header")).toContainText(PERSONAL.address);
  await composer.getByLabel("To", { exact: true }).fill("recipient@example.net");
  await composer
    .getByLabel("Subject", { exact: true })
    .fill("A draft without an active OAuth grant");
  await composer
    .getByLabel("Message body", { exact: true })
    .fill("These words only need local storage.");
  await expect(composer.getByRole("button", { name: "Send mail", exact: true })).toHaveCount(0);
  await composer.getByRole("button", { name: "Enable sending", exact: true }).click();
  await expect(composer.getByRole("alert")).toContainText("Reconnect this account");
  await composer.getByRole("button", { name: "Save & close", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: /Local drafts/ }).click();
  await page.getByRole("button", { name: /A draft without an active OAuth grant/ }).click();
  composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
    "These words only need local storage."
  );
  await expect(composer.locator("header")).toContainText(PERSONAL.address);
  expect(providerRequests).toEqual([]);
});

test("creates an offline draft after reload and moves From to another cached account without duplicating it", async ({
  page,
  context,
}) => {
  const providerRequests = await openCachedAccounts(page);
  await waitForOfflineShell(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId("mail-message-list")).toContainText(
    "Cached personal reading notes"
  );
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  let composer = page.getByRole("form", { name: "Message draft" });
  await composer.getByLabel("Subject", { exact: true }).fill("An offline draft moved to work");
  await composer
    .getByLabel("Message body", { exact: true })
    .fill("Preserve my text while changing From offline.");
  await composer.getByRole("button", { name: /^From account:/ }).click();
  const workOption = page.getByRole("menuitem").filter({ hasText: WORK.address });
  await expect(workOption).not.toHaveAttribute("data-disabled", "");
  await workOption.click();
  composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.locator("header")).toContainText(WORK.address);
  await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
    "Preserve my text while changing From offline."
  );
  await expect(composer.getByRole("button", { name: "Send mail", exact: true })).toHaveCount(0);
  await composer.getByRole("button", { name: "Enable sending", exact: true }).click();
  await expect(composer.getByRole("alert")).toContainText("Reconnect this account");
  await composer.getByRole("button", { name: "Save & close", exact: true }).click();
  await expect(page.getByRole("button", { name: /Local drafts/ })).toContainText("0");
  await chooseAccount(page, WORK.address);
  await expect(page.getByRole("button", { name: /Local drafts/ })).toContainText("1");
  await page.reload();
  await page.getByRole("button", { name: /Local drafts/ }).click();
  await page.getByRole("button", { name: /An offline draft moved to work/ }).click();
  composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.locator("header")).toContainText(WORK.address);
  await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
    "Preserve my text while changing From offline."
  );
  await composer.getByRole("button", { name: "Save & close", exact: true }).click();
  await chooseAccount(page, PERSONAL.address);
  await page.getByRole("button", { name: /Local drafts/ }).click();
  await expect(page.getByRole("button", { name: /An offline draft moved to work/ })).toHaveCount(0);
  expect(providerRequests).toEqual([]);
});

test("uses a cached account for unified Compose and keeps offline reply and forward with the receiving account", async ({
  page,
  context,
}) => {
  const providerRequests = await openCachedAccounts(page);
  await chooseAccount(page, "All inboxes");
  await expect(page.getByTestId("mail-message-list").getByRole("link")).toHaveCount(2);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  let composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.locator("header")).toContainText(PERSONAL.address);
  await composer.getByLabel("Subject", { exact: true }).fill("Unified inbox offline compose");
  await composer.getByRole("button", { name: "Save & close", exact: true }).click();
  await page
    .getByTestId("mail-message-list")
    .getByRole("link", { name: new RegExp(WORK_SUBJECT) })
    .click();
  const detail = page.getByTestId("mail-message-detail");
  await expect(detail).toContainText(`Received by ${WORK.address}`);
  await detail.getByRole("button", { name: "Reply", exact: true }).click();
  composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.locator("header")).toContainText(WORK.address);
  await expect(composer.getByRole("button", { name: /^From account:/ })).toHaveCount(0);
  await expect(composer.getByLabel("To", { exact: true })).toHaveValue("coworker@example.net");
  await composer
    .getByLabel("Message body", { exact: true })
    .fill("An offline response from the receiving account.");
  await composer.getByRole("button", { name: "Save & close", exact: true }).click();
  await detail.getByRole("button", { name: "Forward", exact: true }).click();
  composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.locator("header")).toContainText(WORK.address);
  await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
    /Work notes kept offline\./
  );
  await composer.getByRole("button", { name: "Save & close", exact: true }).click();
  await chooseAccount(page, PERSONAL.address);
  await expect(page.getByRole("button", { name: /Local drafts/ })).toContainText("1");
  await chooseAccount(page, WORK.address);
  await expect(page.getByRole("button", { name: /Local drafts/ })).toContainText("2");
  await page.getByRole("button", { name: /Local drafts/ }).click();
  await page.getByRole("button", { name: /Re: Cached project handoff/ }).click();
  composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
    "An offline response from the receiving account."
  );
  await expect(composer.locator("header")).toContainText(WORK.address);
  expect(providerRequests).toEqual([]);
});
