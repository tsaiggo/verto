import { getSourceInfo } from "@/lib/source-info";
import { getContentTree } from "@/lib/content-source";
import { buildLabsTree, type LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";
import AppShellClient from "@/components/layout/AppShellClient";

/**
 * Server entry for the application shell. Content is resolved by the route
 * that owns it; the persistent shell only needs the active source descriptor.
 * Also provides LabsSidebarTree for the global workspace aside panel.
 */
export default async function AppShell({ children }: { children: React.ReactNode }) {
  const source = getSourceInfo();
  let labsTree: LabsSidebarTree = [];
  try {
    const tree = await getContentTree();
    labsTree = buildLabsTree(tree);
  } catch {
    labsTree = [];
  }

  return (
    <AppShellClient source={source} labsTree={labsTree}>
      {children}
    </AppShellClient>
  );
}
