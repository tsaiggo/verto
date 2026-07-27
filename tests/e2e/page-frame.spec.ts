import { expect, test } from "playwright/test";

const routes = [
  {
    path: "/integrations",
    frame: "standard",
    bodyAnchor: '[aria-label="File ownership"]',
  },
  {
    path: "/settings/files",
    frame: "standard",
    bodyAnchor: 'nav[aria-label="Settings sections"]',
  },
  {
    path: "/onboarding/indexing",
    frame: "narrow",
    bodyAnchor: '[aria-label="Onboarding steps"]',
  },
  {
    path: "/recent",
    frame: "narrow",
    bodyAnchor: ".v-page > .dir-index, .v-page > .v-empty",
  },
  {
    path: "/tags",
    frame: "standard",
    bodyAnchor: ".tag-card",
  },
  {
    path: "/bookmarks",
    frame: "standard",
    bodyAnchor: ".v-tabs > .v-tab:first-child",
  },
] as const;

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1440, height: 900 },
]) {
  test.describe(`Shared page frame at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const route of routes) {
      test(`${route.path} aligns page identity and body`, async ({ page }) => {
        await page.goto(route.path);

        const geometry = await page.evaluate(
          ({ frame, bodyAnchor }) => {
            const header = document.querySelector<HTMLElement>(
              `header.pgh[data-page-frame="${frame}"]`
            );
            const anchor = document.querySelector<HTMLElement>(bodyAnchor);
            const body = anchor?.closest<HTMLElement>(`[data-page-frame="${frame}"]`);

            if (!header || !body || !anchor) return null;

            const edges = (element: HTMLElement) => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return {
                boxLeft: rect.left,
                boxRight: rect.right,
                boxWidth: rect.width,
                contentLeft: rect.left + Number.parseFloat(style.paddingLeft),
                contentRight: rect.right - Number.parseFloat(style.paddingRight),
              };
            };

            const headerScroll = header.closest<HTMLElement>("#main-content");
            const bodyScroll = body.closest<HTMLElement>("#main-content");
            const headerLeft = header.querySelector<HTMLElement>(".pgh-left");

            return {
              header: edges(header),
              body: edges(body),
              anchorLeft: anchor.getBoundingClientRect().left,
              headerContentLeft: headerLeft?.getBoundingClientRect().left ?? null,
              sharedScroll: Boolean(headerScroll && headerScroll === bodyScroll),
              rootClientWidth: document.documentElement.clientWidth,
              rootScrollWidth: document.documentElement.scrollWidth,
            };
          },
          { frame: route.frame, bodyAnchor: route.bodyAnchor }
        );

        expect(geometry).not.toBeNull();
        expect(geometry!.sharedScroll).toBe(true);
        expect(geometry!.rootScrollWidth).toBeLessThanOrEqual(geometry!.rootClientWidth + 1);
        expect(Math.abs(geometry!.header.boxLeft - geometry!.body.boxLeft)).toBeLessThanOrEqual(1);
        expect(Math.abs(geometry!.header.boxRight - geometry!.body.boxRight)).toBeLessThanOrEqual(
          1
        );
        expect(
          Math.abs(geometry!.header.contentLeft - geometry!.body.contentLeft)
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(geometry!.header.contentRight - geometry!.body.contentRight)
        ).toBeLessThanOrEqual(1);

        if (viewport.width >= 768) {
          expect(geometry!.headerContentLeft).not.toBeNull();
          expect(Math.abs(geometry!.headerContentLeft! - geometry!.anchorLeft)).toBeLessThanOrEqual(
            1
          );
        }

        const expectedMaxWidth = route.frame === "standard" ? 1184 : 920;
        expect(geometry!.header.boxWidth).toBeLessThanOrEqual(expectedMaxWidth + 1);
        expect(geometry!.body.boxWidth).toBeLessThanOrEqual(expectedMaxWidth + 1);
      });
    }
  });
}
