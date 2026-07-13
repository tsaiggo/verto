"use client";

// Shared primitives + types for the Settings view.

import type { ReactNode } from "react";

export type ThemeChoice = "light" | "dark" | "system";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="set-card">
      <h2 className="set-card-title">{title}</h2>
      {children}
    </section>
  );
}
