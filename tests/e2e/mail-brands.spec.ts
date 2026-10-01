import { expect, test, type Locator } from "playwright/test";

const PREVIEW = "/mail?demo=1&preview=brands&folder=INBOX&message=demo-brand-google";
const BRANDS = [
  "google",
  "gmail",
  "apple",
  "microsoft",
  "github",
  "notion",
  "amazon",
  "spotify",
  "slack",
  "dropbox",
];

async function expectLoadedBrand(scope: Locator, brand: string) {
  const mark = scope.locator(`[data-brand="${brand}"] img`);
  await expect
    .poll(() =>
      mark.evaluate((element) => {
        const image = element as HTMLImageElement;
        const source = new URL(image.src, location.href);
        return source.origin === location.origin ? source.pathname : null;
      })
    )
    .toBe(`/mail/brands/${brand}.svg`);
  await expect
    .poll(() =>
      mark.evaluate((element) => {
        const image = element as HTMLImageElement;
        return image.complete && image.naturalWidth > 0;
      })
    )
    .toBe(true);
}

test.use({ viewport: { width: 1207, height: 900 } });

test("shows the local brand pack and preserves its opt-in scope through mail navigation", async ({
  page,
}) => {
  await page.goto(PREVIEW);
  const list = page.getByTestId("mail-message-list");
  const detail = page.getByTestId("mail-message-detail");
  await expect(list.getByRole("link")).toHaveCount(10);
  await expect(detail.getByRole("heading", { name: "Your workspace, in focus" })).toBeVisible();
  await expect(detail).toContainText("It was not sent by Google");
  for (const brand of BRANDS) {
    await list.locator(`[data-brand="${brand}"]`).scrollIntoViewIfNeeded();
    await expectLoadedBrand(list, brand);
  }
  await expectLoadedBrand(detail, "google");

  await list.getByRole("link", { name: /Your latest receipt is ready/ }).click();
  await expect(page).toHaveURL(/demo=1&preview=brands&folder=INBOX&message=demo-brand-apple$/);
  await expectLoadedBrand(detail, "apple");
  await detail.getByRole("link", { name: "Back to Inbox", exact: true }).click();
  await expect(page).toHaveURL(/demo=1&preview=brands&folder=INBOX$/);
  await expect(detail).toContainText("Select a message to read it.");

  const folders = page.locator("#main-content").getByRole("navigation", { name: "Mail folders" });
  await folders.getByRole("link", { name: "Archive", exact: true }).click();
  await expect(page).toHaveURL(/demo=1&preview=brands&folder=ARCHIVE$/);
  await expect(list.getByRole("heading", { name: "No messages in this folder." })).toBeVisible();
  const sidebar = page.getByTestId("workspace-mail-panel");
  await sidebar.getByRole("link", { name: "Inbox 3", exact: true }).click();
  await expect(page).toHaveURL(/demo=1&preview=brands&folder=INBOX$/);
  await expect(list.getByRole("link")).toHaveCount(10);

  await page.getByRole("button", { name: /^Switch mail account/ }).click();
  const account = page.getByRole("menuitemradio").filter({ hasText: "brand-preview@example.com" });
  await expect(account).toHaveAttribute(
    "href",
    "/mail?demo=1&preview=brands&account=google%3Ademo-brand-preview&folder=INBOX"
  );
  await account.click();
  await expect(page).toHaveURL(/preview=brands&account=google%3Ademo-brand-preview&folder=INBOX$/);
  await expect(list.getByRole("link")).toHaveCount(10);

  await page.goto("/mail?demo=1&folder=INBOX&message=demo-coffee");
  await expect(list.getByRole("link")).toHaveCount(5);
  await expect(detail.getByRole("heading", { name: "Coffee after the workshop?" })).toBeVisible();
  await expect(detail.locator("[data-brand]")).toHaveCount(0);
  await expect(detail.locator("[data-tone]")).toHaveText("LE");
  await expect(list.locator("[data-brand]")).toHaveCount(0);
});

test("keeps the sender's initials readable when a local brand image cannot load", async ({
  page,
}) => {
  await page.route("**/mail/brands/google.svg", (route) => route.abort());
  await page.goto(PREVIEW);
  const list = page.getByTestId("mail-message-list");
  const detail = page.getByTestId("mail-message-detail");
  const googleRow = list.getByRole("link", { name: /Your workspace, in focus/ });
  await expect(detail.getByRole("heading", { name: "Your workspace, in focus" })).toBeVisible();
  await expect(googleRow.locator("[data-tone]")).toHaveText("G");
  await expect(detail.locator("[data-tone]")).toHaveText("G");
  await expect(googleRow.locator("[data-brand]")).toHaveCount(0);
  await expect(detail.locator("[data-brand]")).toHaveCount(0);
  await expectLoadedBrand(list, "gmail");
});
