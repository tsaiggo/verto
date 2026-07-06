import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SpecBoardHeaderProps {
  className?: string;
  brand?: ReactNode;
  eyebrow?: ReactNode;
  eyebrowClassName?: string;
  title: ReactNode;
  titleClassName?: string;
  description?: ReactNode;
  descriptionClassName?: string;
  headingClassName?: string;
  children?: ReactNode;
}

export default function SpecBoardHeader({
  className,
  brand,
  eyebrow,
  eyebrowClassName,
  title,
  titleClassName,
  description,
  descriptionClassName,
  headingClassName,
  children,
}: SpecBoardHeaderProps) {
  return (
    <header className={cn("spec-board-header", className)}>
      {brand}
      <div className={cn("spec-board-header__heading", headingClassName)}>
        {eyebrow ? (
          <span className={cn("spec-board-header__eyebrow", eyebrowClassName)}>{eyebrow}</span>
        ) : null}
        <h1 className={cn("spec-board-header__title", titleClassName)}>{title}</h1>
        {description ? (
          <p className={cn("spec-board-header__description", descriptionClassName)}>
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </header>
  );
}
