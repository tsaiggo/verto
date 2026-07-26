import ReaderWorkspace from "@/components/reader/ReaderWorkspace";

/** Document-shaped fallback that preserves the Reader frame while MDX loads. */
const BODY_LINES = [100, 97, 92, 99, 74, 100, 95, 90, 98, 62];

export default function ReadLoading() {
  const outline = (
    <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="skeleton" style={{ width: 80, height: 12 }} />
      <div className="skeleton" style={{ width: "70%", height: 12 }} />
      <div className="skeleton" style={{ width: "60%", height: 12, marginLeft: 12 }} />
      <div className="skeleton" style={{ width: "64%", height: 12, marginLeft: 12 }} />
      <div className="skeleton" style={{ width: "54%", height: 12 }} />
    </div>
  );

  return (
    <ReaderWorkspace
      showTabs={false}
      showAgent={false}
      state="loading"
      masthead={
        <header className="doc-header" data-page-identity aria-hidden="true">
          <div style={{ width: "100%" }}>
            <div className="skeleton" style={{ width: 112, height: 12, marginBottom: 14 }} />
            <div className="skeleton" style={{ width: "62%", height: 34 }} />
          </div>
        </header>
      }
      toc={outline}
      documentLabel="Loading document"
    >
      <div className="content-wrap" aria-busy="true">
        {BODY_LINES.map((width, index) => (
          <div
            key={index}
            className="skeleton"
            style={{ width: `${width}%`, height: 14, marginBottom: index === 4 ? 32 : 14 }}
          />
        ))}
      </div>
    </ReaderWorkspace>
  );
}
