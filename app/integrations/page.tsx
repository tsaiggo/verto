import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import SourcesOverview, {
  type SourceRow,
  type SourceStatus,
} from "@/components/integrations/SourcesOverview";
import { getConnectionDetails } from "@/lib/connection-info";
import { listAllFiles } from "@/lib/content-source";

export const metadata: Metadata = {
  title: "Sources & Integrations",
  description: "Manage and monitor connected sources.",
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

const SEED_SOURCES: SeedSource[] = [
  {
    kind: "local",
    name: "Local Library",
    detail: "/Users/alex/Verto",
    lastSync: "2m ago",
    items: 284,
    status: "synced",
  },
  {
    kind: "github",
    name: "GitHub",
    detail: "alexchen/verto-knowledge",
    lastSync: "12m ago",
    items: 156,
    status: "synced",
  },
  {
    kind: "onedrive",
    name: "OneDrive",
    detail: "alex.chen@verto.ai",
    lastSync: "syncing…",
    items: 92,
    status: "syncing",
    progress: 60,
  },
  {
    kind: "rss",
    name: "Web / RSS",
    detail: "8 feeds",
    lastSync: "1h ago",
    items: 340,
    status: "synced",
  },
  {
    kind: "import",
    name: "Imported Files",
    detail: "Manual uploads",
    lastSync: "Yesterday",
    items: 47,
    status: "synced",
  },
  {
    kind: "gdrive",
    name: "Google Drive",
    detail: "alex.chen@verto.ai",
    lastSync: "3d ago",
    items: 0,
    status: "disconnected",
  },
  {
    kind: "notion",
    name: "Notion",
    detail: "Alex's workspace",
    lastSync: "4h ago",
    items: 118,
    status: "synced",
  },
  {
    kind: "slack",
    name: "Slack",
    detail: "#knowledge",
    lastSync: "26m ago",
    items: 512,
    status: "synced",
  },
  {
    kind: "dropbox",
    name: "Dropbox",
    detail: "/Verto",
    lastSync: "2h ago",
    items: 73,
    status: "synced",
  },
  {
    kind: "confluence",
    name: "Confluence",
    detail: "Team space",
    lastSync: "1d ago",
    items: 205,
    status: "synced",
  },
];

export default async function IntegrationsPage() {
  const connection = getConnectionDetails();

  // Reflect the real, active content source: mark its provider connected and
  // use its real name / location / item count where we can.
  let realCount = 0;
  if (connection.connected) {
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
        name: connection.name || seed.name,
        detail,
        lastSync: "Just now",
        items: realCount || seed.items,
        status: "synced" as SourceStatus,
      };
    }
    const { kind: _kind, ...row } = seed;
    void _kind;
    return row;
  });

  return (
    <>
      <PageHeader
        title="Sources & Integrations"
        subtitle="Manage and monitor connected sources."
        tools={
          <Link href="/integrations/connect" className="v-btn v-btn--primary v-btn--sm">
            Add Source
          </Link>
        }
      />
      <SourcesOverview sources={sources} />
    </>
  );
}
