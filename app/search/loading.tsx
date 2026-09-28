import PageHeader from "@/components/layout/PageHeader";
import styles from "@/components/search/Search.module.css";

/** Suspense fallback for `/search`: preserves its search and result layout. */
const RESULT_ROWS = [0, 1, 2, 3, 4];
const TAB_WIDTHS = [44, 56, 70, 52, 62];

export default function SearchLoading() {
  return (
    <div className={styles.surface} role="status" aria-label="Loading search" aria-busy="true">
      <PageHeader
        title="Search"
        subtitle="Find pages, headings, and code in your active sources."
        frame="wide"
      />
      <div className={`search-page ${styles.page}`}>
        <div className="search-main">
          <div
            className="skeleton"
            style={{ width: "100%", height: 42, borderRadius: 8, marginBottom: 20 }}
          />
          <div style={{ display: "flex", gap: 20, marginBottom: 26 }}>
            {TAB_WIDTHS.map((w, i) => (
              <div key={i} className="skeleton" style={{ width: w, height: 28, borderRadius: 3 }} />
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {RESULT_ROWS.map((i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="skeleton" style={{ width: `${70 - i * 4}%`, height: 18 }} />
                <div className="skeleton" style={{ width: "100%", height: 12 }} />
                <div className="skeleton" style={{ width: "86%", height: 12 }} />
              </div>
            ))}
          </div>
        </div>
        <aside aria-hidden="true">
          <div
            className="skeleton"
            style={{ width: "100%", height: 220, borderRadius: "var(--radius-lg)" }}
          />
        </aside>
      </div>
    </div>
  );
}
