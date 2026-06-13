import type React from "react";

/**
 * BlockquoteStyled — styled `<blockquote>` override.
 * Styling is defined in globals.css (.prose blockquote), so this
 * component simply passes through with the correct element.
 */
export default function BlockquoteStyled(props: React.ComponentPropsWithoutRef<"blockquote">) {
  return <blockquote {...props} />;
}
