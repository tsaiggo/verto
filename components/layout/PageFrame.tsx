import type { ComponentPropsWithoutRef, ElementType } from "react";
import styles from "./PageFrame.module.css";

export type PageFrameSize = "wide" | "standard" | "narrow" | "fluid";

type PageFrameProps<T extends ElementType> = {
  as?: T;
  size?: PageFrameSize;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "size">;

/**
 * Shared horizontal boundary for page identity and body regions.
 *
 * Route-owned styles keep control of vertical rhythm and responsive gutters;
 * the frame only establishes a stable maximum width and centering contract.
 */
export default function PageFrame<T extends ElementType = "div">({
  as,
  size = "standard",
  className,
  ...props
}: PageFrameProps<T>) {
  const Component = as ?? "div";
  const classes = [styles.frame, styles[size], className].filter(Boolean).join(" ");

  return <Component {...props} className={classes} data-page-frame={size} />;
}
