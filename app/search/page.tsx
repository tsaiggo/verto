import { listAllFiles } from "@/lib/content-source";
import { sortRecentDocuments } from "@/lib/recent-documents";
import { SAMPLE_DOCS, SAMPLE_TAGS } from "@/components/pages/sample";
import SpecBoardSearchPrompt from "@/components/spec-board/SpecBoardSearchPrompt";

export const metadata = {
  title: "Search Results",
  description: "Search across your library, notes, tags, collections, and sources.",
};

interface ResultRow {
  title: string;
  source: string;
  time: string;
  relevance: number;
}

interface SearchPageProps {
  searchParams?: Promise<{ q?: string }>;
}

/** Coarse "X ago" formatter (same shape as /activity). */
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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim();
  const qLower = q.toLowerCase();

  const files = await listAllFiles();
  const visible = files.filter((f) => !f.hidden && !f.draft);

  // ---- real filter counts (Tag = real; others degrade gracefully) --------
  const tagCounts = new Map<string, number>();
  for (const f of visible) {
    for (const t of f.tags ?? []) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const realTagRows: Array<[string, number]> = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([n, c]) => [n, c]);

  const totalDocs = visible.length;
  const sampleTagRows: Array<[string, number]> = SAMPLE_TAGS.slice(0, 5).map((t) => [t.name, t.count]);

  const filters: Record<string, Array<[string, number]>> = {
    Type: [
      ["Document", totalDocs > 0 ? totalDocs : 72],
      ["Note", 18],
      ["Card / Summary", 12],
      ["Collection", 6],
      ["Source", 14],
    ],
    Source: [
      ["Smashing Magazine", 12],
      ["A List Apart", 9],
      ["NN/g", 7],
      ["O'Reilly", 6],
      ["Figma", 5],
    ],
    Tag: realTagRows.length > 0 ? realTagRows : sampleTagRows,
  };

  // ---- real results (filtered by q, or recent when q empty) --------------
  let results: ResultRow[];
  if (visible.length > 0) {
    const scored = visible
      .map((f) => {
        const title = f.title.toLowerCase();
        const inTitle = qLower && title.includes(qLower) ? 1 : 0;
        const inTag = qLower && (f.tags ?? []).some((t) => t.toLowerCase().includes(qLower)) ? 1 : 0;
        const score = inTitle * 2 + inTag;
        return { file: f, score };
      })
      .filter((r) => (qLower ? r.score > 0 : true));

    const ordered = qLower
      ? scored.sort((a, b) => b.score - a.score)
      : scored.sort((a, b) => {
          const ta = a.file.updated ? Date.parse(a.file.updated) : a.file.mtime;
          const tb = b.file.updated ? Date.parse(b.file.updated) : b.file.mtime;
          return tb - ta;
        });

    results = ordered.slice(0, 4).map((r, i) => {
      const iso = r.file.updated ?? r.file.date;
      const parsed = iso ? Date.parse(iso) : Number.NaN;
      const ts = Number.isFinite(parsed) ? parsed : r.file.mtime;
      const primaryTag = r.file.tags?.[0];
      return {
        title: r.file.title,
        source: primaryTag ? `#${primaryTag}` : "Document",
        time: timeAgo(ts),
        relevance: Math.max(60, 98 - i * 3),
      };
    });

    // If a query returned no matches, still show something rather than blank
    if (results.length === 0 && qLower) {
      results = sortRecentDocuments(visible, 4).map((f, i) => {
        const iso = f.updated ?? f.date;
        const parsed = iso ? Date.parse(iso) : Number.NaN;
        const ts = Number.isFinite(parsed) ? parsed : f.mtime;
        return {
          title: f.title,
          source: f.tags?.[0] ? `#${f.tags[0]}` : "Document",
          time: timeAgo(ts),
          relevance: Math.max(50, 90 - i * 3),
        };
      });
    }
  } else {
    // Fallback to SAMPLE_DOCS when content is empty
    const relevances = [98, 92, 89, 86];
    const sources = ["Smashing Magazine", "Nielsen Norman Group", "Research Library", "Figma"];
    const times = ["12 days ago", "3 weeks ago", "1 month ago", "2 months ago"];
    results = SAMPLE_DOCS.slice(0, 4).map((doc, i) => ({
      title: doc.title,
      source: sources[i] ?? doc.source,
      time: times[i] ?? doc.updated,
      relevance: relevances[i] ?? 80,
    }));
  }

  // ---- tab counts derived from real data (when available) ---------------
  const notesCount = visible.filter((f) => (f.tags ?? []).some((t) => t.toLowerCase() === "note")).length;
  const tabs = [
    `All ${totalDocs > 0 ? totalDocs : 124}`,
    `Documents ${totalDocs > 0 ? totalDocs : 27}`,
    `Notes ${notesCount > 0 ? notesCount : 18}`,
    `Tags ${realTagRows.length > 0 ? tagCounts.size : 12}`,
    `Collections 6`,
  ];

  const displayedQuery = q || "design systems";

  return (
    <div className="uhd05-search-page">
      <div className="uhd05-search-heading">
        <h1>Search</h1>
        <p>Search the full library or ask a grounded question.</p>
      </div>

      <header className="uhd05-search-head">
        <SpecBoardSearchPrompt
          className="uhd05-search-box"
          label={displayedQuery}
          shortcut="⌘K"
        />
      </header>

      <div className="uhd05-search-tabs">
        {tabs.map((tab, index) => (
          <button key={tab} type="button" className={index === 0 ? "is-active" : ""}>
            {tab}
          </button>
        ))}
      </div>

      <section className="uhd05-search" aria-label="Search results">
        <aside className="uhd05-search-filters" aria-label="Filters">
          <div className="uhd05-search-filter-head">
            <strong>Filters</strong>
            <button type="button">Clear all</button>
          </div>
          {Object.entries(filters).map(([group, rows]) => (
            <section key={group} className="uhd05-filter-block">
              <h2>{group}</h2>
              {rows.map(([label, count]) => (
                <label key={label} className="uhd05-filter-check">
                  <input type="checkbox" />
                  <span>{label}</span>
                  <em>{count}</em>
                </label>
              ))}
            </section>
          ))}
        </aside>

        <main className="uhd05-search-main">
          <div className="uhd05-result-list">
            {results.map((result) => (
              <article key={result.title} className="uhd05-result">
                <div className="uhd05-result-body">
                  <h2>{result.title}</h2>
                  <span>
                    {result.source} · {result.time}
                  </span>
                </div>
                <div className="uhd05-result-score">{result.relevance}%</div>
              </article>
            ))}
          </div>
        </main>
      </section>
    </div>
  );
}
