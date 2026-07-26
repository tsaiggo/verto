import { getSourceInfo } from "@/lib/source-info";
import AppShellClient from "@/components/layout/AppShellClient";

/**
 * Server entry for the application shell. Content is resolved by the route
 * that owns it; the persistent shell only needs the active source descriptor.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const source = getSourceInfo();

  return <AppShellClient source={source}>{children}</AppShellClient>;
}
