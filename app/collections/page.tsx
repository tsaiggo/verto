import { Suspense } from "react";
import { getContentTree, listAllFiles } from "@/lib/content-source";
import { buildLibraryIndex } from "@/components/home/home-data";
import CollectionsClient from "./CollectionsClient";

export const metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const [tree, files] = await Promise.all([getContentTree(), listAllFiles()]);
  const groups = buildLibraryIndex(tree);
  const folderGroups = groups.map((g) => ({
    title: g.title,
    href: g.href,
    total: g.total,
  }));

  return (
    <Suspense fallback={<div className="v-page" />}>
      <CollectionsClient
        folderGroups={folderGroups}
        staticDocuments={files
          .filter((file) => !file.hidden && !file.draft)
          .map((file) => ({ href: file.href, title: file.title }))}
      />
    </Suspense>
  );
}
