"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
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
          <ChevronRight
            className="toggle-arrow"
            width="16"
            height="16"
            strokeWidth="2"
            aria-hidden="true"
          />
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
        <ChevronRight
          className="toggle-arrow"
          width="16"
          height="16"
          strokeWidth="2"
          aria-hidden="true"
        />
        <span>{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="toggle-content">{children}</CollapsibleContent>
    </Collapsible>
  );
}
