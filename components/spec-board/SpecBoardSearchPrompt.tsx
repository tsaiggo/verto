import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpecBoardSearchPromptProps {
  className?: string;
  label: ReactNode;
  shortcut?: ReactNode;
}

/**
 * Shared search-pill prompt used across redesign boards. Route-specific boards
 * still own spacing and typography through their className, but the icon /
 * label / shortcut anatomy stays consistent.
 */
export default function SpecBoardSearchPrompt({
  className,
  label,
  shortcut,
}: SpecBoardSearchPromptProps) {
  return (
    <label className={cn("spec-board-search", className)}>
      <Search aria-hidden />
      <span>{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </label>
  );
}
