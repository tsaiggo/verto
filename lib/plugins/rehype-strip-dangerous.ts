import { visit, SKIP } from "unist-util-visit";
import type { Root, Element } from "hast";

/**
 * Strips document-structure tags (`base`, `link`, `meta`, `html`, `head`,
 * `body`) from raw HTML in `.md` files. They survive `rehype-raw` but are not
 * covered by its `tagfilter` option, and can hijack the page: `<base>` rewrites
 * relative URLs, `<link>` injects stylesheets, `<meta http-equiv="refresh">`
 * redirects. MUST run immediately after `rehype-raw` (paired with its
 * `tagfilter: true`, which handles `style`/`script`/`iframe`).
 */
const DANGEROUS_TAGS = new Set([
  "html",
  "head",
  "body",
  "base",
  "link",
  "meta",
]);

export default function rehypeStripDangerous() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (
        parent &&
        typeof index === "number" &&
        DANGEROUS_TAGS.has(node.tagName.toLowerCase())
      ) {
        parent.children.splice(index, 1);
        // Re-visit the index now occupied by the following sibling.
        return [SKIP, index];
      }
    });
  };
}
