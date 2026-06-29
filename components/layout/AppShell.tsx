import { getContentTree, listAllFiles } from "@/lib/content-source";
import { getSourceInfo } from "@/lib/source-info";
import AppShellClient from "@/components/layout/AppShellClient";

/**
 * Server entry for the application shell. Resolves the content tree and the
 * active source description once, then hands them to the client shell which
 * renders the rail, top bar, content region and footer.
 */
export default async function AppShell({ children }: { children: React.ReactNode }) {
  const [root, files] = await Promise.all([getContentTree(), listAllFiles()]);
  const source = getSourceInfo();

  return (
    <AppShellClient root={root} source={source} fileCount={files.length}>
      {children}
    </AppShellClient>
  );
}
