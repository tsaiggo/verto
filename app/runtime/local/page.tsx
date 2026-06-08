import { Suspense } from "react";
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
    <div className="docs-layout">
      <section className="main" aria-label="Runtime document content">
        <article className="content-wrap prose">
          <p>Loading runtime reader…</p>
        </article>
      </section>
    </div>
  );
}
