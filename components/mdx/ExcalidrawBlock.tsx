"use client";

import Excalidraw from "@/components/mdx/Excalidraw";

/**
 * ExcalidrawBlock — adapter for the `<excalidraw-block>` element produced
 * by `rehype-excalidraw`. Reads `data-source` (camelCased to `dataSource`
 * by hast) and forwards it to the real `<Excalidraw>` component.
 */
export default function ExcalidrawBlock({ ...props }: Record<string, unknown>) {
  const source =
    (props["dataSource"] as string | undefined) ??
    (props["data-source"] as string | undefined) ??
    "";
  return <Excalidraw scene={source} />;
}
