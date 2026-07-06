import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SpecBoardPageShellProps {
  ariaLabel: string;
  className?: string;
  rail?: ReactNode;
  main: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared contact-sheet page frame for the UHD redesign boards. The routes
 * supply their route-specific rail/main/callout/footer content, while this
 * primitive keeps the top-level section anatomy and landmark semantics
 * consistent across boards.
 */
export default function SpecBoardPageShell({
  ariaLabel,
  className,
  rail,
  main,
  aside,
  footer,
}: SpecBoardPageShellProps) {
  return (
    <section className={cn("spec-board-page", className)} aria-label={ariaLabel}>
      {rail}
      {main}
      {aside}
      {footer}
    </section>
  );
}
