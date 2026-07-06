import { ChevronDown } from "lucide-react";
import { listAllFiles } from "@/lib/content-source";
import PageHeader from "@/components/layout/PageHeader";
import { SAMPLE_DOCS, SAMPLE_TAGS } from "@/components/pages/sample";
import { sortRecentDocuments } from "@/lib/recent-documents";

export const metadata = { title: "Activity" };

const STATS = [
  { value: "8h 42m", label: "Reading time" },
  { value: "24", label: "Documents read" },
  { value: "17", label: "Notes created" },
  { value: "42", label: "AI interactions" },
];

const SOURCES = [
  { label: "Local", pct: 68 },
  { label: "GitHub", pct: 18 },
  { label: "OneDrive", pct: 9 },
  { label: "Web", pct: 5 },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS = ["May 7", "May 8", "May 9", "May 10", "May 12"];

/** Deterministic 0–4 intensity so SSR and client render identically. */
function intensity(row: number, col: number): number {
  const h = Math.sin((row + 1) * 42.17 + (col + 1) * 13.31) * 9973.19;
  const f = h - Math.floor(h);
  if (f < 0.4) return 0;
  if (f < 0.62) return 1;
  if (f < 0.8) return 2;
  if (f < 0.92) return 3;
  return 4;
}

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

  const cols = 12;

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Your knowledge rhythm over time."
        tools={
          <>
            <button type="button" className="v-btn v-btn--sm">
              Export
            </button>
            <button type="button" className="v-btn v-btn--sm">
              This Week
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </>
        }
      />

      <div className="v-page act">
        <div className="act-stats">
          {STATS.map((s) => (
            <div key={s.label} className="v-card act-stat">
              <span className="act-stat-label">{s.label}</span>
              <span className="act-stat-value">{s.value}</span>
            </div>
          ))}
        </div>

        <div className="act-main">
          <div className="v-card act-heatcard">
            <div className="v-cardhead">
              <span className="v-cardhead-title">Daily activity</span>
            </div>
            <div className="v-card-divider" />
            <div className="act-heat">
              <div className="act-heat-body">
                <div className="act-heat-hours" aria-hidden>
                  {WEEKDAYS.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="act-heat-grid" role="img" aria-label="Daily activity heatmap">
                  {WEEKDAYS.map((_, r) => (
                    <div key={r} className="act-heat-row">
                      {Array.from({ length: cols }).map((__, c) => (
                        <span key={c} className="act-heat-cell" data-level={intensity(r, c)} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="act-heat-days" aria-hidden>
                {DAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="v-card act-side">
            <div className="v-cardhead">
              <span className="v-cardhead-title">Top sources</span>
            </div>
            <div className="v-card-divider" />
            <ul className="act-rank">
              {SOURCES.map((s) => (
                <li key={s.label} className="act-rank-row">
                  <span className="act-rank-name">{s.label}</span>
                  <span className="act-rank-bar" aria-hidden>
                    <span style={{ width: `${s.pct}%` }} />
                  </span>
                  <span className="act-rank-val">{s.pct}%</span>
                </li>
              ))}
            </ul>
            <div className="v-card-divider" />
            <div className="v-cardhead">
              <span className="v-cardhead-title">Top tags</span>
            </div>
            <ul className="act-rank act-rank--tags">
              {topTags.map((t) => (
                <li key={t.name} className="act-rank-row">
                  <span className="act-rank-name">#{t.name}</span>
                  <span className="act-rank-val">{t.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="v-card act-recent">
          <div className="v-cardhead">
            <span className="v-cardhead-title">Recent activity</span>
          </div>
          <div className="v-card-divider" />
          <ul className="act-recent-list">
            {recent.map((row) => (
              <li key={row.key} className="act-recent-row">
                <span className="act-recent-main">
                  <strong className="act-recent-title">{row.title}</strong>
                  <small className="act-recent-sub">{row.sub}</small>
                </span>
                <span className="act-recent-time">{row.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
