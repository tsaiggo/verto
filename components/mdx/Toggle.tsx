"use client";

import { useState, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useHasMounted } from "@/components/ui/use-has-mounted";

/**
 * <Toggle> — disclosure widget built on Radix Collapsible. Renders with the
 * legacy `.toggle` / `.toggle-content` class hooks for visual continuity.
 */
export default function Toggle({ title, children }: { title: string; children: ReactNode }) {
  const hasMounted = useHasMounted();
  const [open, setOpen] = useState(false);

  if (!hasMounted) {
    return (
      <div className="toggle" data-state="closed">
        <button type="button" className="toggle-trigger" disabled>
          <svg
            className="toggle-arrow"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <span>{title}</span>
        </button>
      </div>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="toggle"
      data-state={open ? "open" : "closed"}
    >
      <CollapsibleTrigger className="toggle-trigger">
        <svg
          className="toggle-arrow"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 6 15 12 9 18" />
        </svg>
        <span>{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="toggle-content">{children}</CollapsibleContent>
    </Collapsible>
  );
}
