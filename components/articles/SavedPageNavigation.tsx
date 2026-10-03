"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { PageTree } from "./PageTree";
import { useBrowserArticles } from "./useBrowserArticles";
import navStyles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import styles from "./PageHierarchy.module.css";

export function SavedPageNavigation({ mode = "read" }: { mode?: "read" | "edit" }) {
  const local = useBrowserArticles();
  const selectedId = useSearchParams()?.get("document") ?? undefined;
  const [expanded, setExpanded] = useState(true);
  return (
    <section className={navStyles.navigationSection} aria-labelledby={`saved-pages-${mode}`}>
      <div className={navStyles.sectionHeading}>
        <button
          type="button"
          className={navStyles.sectionTitle}
          aria-expanded={expanded}
          aria-controls={`saved-pages-${mode}-content`}
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown className={expanded ? undefined : navStyles.turned} aria-hidden />
          <span id={`saved-pages-${mode}`}>Pages</span>
        </button>
      </div>
      {expanded && (
        <div id={`saved-pages-${mode}-content`}>
          {local.status === "loading" && !local.articles.length ? (
            <p className={styles.empty} role="status">
              Loading pages…
            </p>
          ) : (
            <PageTree articles={local.articles} selectedId={selectedId} mode={mode} />
          )}
          {local.status === "error" && (
            <p className={styles.empty} role="alert">
              Pages could not load.{" "}
              <button type="button" onClick={local.retry}>
                Retry
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
