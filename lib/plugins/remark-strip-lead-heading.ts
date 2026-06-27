import type { Root } from "mdast";

// Verto renders the document title separately (frontmatter `title`, falling
// back to the first H1). A body that also opens with `# Title` would print the
// title twice, so the leading top-level heading is dropped from the body here.
export default function remarkStripLeadHeading() {
  return (tree: Root): void => {
    const first = tree.children[0];
    if (first?.type === "heading" && first.depth === 1) {
      tree.children.shift();
    }
  };
}
