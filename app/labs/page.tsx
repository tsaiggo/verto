import type { Metadata } from "next";
import { Suspense } from "react";
import LabsClient from "./LabsClient";

export const metadata: Metadata = {
  title: "Labs Preview",
  robots: { index: false, follow: false },
};

export default function LabsPage() {
  return (
    <>
      {/* Design-labs styles - :where-scoped, safe to include together. Active-only also fine. */}
      <link rel="stylesheet" href="/design-labs/workspace-sidebar/styles.css" />
      <link rel="stylesheet" href="/design-labs/flow-sidebar/styles.css" />
      <link rel="stylesheet" href="/design-labs/book-discovery/styles.css" />

      <Suspense fallback={<div aria-busy="true" />}>
        <LabsClient />
      </Suspense>
    </>
  );
}
