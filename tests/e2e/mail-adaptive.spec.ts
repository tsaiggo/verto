import { expect, test } from "playwright/test";

const WORK_ADDRESS = "alexandria.morgan@product-strategy.northstar-example.com";
const WORK_SUBJECT =
  "Research handoff: reading workflows, account switching, and the decisions we need to review before the next design session";
const WORK_MESSAGE =
  "/mail?demo=1&account=microsoft%3Ademo-microsoft-example&folder=inbox&message=demo-work-long";

test.use({ viewport: { width: 1024, height: 720 } });

test("expanded Mail subject, addresses and long URL wrap inside the desktop reading pane", async ({
  page,
}) => {
  await page.goto(WORK_MESSAGE);
  const detail = page.getByTestId("mail-message-detail");
  const subject = detail.getByRole("heading", { name: WORK_SUBJECT, exact: true });
  await expect(subject).toBeVisible();
  expect(
    await subject.evaluate((element) => {
      const style = getComputedStyle(element);
      return element.clientHeight > Number.parseFloat(style.lineHeight);
    })
  ).toBe(true);

  await detail.locator("summary").click();
  const recipients = detail.locator("details dl");
  await expect(recipients).toBeVisible();
  await expect(recipients).toContainText(WORK_ADDRESS);
  await expect(recipients).toContainText("reading-and-knowledge-research@northstar-example.com");
  await expect(detail).toContainText(
    "https://example.com/research/reading-workflows/account-switching/expanded-message-details/long-addresses-and-adaptive-text-layout-for-the-next-design-session"
  );

  for (const width of [1024, 1040]) {
    await page.setViewportSize({ width, height: 720 });
    const geometry = await detail.evaluate((pane) => {
      const elements = pane.querySelectorAll<HTMLElement>("h2, dd, time, article");
      return {
        paneWidth: pane.clientWidth,
        paneScrollWidth: pane.scrollWidth,
        contentFits: Array.from(elements).every(
          (element) => element.scrollWidth <= element.clientWidth + 1
        ),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        pageTop: window.scrollY,
      };
    });
    expect(geometry.paneScrollWidth).toBeLessThanOrEqual(geometry.paneWidth + 1);
    expect(geometry.contentFits).toBe(true);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.pageTop).toBe(0);
  }
});

test("expanded composer fields grow vertically while From identity and Send stay reachable", async ({
  page,
}) => {
  await page.goto(WORK_MESSAGE);
  await expect(page.getByRole("button", { name: "Compose", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const composer = page.getByRole("form", { name: "Message draft" });
  await expect(composer.locator("header")).toContainText(WORK_ADDRESS);
  await composer.getByRole("button", { name: "Cc", exact: true }).click();
  await composer.getByRole("button", { name: "Bcc", exact: true }).click();
  const addresses =
    "Workspace Experience Review <workspace-experience-review@northstar-example.com>, Reading and Knowledge Research <reading-and-knowledge-research@northstar-example.com>";
  for (const label of ["To", "Cc", "Bcc"]) {
    const field = composer.getByLabel(label, { exact: true });
    await field.fill(addresses);
    await expect(field).toHaveValue(addresses);
  }
  const subject = composer.getByLabel("Subject", { exact: true });
  await subject.fill(`${WORK_SUBJECT} — follow-up for the research and platform teams`);
  await composer
    .getByLabel("Message body", { exact: true })
    .fill("Review notes stay in this draft.");
  const send = composer.getByRole("button", { name: "Send preview", exact: true });
  await expect(send).toBeInViewport({ ratio: 1 });
  const fieldGeometry = await composer.getByLabel("To", { exact: true }).evaluate((element) => ({
    height: element.clientHeight,
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(fieldGeometry.height).toBeGreaterThan(38);
  expect(fieldGeometry.height).toBeLessThanOrEqual(74);
  expect(fieldGeometry.scrollWidth).toBeLessThanOrEqual(fieldGeometry.width + 1);

  await composer.getByLabel("To", { exact: true }).fill("invalid-address");
  await send.click();
  await expect(composer.getByRole("alert")).toBeInViewport({ ratio: 1 });
  await expect(send).toBeInViewport({ ratio: 1 });
  const geometry = await composer.evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    pageTop: window.scrollY,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.pageTop).toBe(0);
});
