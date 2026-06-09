import { Suspense } from "react";
import RuntimeGitHubReader from "@/components/runtime/RuntimeGitHubReader";

export default function RuntimeGitHubPage() {
  return (
    <Suspense fallback={<RuntimeGitHubFallback />}>
      <RuntimeGitHubReader />
    </Suspense>
  );
}

function RuntimeGitHubFallback() {
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
