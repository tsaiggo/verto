import { getContentTree, listAllFiles } from "@/lib/content-source";
import { getSourceInfo } from "@/lib/source-info";
import AppShellClient from "@/components/layout/AppShellClient";

/**
 * Server entry for the application shell. Resolves the content tree and the
 * active source description once, then hands them to the client shell which
 * renders the rail, top bar, content region and footer.
 */
export default async function AppShell({ children }: { children: React.ReactNode }) {
  let root: Awaited<ReturnType<typeof getContentTree>> | undefined;
  let fileCount = 0;
  let source = getSourceInfo();

  try {
    const [loadedRoot, files] = await Promise.all([getContentTree(), listAllFiles()]);
    root = loadedRoot;
    fileCount = files.length;
    source = { ...source, readiness: { status: "ready" } };
  } catch (error) {
    source = {
      ...source,
      readiness: {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  return (
    <AppShellClient root={root} source={source} fileCount={fileCount}>
      {children}
    </AppShellClient>
  );
}
