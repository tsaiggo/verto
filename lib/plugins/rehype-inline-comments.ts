import { visit } from "unist-util-visit";
import type { Root } from "hast";
import type { Node } from "unist";

/**
 * Rehype plugin that transforms custom inline comment nodes into proper HAST elements.
 *
 * Expects `inlineCommentRef` and `inlineCommentDef` nodes to arrive in the HAST tree
 * via `remarkRehypeOptions: { passThrough: ['inlineCommentRef', 'inlineCommentDef'] }`.
 *
 * Transforms:
 * - `inlineCommentRef` → `<inline-comment-ref data-id="c-N" />`
 * - `inlineCommentDef` → `<inline-comment-def data-id="c-N">...children...</inline-comment-def>`
 *
 * The kebab-case tag names allow MDX component mapping to pick them up.
 */
export default function rehypeInlineComments() {
  return (tree: Root) => {
    visit(tree, (node: Node) => {
      if (node.type === "inlineCommentRef") {
        const identifier =
          "identifier" in node && typeof node.identifier === "string"
            ? node.identifier
            : undefined;

        Object.assign(node, {
          type: "element",
          tagName: "inline-comment-ref",
          properties: identifier ? { dataId: identifier } : {},
          children: [],
        });
      }

      if (node.type === "inlineCommentDef") {
        const identifier =
          "identifier" in node && typeof node.identifier === "string"
            ? node.identifier
            : undefined;

        Object.assign(node, {
          type: "element",
          tagName: "inline-comment-def",
          properties: identifier ? { dataId: identifier } : {},
          // children are preserved — they contain the comment content
        });
      }
    });
  };
}
