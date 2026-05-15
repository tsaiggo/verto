import { visit } from "unist-util-visit";
import type { Root, Element, Text } from "hast";

/**
 * Rehype plugin that intercepts ```` ```mermaid ```` fenced code blocks
 * **before** the Shiki transformer runs and replaces them with a
 * `<mermaid-block data-source="…" />` marker element.
 *
 * The `Mermaid` MDX component picks these up at hydration time and
 * dynamically imports `mermaid` to render them client-side, keeping the
 * heavy mermaid bundle out of pages that don't use it.
 *
 * MUST be inserted before `rehype-shiki` in the rehype pipeline.
 */
export default function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;

      const codeChild = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "code",
      );
      if (!codeChild) return;

      const className = (codeChild.properties?.className ?? []) as
        | string[]
        | string;
      const classes = Array.isArray(className) ? className : [className];
      const isMermaid = classes.some(
        (c) => typeof c === "string" && c === "language-mermaid",
      );
      if (!isMermaid) return;

      const source = codeChild.children
        .filter((c): c is Text => c.type === "text")
        .map((c) => c.value)
        .join("");

      const replacement: Element = {
        type: "element",
        tagName: "mermaid-block",
        properties: { dataSource: source },
        children: [],
      };

      // Replace the <pre> node entirely with the marker
      (parent.children as Element[])[index] = replacement;
    });
  };
}
