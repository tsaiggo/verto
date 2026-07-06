import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SpecBoardSectionProps {
  ariaLabel?: string;
  className?: string;
  headerClassName?: string;
  title: ReactNode;
  children?: ReactNode;
}

/**
 * Shared board section anatomy for the redesign contact sheets. Boards can keep
 * their own layout classes while reusing the same section + heading structure.
 */
export default function SpecBoardSection({
  ariaLabel,
  className,
  headerClassName,
  title,
  children,
}: SpecBoardSectionProps) {
  return (
    <section className={cn("spec-board-section", className)} aria-label={ariaLabel}>
      <header className={cn("spec-board-section__head", headerClassName)}>
        <strong>{title}</strong>
      </header>
      {children}
    </section>
  );
}
