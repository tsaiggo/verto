import type { Metadata } from "next";
import { Suspense } from "react";
import MailWorkspace from "@/components/mail/MailWorkspace";

export const metadata: Metadata = {
  title: "Mail",
  description: "Read, reply, and draft mail alongside your library.",
};

export default function MailPage() {
  return (
    <Suspense fallback={<div aria-busy="true" />}>
      <MailWorkspace />
    </Suspense>
  );
}
