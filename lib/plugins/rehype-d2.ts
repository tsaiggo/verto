import { visit } from "unist-util-visit";
import type { Root, Element, Text } from "hast";

/**
 * Rehype plugin that intercepts ```` ```d2 ```` fenced code blocks
 * **before** the Shiki transformer runs and replaces them with a
 * `<d2-block data-source="…" />` marker element.
 *
 * The `D2` MDX component picks these up at hydration time and dynamically
 * imports `@terrastruct/d2` (WASM, ~3MB) to render them client-side,
 * keeping the heavy bundle out of pages that don't use D2.
 *
 * Mirrors the Mermaid and Excalidraw integrations. MUST be inserted
 * before `rehype-shiki` in the rehype pipeline.
 */
export default function rehypeD2() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;

      const codeChild = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "code"
      );
      if (!codeChild) return;

      const className = (codeChild.properties?.className ?? []) as string[] | string;
      const classes = Array.isArray(className) ? className : [className];
      const isD2 = classes.some((c) => typeof c === "string" && c === "language-d2");
      if (!isD2) return;

      const source = codeChild.children
        .filter((c): c is Text => c.type === "text")
        .map((c) => c.value)
        .join("");

      const replacement: Element = {
        type: "element",
        tagName: "d2-block",
        properties: { dataSource: source },
        children: [],
      };

      // Replace the <pre> node entirely with the marker
      parent.children[index] = replacement;
    });
  };
}
