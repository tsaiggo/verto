import { Suspense } from "react";
import { FileText } from "lucide-react";
import RuntimeLocalReader from "@/components/runtime/RuntimeLocalReader";
import ReaderFrame from "@/components/reader/ReaderFrame";

export default function RuntimeLocalPage() {
  return (
    <Suspense fallback={<RuntimeLocalFallback />}>
      <RuntimeLocalReader />
    </Suspense>
  );
}

function RuntimeLocalFallback() {
  return (
    <div className="docs-layout read-layout reader-no-tabs">
      <ReaderFrame mainLabel="Runtime document content">
        <header className="doc-header" data-page-identity>
          <div className="doc-identity">
            <span className="doc-identity-icon" aria-hidden>
              <FileText />
            </span>
            <div className="doc-identity-copy">
              <div className="doc-title-row">
                <h1 className="doc-title">Local reader</h1>
              </div>
              <div className="doc-eyebrow">Preparing local document…</div>
            </div>
          </div>
        </header>
        <article className="content-wrap prose">
          <p aria-live="polite">Loading runtime reader…</p>
        </article>
      </ReaderFrame>
    </div>
  );
}
