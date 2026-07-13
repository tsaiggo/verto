import { Suspense } from "react";
import { FileText } from "lucide-react";
import RuntimeLocalReader from "@/components/runtime/RuntimeLocalReader";

export default function RuntimeLocalPage() {
  return (
    <Suspense fallback={<RuntimeLocalFallback />}>
      <RuntimeLocalReader />
    </Suspense>
  );
}

function RuntimeLocalFallback() {
  return (
    <div className="docs-layout read-layout">
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
      <div className="reader-scroll" data-page-scroll>
        <div className="reader-workbench">
          <section className="main" aria-label="Runtime document content">
            <article className="content-wrap prose">
              <p aria-live="polite">Loading runtime reader…</p>
            </article>
          </section>
        </div>
      </div>
    </div>
  );
}
