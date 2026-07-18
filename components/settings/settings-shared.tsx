"use client";

import type { ReactNode } from "react";
import { ContentPanel, ContentRow, ContentSection } from "@/components/ui/content-primitives";
import styles from "./Settings.module.css";

export type { ThemeChoice } from "@/lib/theme";

export function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <ContentSection title={title} description={description}>
      <ContentPanel variant="outlined" className={styles.card}>
        {children}
      </ContentPanel>
    </ContentSection>
  );
}

export function SettingRow({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <ContentRow className={styles.row} title={title} description={description} actions={action} />
  );
}
