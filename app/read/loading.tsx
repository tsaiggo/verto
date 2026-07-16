"use client";

/** Suspense fallback for `/read`: a document-shaped skeleton in the same
 *  reader workbench, so content arriving causes no layout shift. */
import { usePathname } from "next/navigation";
import DocumentTabs from "@/components/layout/DocumentTabs";
import ReaderFrame from "@/components/reader/ReaderFrame";
import { readerRouteHasDocumentTabs } from "@/lib/reader-route-frame";

const BODY_LINES = [100, 97, 92, 99, 74, 100, 95, 90, 98, 62];

export default function ReadLoading() {
  const pathname = usePathname() ?? "/read";
  const tabs = readerRouteHasDocumentTabs(pathname) ? <DocumentTabs /> : undefined;

  return (
    <ReaderFrame
      mainLabel="Loading document"
      mainProps={{ "aria-busy": true }}
      tabs={tabs}
      context={
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 8 }}>
          <div className="skeleton" style={{ width: 80, height: 12 }} />
          <div className="skeleton" style={{ width: "70%", height: 12 }} />
          <div className="skeleton" style={{ width: "60%", height: 12, marginLeft: 12 }} />
          <div className="skeleton" style={{ width: "64%", height: 12, marginLeft: 12 }} />
          <div className="skeleton" style={{ width: "54%", height: 12 }} />
          <div className="skeleton" style={{ width: "58%", height: 12, marginLeft: 12 }} />
        </div>
      }
      contextProps={{ "aria-hidden": true }}
    >
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
    </ReaderFrame>
  );
}
