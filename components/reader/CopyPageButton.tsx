"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

/**
 * CopyPageButton renders the reading column's top-right "Copy page" action,
 * matching the OpenAI-style article masthead. It copies the article's
 * readable text (title, dek, body) so a reader can paste the page elsewhere.
 *
 * The reader masthead and body share `.main`, so on click it clones that
 * document column, drops non-content chrome, and copies the remaining text.
 */
export default function CopyPageButton({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);

  const handleCopy = useCallback(async () => {
    if (copying) return;
    const wrap =
      ref.current?.closest(".main") ??
      ref.current?.closest(".content-wrap") ??
      document.querySelector<HTMLElement>("[data-article]");
    const text = extractPageText(wrap);
    if (!text) {
      toast.error("Couldn't copy page", {
        description: "No readable page content was found.",
      });
      return;
    }

    setCopying(true);
    let didCopy = false;
    try {
      await navigator.clipboard.writeText(text);
      didCopy = true;
    } catch {
      didCopy = copyWithLegacyFallback(text);
    } finally {
      setCopying(false);
    }

    if (!didCopy) {
      toast.error("Couldn't copy page", {
        description: "Clipboard access is unavailable. Check your browser permissions and retry.",
      });
      return;
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [copying]);

  return (
    <div className="doc-top">
      {children}
      <button
        ref={ref}
        type="button"
        className={`doc-copybtn doc-copybtn--copy${copied ? " is-copied" : ""}`}
        disabled={copying}
        onClick={() => void handleCopy()}
        aria-label={copying ? "Copying page" : copied ? "Copied" : "Copy page"}
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        <span className="doc-copybtn-label doc-copybtn-label--wide">
          {copying ? "Copying…" : copied ? "Copied" : "Copy page"}
        </span>
        <span className="doc-copybtn-label doc-copybtn-label--compact">
          {copying ? "Copying…" : copied ? "Copied" : "Copy"}
        </span>
      </button>
    </div>
  );
}

function copyWithLegacyFallback(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  try {
    document.body.appendChild(textarea);
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function extractPageText(wrap: Element | null | undefined): string {
  if (!(wrap instanceof HTMLElement)) return "";
  const clone = wrap.cloneNode(true) as HTMLElement;
  // Drop non-prose chrome so the copied text reads as title + dek + body.
  clone
    .querySelectorAll(".doc-top, .doc-hero, .prevnext, .doc-eyebrow, .doc-tags, .draft-badge")
    .forEach((el) => el.remove());
  return clone.innerText.replace(/\n{3,}/g, "\n\n").trim();
}
