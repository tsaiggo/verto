"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { loadActiveLocalFolder, LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import { loadActiveRuntimeLocalFolder } from "@/lib/runtime-local-folder";
import { STEP_HREF, type OnboardingStep } from "./onboarding-steps";
import styles from "./Onboarding.module.css";

export function Navigation({
  previous,
  next,
  skip,
}: {
  previous?: OnboardingStep;
  next?: { step: OnboardingStep; label: string };
  skip?: { href: string; label: string };
}) {
  return (
    <nav className={styles.nav} aria-label="Onboarding navigation">
      <div className={styles.navGroup}>
        {previous ? (
          <Link href={STEP_HREF[previous]} className="v-btn v-btn--sm">
            <ArrowLeft aria-hidden />
            Back
          </Link>
        ) : (
          <span />
        )}
        {skip ? (
          <Link href={skip.href} className={styles.skip}>
            {skip.label}
          </Link>
        ) : null}
      </div>
      {next ? (
        <Link href={STEP_HREF[next.step]} className="v-btn v-btn--primary">
          {next.label}
          <ArrowRight aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}

export function StepSurface({
  icon,
  title,
  description,
  meta,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <section className={styles.surface}>
      <header className={styles.intro}>
        <span className={styles.introIcon} aria-hidden>
          {icon}
        </span>
        <h2>{title}</h2>
        <p className={styles.lede}>{description}</p>
        {meta ? <p className={styles.meta}>{meta}</p> : null}
      </header>
      {children ? <div className={styles.body}>{children}</div> : null}
    </section>
  );
}

export interface FolderSnapshot {
  remembered: string | null;
  readable: string | null;
}

function readFolderSnapshot(): FolderSnapshot {
  return {
    remembered: loadActiveLocalFolder(),
    readable: loadActiveRuntimeLocalFolder(),
  };
}

export function useFolderSnapshot(): FolderSnapshot {
  const [snapshot, setSnapshot] = useState<FolderSnapshot>({
    remembered: null,
    readable: null,
  });

  useEffect(() => {
    const refresh = () => setSnapshot(readFolderSnapshot());
    refresh();
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return snapshot;
}
