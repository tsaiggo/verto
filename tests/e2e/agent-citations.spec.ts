import { expect, test, type Page } from "playwright/test";
import { documentBlocks } from "../../lib/agent-content/blocks";
import { contentVersion } from "../../lib/agent-content/identity";
import type { ContentDocument } from "../../lib/agent-content/types";

const source = `# Citation notebook\n\nFirst unique observation anchors the notebook.\n\n${"Earlier background paragraph.\n\n".repeat(80)}The cobalt owl is evidence near the end.\n`;

async function seed(page: Page) {
  await page.goto("/library");
  await expect(page.getByLabel("Import EPUB or PDF file")).toBeAttached();
  await page.evaluate(async (text) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("verto.articles", 3);
      request.onupgradeneeded = () => {
        for (const name of ["articles", "documents", "mdx-books"])
          if (!request.result.objectStoreNames.contains(name))
            request.result.createObjectStore(name, { keyPath: "id" });
        for (const name of ["document-bytes", "book-assets"])
          if (!request.result.objectStoreNames.contains(name))
            request.result.createObjectStore(name);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("articles", "readwrite");
        tx.objectStore("articles").put({
          id: "citation-fixture",
          filename: "citation.md",
          source: text,
          revision: 1,
          status: "saved",
          createdAt: "2026-10-06T00:00:00Z",
          updatedAt: "2026-10-06T00:00:00Z",
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, source);
}

async function citationDocument(): Promise<ContentDocument> {
  return {
    id: "managed:citation-fixture",
    title: "Citation notebook",
    href: "/read/local?document=citation-fixture",
    version: await contentVersion(source, 1),
    format: "md",
    draft: false,
    tags: [],
    sourceLabel: "Fixture",
  };
}

test("a retrieved late passage opens and focuses its paragraph in Reader", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seed(page);
  const blocks = documentBlocks(await citationDocument(), source);
  const citation = blocks.find((block) => block.text.includes("cobalt owl"))!.citation;
  await page.goto(citation.href);
  const target = page.locator("article p").filter({ hasText: "The cobalt owl" });
  await expect(target).toBeFocused();
  await expect(target).toHaveAttribute("data-agent-source-active", "true");
  await expect
    .poll(() => page.locator("[data-page-scroll]").evaluate((element) => element.scrollTop))
    .toBeGreaterThan(1000);
  expect(errors).toEqual([]);
});

test("stale ambiguous citations are reported without selecting another paragraph", async ({
  page,
}) => {
  await seed(page);
  const blocks = documentBlocks(await citationDocument(), source);
  const repeated = blocks.filter((block) => block.text === "Earlier background paragraph.")[1]
    .citation;
  const url =
    repeated.href.split("#")[0] +
    "#verto-citation=" +
    encodeURIComponent(
      JSON.stringify({
        ...repeated,
        version: "content:older-version",
      })
    );
  await page.goto(url);
  await expect(
    page.getByRole("status").filter({ hasText: "cited passage could not be located" })
  ).toBeVisible();
  await expect(page.locator("[data-agent-source-active]")).toHaveCount(0);
});

test("repeated same-document citation clicks move focus after client history pushes", async ({
  page,
}) => {
  await seed(page);
  const blocks = documentBlocks(await citationDocument(), source);
  const first = blocks.find((block) => block.text.startsWith("First unique observation"))!;
  const last = blocks.find((block) => block.text.includes("cobalt owl"))!;
  await page.goto(first.citation.href);
  const firstTarget = page.locator("article p").filter({ hasText: first.text });
  const lastTarget = page.locator("article p").filter({ hasText: last.text });
  await expect(firstTarget).toBeFocused();

  // A client router pushes fragment URLs without native hashchange. Use the
  // existing Next history state so its patched handler preserves this document.
  await page.evaluate(
    (citations) => {
      const navigation = document.createElement("nav");
      navigation.setAttribute("aria-label", "Citation navigation fixture");
      Object.assign(navigation.style, { position: "fixed", top: "0", right: "0", zIndex: "9999" });
      for (const [label, href] of citations) {
        const link = document.createElement("a");
        link.textContent = label;
        link.href = href;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          history.pushState(history.state, "", href);
        });
        navigation.append(link);
      }
      document.body.append(navigation);
    },
    [
      ["Open last citation", last.citation.href],
      ["Return to first citation", first.citation.href],
    ]
  );
  const navigation = page.getByRole("navigation", { name: "Citation navigation fixture" });
  await navigation.getByRole("link", { name: "Open last citation" }).click();
  await expect(lastTarget).toBeFocused();
  await expect(lastTarget).toHaveAttribute("data-agent-source-active", "true");
  await expect(firstTarget).not.toHaveAttribute("data-agent-source-active", "true");
  await navigation.getByRole("link", { name: "Return to first citation" }).click();
  await expect(firstTarget).toBeFocused();
  await expect(firstTarget).toHaveAttribute("data-agent-source-active", "true");
  await expect(lastTarget).not.toHaveAttribute("data-agent-source-active", "true");
  await expect(page.locator("[data-agent-source-active]")).toHaveCount(1);
});
