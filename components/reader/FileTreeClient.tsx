"use client";

import { usePathname } from "next/navigation";
import FileTree from "@/components/reader/FileTree";
import type { ContentDirNode } from "@/lib/content-source";

/**
 * Thin client wrapper that injects the active pathname into `FileTree` for
 * highlighting. The tree itself is built on the server.
 */
export default function FileTreeClient({ root }: { root: ContentDirNode }) {
  const pathname = usePathname();
  return <FileTree root={root} pathname={pathname} />;
}
