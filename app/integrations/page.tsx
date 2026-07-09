import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import LocalFolderPickerButton from "@/components/integrations/LocalFolderPickerButton";
import SourcesOverview, {
  type SourceRow,
  type SourceStatus,
} from "@/components/integrations/SourcesOverview";
import { getConnectionDetails } from "@/lib/connection-info";
import { listAllFiles } from "@/lib/content-source";

export const metadata: Metadata = {
  title: "Sources & Integrations",
  description: "Manage your local library and RSS feeds.",
};

interface SeedSource {
  kind: string;
  name: string;
  detail: string;
  lastSync: string;
  items: number;
  status: SourceStatus;
  progress?: number;
}

// Verto currently exposes two user-facing source types: Local Library for the
// library and RSS/Atom feeds for Inbox subscriptions. Keep this list honest so
// unsupported providers do not appear as connectable actions.
const SEED_SOURCES: SeedSource[] = [
  {
    kind: "local",
    name: "Local Library",
    detail: "Choose a folder",
    lastSync: "—",
    items: 0,
    status: "disconnected",
  },
  {
    kind: "rss",
    name: "RSS",
    detail: "No feeds subscribed",
    lastSync: "—",
    items: 0,
    status: "disconnected",
  },
];

export default async function IntegrationsPage() {
  const connection = getConnectionDetails();

  // Reflect the real, active content source: mark its provider connected and
  // use its real name / location / item count where we can.
  let realCount = 0;
  if (connection.connected && connection.kind === "local") {
    try {
      realCount = (await listAllFiles()).filter((f) => !f.hidden).length;
    } catch {
      realCount = 0;
    }
  }

  const sources: SourceRow[] = SEED_SOURCES.map((seed) => {
    if (connection.connected && seed.kind === connection.kind) {
      const detail = connection.repo
        ? connection.branch
          ? `${connection.repo} · ${connection.branch}`
          : connection.repo
        : connection.path && connection.path !== "/"
          ? connection.path
          : seed.detail;
      return {
        kind: seed.kind,
        name: connection.name || seed.name,
        detail,
        lastSync: "Just now",
        items: realCount || seed.items,
        status: "synced" as SourceStatus,
      };
    }
    return seed;
  });

  return (
    <>
      <PageHeader
        title="Sources & Integrations"
        subtitle="Manage the local library and RSS feeds Verto can actually read today."
        tools={
          <>
            <Link href="/inbox" className="v-btn v-btn--sm">
              Manage RSS
            </Link>
            <LocalFolderPickerButton />
          </>
        }
      />
      <SourcesOverview sources={sources} />
    </>
  );
}
