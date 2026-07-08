import ActivityClient from "@/components/activity/ActivityClient";
import { listAllFiles } from "@/lib/content-source";
import { SAMPLE_DOCS, SAMPLE_TAGS } from "@/components/pages/sample";
import { sortRecentDocuments } from "@/lib/recent-documents";

export const metadata = { title: "Activity" };

/** Coarse "X ago" formatter for the Recent activity list. */
function timeAgo(iso: string | number | undefined, now = Date.now()): string {
  const t = typeof iso === "number" ? iso : iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, now - t);
  const m = Math.round(diff / 60_000);
  if (m < 60) return m <= 1 ? "just now" : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  return `${w}w ago`;
}

export default async function ActivityPage() {
  const files = await listAllFiles();

  // Top tags (from real file metadata, fall back to sample data).
  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.hidden || file.draft || !file.tags) continue;
    for (const tag of file.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const realTags = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const topTags = realTags.length > 0 ? realTags : SAMPLE_TAGS.slice(0, 5);

  // Recent activity (from real file metadata, fall back to sample data).
  const realRecent = sortRecentDocuments(files, 4);
  const recent: Array<{ key: string; title: string; sub: string; time: string }> =
    realRecent.length > 0
      ? realRecent.map((doc) => {
          const iso = doc.updated ?? doc.date;
          const parsed = iso ? Date.parse(iso) : Number.NaN;
          const ts = Number.isFinite(parsed) ? parsed : doc.mtime;
          return { key: doc.href, title: doc.title, sub: "Updated", time: timeAgo(ts) };
        })
      : SAMPLE_DOCS.slice(0, 4).map((doc) => ({
          key: doc.file,
          title: doc.title,
          sub: doc.source,
          time: doc.updated,
        }));

  return <ActivityClient topTags={topTags} recent={recent} />;
}
