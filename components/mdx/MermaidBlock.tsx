"use client";

import Mermaid from "@/components/mdx/Mermaid";

/**
 * MermaidBlock — adapter for the `<mermaid-block>` element produced by
 * `rehype-mermaid`. Reads `data-source` (camelCased to `dataSource` by hast)
 * and forwards it to the real `<Mermaid>` component.
 */
export default function MermaidBlock({ ...props }: Record<string, unknown>) {
  const source =
    (props["dataSource"] as string | undefined) ??
    (props["data-source"] as string | undefined) ??
    "";
  return <Mermaid chart={source} />;
}
