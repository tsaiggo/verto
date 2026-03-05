import { visit } from "unist-util-visit";
import type { Root } from "hast";

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
    visit(tree, (node: any) => {
      if (node.type === "inlineCommentRef") {
        const identifier =
          typeof node.identifier === "string" ? node.identifier : undefined;

        node.type = "element";
        node.tagName = "inline-comment-ref";
        node.properties = identifier ? { dataId: identifier } : {};
        node.children = [];
      }

      if (node.type === "inlineCommentDef") {
        const identifier =
          typeof node.identifier === "string" ? node.identifier : undefined;

        node.type = "element";
        node.tagName = "inline-comment-def";
        node.properties = identifier ? { dataId: identifier } : {};
        // Keep node.children as-is — they contain the comment content
      }
    });
  };
}
