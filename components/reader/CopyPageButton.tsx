"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * CopyPageButton renders the reading column's top-right "Copy page" action,
 * matching the OpenAI-style article masthead. It copies the article's
 * readable text (title, dek, body) so a reader can paste the page elsewhere.
 *
 * The button lives inside `.content-wrap`, so on click it walks up to that
 * container, clones it, drops the non-content chrome (this row, the decorative
 * hero band, the prev/next nav), and copies the remaining innerText.
 */
export default function CopyPageButton({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const wrap =
      ref.current?.closest(".content-wrap") ??
      document.querySelector<HTMLElement>("[data-article]");
    const text = extractPageText(wrap);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, []);

  return (
    <div className="doc-top">
      {children}
      <button
        ref={ref}
        type="button"
        className={`doc-copybtn${copied ? " is-copied" : ""}`}
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy page"}
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        <span className="doc-copybtn-label doc-copybtn-label--wide">
          {copied ? "Copied" : "Copy page"}
        </span>
        <span className="doc-copybtn-label doc-copybtn-label--compact">
          {copied ? "Copied" : "Copy"}
        </span>
      </button>
    </div>
  );
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
