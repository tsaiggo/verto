import { expect, type Page } from "playwright/test";

const RELATED_TITLE = "Reading questions · 阅读中的问题";
const RELATED_SOURCE = `# ${RELATED_TITLE}\n\nA clear page leaves space for language, images, and your own thoughts.\n\n阅读需要一段安静的距离。文字、来源与自己的想法可以留在同一份文档里。\n\n![Quiet horizon](/qa-document-switching.svg)\n\n${Array.from(
  { length: 15 },
  (_, index) =>
    `## Passage ${index + 1} · 途中笔记\n\nKeep the document close, and follow a question at your own pace. A comfortable reading space makes room for careful observations and unfinished thoughts.\n\n在中文与英文之间，视线能够自然地停留。下一次回来时，仍然可以找到最初的文字。`
).join("\n\n")}\n`;

export async function seedRelatedArticles(page: Page, origin: string) {
  await page.goto(`${origin}/library`);
  await expect(page.getByLabel("Import EPUB or PDF file")).toBeAttached();
  await page.evaluate(async (longSource) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("verto.articles");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("articles", "readwrite");
        [
          {
            id: "qa-parent",
            filename: "research-notebook.md",
            source: "# Research notebook\n\nA parent page with a focused branch.\n",
          },
          {
            id: "qa-current",
            filename: "reading-questions.md",
            source: longSource,
            title: "Reading questions · 阅读中的问题",
            parentId: "qa-parent",
            order: 0,
          },
          {
            id: "qa-sibling",
            filename: "field-notes.md",
            source: "# Field notes\n\nKeep the original words intact.\n",
            parentId: "qa-parent",
            order: 1,
          },
          {
            id: "qa-draft",
            filename: "question-draft.md",
            source: "# Open questions\n\nAn unfinished thought.\n",
            parentId: "qa-parent",
            status: "draft",
            order: 2,
          },
          {
            id: "qa-other",
            filename: "travel-notebook.md",
            source: "# Travel notebook\n\nA different root.\n",
          },
          ...Array.from({ length: 7 }, (_, index) => ({
            id: `qa-archive-${index}`,
            filename: `archive-${index + 1}.md`,
            source: `# Archive ${index + 1}\n\nA saved reference.\n`,
          })),
        ].forEach((record, index) =>
          transaction.objectStore("articles").put({
            createdAt: "2026-10-02T01:00:00.000Z",
            updatedAt: new Date(Date.UTC(2026, 9, 3, 1, index)).toISOString(),
            revision: 1,
            status: "saved",
            ...record,
          })
        );
        transaction.oncomplete = () => resolve();
        transaction.onerror = transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }, RELATED_SOURCE);
}

export async function savedScrollPosition(page: Page, href: string): Promise<number | undefined> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem("verto:reading-state");
    return raw ? JSON.parse(raw).byHref?.[key]?.scrollTop : undefined;
  }, href);
}
