"use client";

import { Suspense } from "react";
import MailWorkbench from "@/components/mail/MailWorkbench";
import { demoConnection, demoConnector } from "@/lib/mail/demo";

/** The lab and /mail?demo=1 use the same production workbench. */
export default function MailMock() {
  return (
    <Suspense fallback={<p>Loading Mail preview…</p>}>
      <MailWorkbench connector={demoConnector} connection={demoConnection} demo embedded />
    </Suspense>
  );
}
