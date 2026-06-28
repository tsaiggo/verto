import fs from "node:fs/promises";
import path from "node:path";

import { importEpub } from "../lib/epub/import";

function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main(): Promise<void> {
  const epubPath = process.argv[2];
  if (!epubPath || epubPath.startsWith("--")) {
    console.error(
      "Usage: tsx scripts/import-epub.ts <book.epub> [--out content] [--public public] [--prefix '']"
    );
    process.exit(1);
  }

  const outDir = flag("--out", "content");
  const publicDir = flag("--public", "public");
  const imageUrlPrefix = flag("--prefix", "");

  const bytes = new Uint8Array(await fs.readFile(epubPath));
  const book = await importEpub(bytes, { imageUrlPrefix });

  const bookDir = path.join(outDir, book.slug);
  await fs.mkdir(bookDir, { recursive: true });

  const indexFrontmatter =
    `---\ntitle: ${JSON.stringify(book.title)}\n` +
    (book.author ? `author: ${JSON.stringify(book.author)}\n` : "") +
    `---\n\nImported from EPUB.\n`;
  await fs.writeFile(path.join(bookDir, "_index.md"), indexFrontmatter, "utf8");

  const pad = String(book.chapters.length).length;
  for (const chapter of book.chapters) {
    const name = `${String(chapter.order + 1).padStart(pad, "0")}-${chapter.slug}.mdx`;
    await fs.writeFile(path.join(bookDir, name), chapter.mdx, "utf8");
  }

  for (const image of book.images) {
    const dest = path.join(publicDir, book.slug, image.outPath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, image.data);
  }

  console.log(`Imported "${book.title}"${book.author ? ` by ${book.author}` : ""}`);
  console.log(`  ${book.chapters.length} chapters -> ${bookDir}/`);
  console.log(`  ${book.images.length} images -> ${path.join(publicDir, book.slug)}/`);
  console.log(`  open: /read/${book.slug}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
