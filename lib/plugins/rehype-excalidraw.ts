import { visit } from "unist-util-visit";
import type { Root, Element, Text } from "hast";

/**
 * Rehype plugin that intercepts ```` ```excalidraw ```` fenced code blocks
 * **before** the Shiki transformer runs and replaces them with a
 * `<excalidraw-block data-source="…" />` marker element.
 *
 * The `Excalidraw` MDX component picks these up at hydration time and
 * dynamically imports `@excalidraw/excalidraw` to render the scene
 * client-side, keeping the heavy excalidraw bundle out of pages that
 * don't use it.
 *
 * Mirrors the Mermaid integration. MUST be inserted before `rehype-shiki`
 * in the rehype pipeline.
 */
export default function rehypeExcalidraw() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;

      const codeChild = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "code"
      );
      if (!codeChild) return;

      const className = (codeChild.properties?.className ?? []) as string[] | string;
      const classes = Array.isArray(className) ? className : [className];
      const isExcalidraw = classes.some(
        (c) => typeof c === "string" && c === "language-excalidraw"
      );
      if (!isExcalidraw) return;

      const source = codeChild.children
        .filter((c): c is Text => c.type === "text")
        .map((c) => c.value)
        .join("");

      const replacement: Element = {
        type: "element",
        tagName: "excalidraw-block",
        properties: { dataSource: source },
        children: [],
      };

      // Replace the <pre> node entirely with the marker
      parent.children[index] = replacement;
    });
  };
}
