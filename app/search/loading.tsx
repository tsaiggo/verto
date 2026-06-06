/** Suspense fallback for `/search`: a skeleton matching the `.search-page`
 *  grid, so the layout stays stable while the index builds. */
const RESULT_ROWS = [0, 1, 2, 3, 4];
const TAB_WIDTHS = [44, 56, 70, 52, 62];

export default function SearchLoading() {
  return (
    <div className="search-page" aria-label="Loading search" aria-busy="true">
      <div className="search-main">
        <div className="skeleton" style={{ width: 240, height: 34, marginBottom: 12 }} />
        <div className="skeleton" style={{ width: 340, height: 15, marginBottom: 22 }} />
        <div
          className="skeleton"
          style={{ width: '100%', height: 52, borderRadius: 'var(--radius-lg)', marginBottom: 20 }}
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 26 }}>
          {TAB_WIDTHS.map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 30, borderRadius: 999 }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {RESULT_ROWS.map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="skeleton" style={{ width: `${70 - i * 4}%`, height: 18 }} />
              <div className="skeleton" style={{ width: '100%', height: 12 }} />
              <div className="skeleton" style={{ width: '86%', height: 12 }} />
            </div>
          ))}
        </div>
      </div>
      <aside aria-hidden="true">
        <div
          className="skeleton"
          style={{ width: '100%', height: 220, borderRadius: 'var(--radius-lg)' }}
        />
      </aside>
    </div>
  );
}
