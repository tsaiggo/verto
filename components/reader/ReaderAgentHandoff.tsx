"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ASK_AI_EVENT } from "@/lib/ai/ask-event";
import { readDocContextFromDom } from "@/lib/ai/context";
import { setAgentHandoff } from "@/lib/agent-handoff";
import { requestAppNavigation } from "@/lib/app-navigation";
import type { SummaryDocRef } from "@/lib/summaries";

/** Carry a selected passage into the standalone Agent workspace. */
export default function ReaderAgentHandoff({ doc }: { doc: SummaryDocRef }) {
  const router = useRouter();

  useEffect(() => {
    function onAsk(event: Event) {
      const quote = (event as CustomEvent<{ quote: string }>).detail?.quote?.trim();
      if (!quote || !requestAppNavigation()) return;
      const clipped = quote.length > 280 ? `${quote.slice(0, 280)}…` : quote;
      const prompt = `About this passage: "${clipped}"\n\n`;
      const context = readDocContextFromDom();
      setAgentHandoff({
        source: {
          href: doc.href,
          title: doc.title,
          subtitle:
            doc.slug.slice(0, -1).join(" / ") ||
            (doc.href.startsWith("/help") ? "Help" : "Library"),
          body: context.body ?? "",
        },
        prompt,
      });
      const query = new URLSearchParams({
        document: doc.href,
        prompt,
      });
      router.push(`/agent?${query.toString()}`);
    }

    window.addEventListener(ASK_AI_EVENT, onAsk);
    return () => window.removeEventListener(ASK_AI_EVENT, onAsk);
  }, [doc.href, doc.slug, doc.title, router]);

  return null;
}
