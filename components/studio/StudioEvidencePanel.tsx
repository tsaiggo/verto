"use client";

import Link from "next/link";
import { Check, Clipboard, ExternalLink, FileText, NotebookPen, Quote } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import type { StudioArtifact } from "@/components/studio/studio-artifacts";
import { formatStudioDate } from "@/components/studio/studio-artifacts";
import styles from "@/components/studio/Studio.module.css";

function SummaryMarkdown({ value }: { value: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            if (!href || href.startsWith("#verto-source-citation-")) {
              return <span className={styles.inlineCitation}>{children}</span>;
            }
            const external = /^https?:\/\//i.test(href);
            return (
              <a
                {...props}
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}

export function StudioEvidencePanel({ artifact }: { artifact: StudioArtifact | null }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copied = artifact !== null && copiedKey === artifact.key;

  if (!artifact) {
    return (
      <aside id="studio-evidence" className={styles.evidencePanel} aria-label="Source and citation">
        <div className={styles.evidenceEmpty}>
          <Quote aria-hidden />
          <p>Select a knowledge card to inspect its source.</p>
        </div>
      </aside>
    );
  }

  async function copyInsight() {
    if (!artifact || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(artifact.insight);
      setCopiedKey(artifact.key);
    } catch {
      setCopiedKey(null);
    }
  }

  return (
    <aside id="studio-evidence" className={styles.evidencePanel} aria-label="Source and citation">
      <header className={styles.evidenceHeader}>
        <span className={styles.evidenceKind} data-kind={artifact.kind}>
          {artifact.kind === "summary" ? <FileText aria-hidden /> : <NotebookPen aria-hidden />}
          {artifact.kindLabel}
        </span>
        <time dateTime={artifact.createdAt}>{formatStudioDate(artifact.createdAt)}</time>
      </header>

      <section className={styles.insightSection} aria-labelledby="studio-insight-title">
        <div className={styles.evidenceSectionHeading}>
          <h2 id="studio-insight-title">Insight</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.copyButton}
            onClick={() => void copyInsight()}
          >
            {copied ? <Check aria-hidden /> : <Clipboard aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        {artifact.kind === "summary" ? (
          <>
            <h3>{artifact.title}</h3>
            <SummaryMarkdown value={artifact.insight} />
          </>
        ) : (
          <p className={styles.noteBody}>{artifact.insight}</p>
        )}
      </section>

      <section className={styles.sourceSection} aria-labelledby="studio-source-title">
        <h2 id="studio-source-title">Source</h2>
        <Link href={artifact.sourceHref} className={styles.sourceLink}>
          <span className={styles.sourceDocumentIcon} aria-hidden>
            <FileText />
          </span>
          <span>
            <strong>{artifact.sourceTitle}</strong>
            <small>{artifact.sourceScope}</small>
          </span>
          <ExternalLink aria-hidden />
        </Link>
        {artifact.model ? (
          <p className={styles.modelLabel}>Generated with {artifact.model}</p>
        ) : null}
      </section>

      <section className={styles.citationSection} aria-labelledby="studio-citation-title">
        <h2 id="studio-citation-title">{artifact.citation ? "Cited passage" : "Source scope"}</h2>
        {artifact.citation ? (
          <blockquote>{artifact.citation}</blockquote>
        ) : (
          <p>
            This summary is attached to the document as a whole. Open the source to verify
            individual claims against the original text.
          </p>
        )}
        <Button asChild variant="outline" size="sm" className={styles.openSourceButton}>
          <Link href={artifact.sourceHref}>Open source</Link>
        </Button>
      </section>

      <p className={styles.copyStatus} aria-live="polite">
        {copied ? "Insight copied to clipboard." : ""}
      </p>
    </aside>
  );
}
