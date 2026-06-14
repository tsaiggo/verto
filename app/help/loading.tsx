/** Suspense fallback for `/help`: a document-shaped skeleton in the same
 *  `.main` / `.toc-sidebar` grid, so content arriving causes no layout shift. */
const BODY_LINES = [100, 97, 92, 99, 74, 100, 95, 90, 98, 62];

export default function HelpLoading() {
  return (
    <>
      <section className="main" aria-label="Loading document" aria-busy="true">
        <div className="content-wrap">
          <div className="skeleton" style={{ width: 92, height: 18, marginBottom: 20 }} />
          <div className="skeleton" style={{ width: "78%", height: 40, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: 200, height: 14, marginBottom: 44 }} />
          {BODY_LINES.map((w, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ width: `${w}%`, height: 14, marginBottom: i === 4 ? 32 : 14 }}
            />
          ))}
        </div>
      </section>
      <aside className="toc-sidebar" aria-hidden="true">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 8 }}>
          <div className="skeleton" style={{ width: 80, height: 12 }} />
          <div className="skeleton" style={{ width: "70%", height: 12 }} />
          <div className="skeleton" style={{ width: "60%", height: 12, marginLeft: 12 }} />
          <div className="skeleton" style={{ width: "64%", height: 12, marginLeft: 12 }} />
          <div className="skeleton" style={{ width: "54%", height: 12 }} />
          <div className="skeleton" style={{ width: "58%", height: 12, marginLeft: 12 }} />
        </div>
      </aside>
    </>
  );
}
