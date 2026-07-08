import { getContentTree } from "@/lib/content-source";
import { buildLibraryIndex } from "@/components/home/home-data";
import CollectionsClient from "./CollectionsClient";

export const metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const tree = await getContentTree();
  const groups = buildLibraryIndex(tree);
  const folderGroups = groups.map((g) => ({
    title: g.title,
    href: g.href,
    total: g.total,
  }));

  return <CollectionsClient folderGroups={folderGroups} />;
}
