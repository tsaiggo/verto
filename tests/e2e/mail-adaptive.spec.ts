import { expect, test, type Page } from "playwright/test";

const WORK_ADDRESS = "alexandria.morgan@product-strategy.northstar-example.com";
const WORK_SUBJECT =
  "Research handoff: reading workflows, account switching, and the decisions we need to review before the next design session";
const WORK_MESSAGE =
  "/mail?demo=1&account=microsoft%3Ademo-microsoft-example&folder=inbox&message=demo-work-long";
const LONG_URL =
  "https://example.com/research/reading-workflows/account-switching/expanded-message-details/long-addresses-and-adaptive-text-layout-for-the-next-design-session";
const PERSONAL_MESSAGE =
  "/mail?demo=1&account=google%3Ademo-google-example&folder=INBOX&message=demo-design-review";

async function expectWideReadingGeometry(page: Page, withAttachments = false) {
  const detail = page.getByTestId("mail-message-detail");
  await expect(detail.getByTestId("mail-message-body")).toBeVisible();
  await expect(detail.getByTestId("mail-message-heading-content")).toBeVisible();
  if (withAttachments)
    await expect(detail.getByTestId("mail-message-attachments")).toContainText(
      "design-review-notes.txt"
    );
  const list = await page.getByRole("region", { name: "Messages", exact: true }).boundingBox();
  expect(list).not.toBeNull();
  expect(list!.width).toBeGreaterThanOrEqual(268);
  expect(list!.width).toBeLessThanOrEqual(381);
  const geometry = await detail.evaluate((pane) => {
    const body = pane.querySelector<HTMLElement>('[data-testid="mail-message-body"]')!;
    const heading = pane.querySelector<HTMLElement>(
      '[data-testid="mail-message-heading-content"]'
    )!;
    const attachments = pane.querySelector<HTMLElement>('[data-testid="mail-message-attachments"]');
    const bodyRect = body.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const attachmentRect = attachments?.getBoundingClientRect();
    const paneRect = pane.getBoundingClientRect();
    return {
      bodyWidth: bodyRect.width,
      centerOffset: Math.abs(
        bodyRect.left +
          bodyRect.width / 2 -
          (paneRect.left + pane.clientLeft + pane.clientWidth / 2)
      ),
      headingOffset: Math.abs(headingRect.left - bodyRect.left),
      headingWidthDifference: Math.abs(headingRect.width - bodyRect.width),
      attachmentOffset: attachmentRect ? Math.abs(attachmentRect.left - bodyRect.left) : undefined,
      attachmentWidthDifference: attachmentRect
        ? Math.abs(attachmentRect.width - bodyRect.width)
        : undefined,
      contentFits: Array.from(pane.querySelectorAll<HTMLElement>("h2, dd, time, article")).every(
        (element) => element.scrollWidth <= element.clientWidth + 1
      ),
      bodyFits: body.scrollWidth <= body.clientWidth + 1,
      paneFits: pane.scrollWidth <= pane.clientWidth + 1,
      documentFits: document.documentElement.scrollWidth <= window.innerWidth + 1,
    };
  });
  expect(geometry.bodyWidth).toBeGreaterThanOrEqual(480);
  expect(geometry.bodyWidth).toBeLessThanOrEqual(700);
  expect(geometry.centerOffset).toBeLessThanOrEqual(2);
  expect(geometry.headingOffset).toBeLessThanOrEqual(1);
  expect(geometry.headingWidthDifference).toBeLessThanOrEqual(1);
  if (withAttachments) {
    expect(geometry.attachmentOffset).toBeLessThanOrEqual(1);
    expect(geometry.attachmentWidthDifference).toBeLessThanOrEqual(1);
  }
  expect(geometry.contentFits).toBe(true);
  expect(geometry.bodyFits).toBe(true);
  expect(geometry.paneFits).toBe(true);
  expect(geometry.documentFits).toBe(true);
}

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
  await expect(detail).toContainText(LONG_URL);

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

for (const viewport of [
  { width: 2560, height: 1440 },
  { width: 3480, height: 1863 },
]) {
  test(`Mail keeps the list bounded and reading content centered at ${viewport.width}px desktop width`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(WORK_MESSAGE);
    const detail = page.getByTestId("mail-message-detail");
    await expect(detail.getByRole("heading", { name: WORK_SUBJECT, exact: true })).toBeVisible();
    await detail.locator("summary").click();
    await expect(detail.locator("details dl")).toContainText(WORK_ADDRESS);
    await expect(detail.getByTestId("mail-message-body")).toContainText(LONG_URL);
    await expectWideReadingGeometry(page);

    await page.goto(PERSONAL_MESSAGE);
    await expect(
      detail.getByRole("heading", { name: "Design review notes and next steps", exact: true })
    ).toBeVisible();
    await expectWideReadingGeometry(page, true);
  });
}

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
