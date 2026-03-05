import { visit } from "unist-util-visit";
import type { Root } from "mdast";

const INLINE_COMMENT_PATTERN = /^c-\d+$/;

/**
 * Remark plugin that transforms footnote references and definitions
 * matching the `[^c-N]` pattern into custom inline comment node types.
 *
 * - `footnoteReference` with identifier matching `c-N` → `inlineCommentRef`
 * - `footnoteDefinition` with identifier matching `c-N` → `inlineCommentDef`
 *
 * Regular footnotes (`[^1]`, `[^2]`, etc.) are left untouched.
 */
export default function remarkInlineComments() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (
        node.type === "footnoteReference" &&
        "identifier" in node &&
        typeof node.identifier === "string" &&
        INLINE_COMMENT_PATTERN.test(node.identifier)
      ) {
        (node as any).type = "inlineCommentRef";
      }

      if (
        node.type === "footnoteDefinition" &&
        "identifier" in node &&
        typeof node.identifier === "string" &&
        INLINE_COMMENT_PATTERN.test(node.identifier)
      ) {
        (node as any).type = "inlineCommentDef";
      }
    });
  };
}
