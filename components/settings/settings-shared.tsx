"use client";

// Shared primitives + types for the Settings view.

import { useId, type ReactNode } from "react";
import styles from "./Settings.module.css";

export type ThemeChoice = "light" | "dark" | "system";

export function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle} id={titleId}>
          {title}
        </h2>
        {description ? <p className={styles.cardDescription}>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
