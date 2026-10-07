import { expect, test } from "playwright/test";

const NOTE = {
  id: "reader-masthead-note",
  filename: "reading-note.md",
  source:
    "# 阅读笔记\n\n把阅读、标注和修改放在同一个工作空间，让每一步都能回到原文。\n\n## 保留上下文\n\n阅读时记下观点与依据，编辑时先对照原文，再决定是否采用建议。\n\n> 原文、引用和笔记一起保存，方便之后继续思考。\n",
  createdAt: "2026-10-06T08:00:00.000Z",
  updatedAt: "2026-10-06T08:00:00.000Z",
  revision: 1,
  status: "draft",
};

for (const variant of [
  { name: "desktop", width: 1207, height: 1244, theme: "light" },
  { name: "mobile", width: 390, height: 844, theme: "light" },
  { name: "dark", width: 1207, height: 1244, theme: "dark" },
]) {
  test.describe(`${variant.name} Reader masthead`, () => {
    test.use({ viewport: { width: variant.width, height: variant.height } });

    test("copies the article without navigation or actions and opens its exact editable source", async ({
      page,
      context,
    }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), variant.theme);
      await page.goto("/library");
      await expect(page.getByRole("region", { name: "Browser library source" })).toContainText(
        "0 articles saved on this browser"
      );
      await page.evaluate(async (note) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("verto.articles");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction("articles", "readwrite");
            transaction.objectStore("articles").put(note);
            transaction.oncomplete = () => resolve();
            transaction.onerror = transaction.onabort = () => reject(transaction.error);
          });
        } finally {
          database.close();
        }
      }, NOTE);
      await page.goto(`/read/local?document=${NOTE.id}`);
      await expect(page.getByRole("heading", { name: "阅读笔记", exact: true })).toBeVisible();
      await expect(page.getByText("Draft", { exact: true })).toBeVisible();
      if (process.env.VERTO_READER_CAPTURE === "true") {
        await page.screenshot({
          path: `.impeccable/review/reader-polish/${variant.name}.jpg`,
          fullPage: true,
        });
      }
      await page.getByRole("button", { name: "Copy page", exact: true }).click();
      await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toContain("阅读笔记");
      expect(copied).toContain("把阅读、标注和修改放在同一个工作空间");
      expect(copied).not.toMatch(/Notes|Draft|Browser library|Bookmark|Edit|Copy page/i);
      await page.getByRole("link", { name: "Edit 阅读笔记", exact: true }).click();
      await expect(page).toHaveURL(`/editor?document=${NOTE.id}`);
      await expect(page.getByRole("combobox", { name: /(?:MDX|Markdown) source/ })).toHaveValue(
        NOTE.source
      );
    });
  });
}
