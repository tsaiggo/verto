"use client";

import { useCallback, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { toast } from "sonner";
import { siteConfig } from "@/lib/site";

// Chrome 138+ filters out CSS custom properties during html-to-image (Issue #542).
function getStandardStyleProperties() {
  if (typeof window === "undefined") return undefined;
  const style = getComputedStyle(document.documentElement);
  return Array.from({ length: style.length }, (_, i) => style[i]).filter(
    (name) => !name.startsWith("--")
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      default:
        return "&quot;";
    }
  });
}

export interface ShareMeta {
  title: string;
  href: string;
}

/**
 * Captures the share quote-card to the clipboard (image plus rich text), reusing
 * the Safari-safe `ClipboardItem` promise pattern. The consumer renders the
 * hidden `ShareImageCard` through `cardRef` while `capturing` is true.
 */
export function useShareCapture({ title, href }: ShareMeta) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [text, setText] = useState("");

  const capture = useCallback(
    (selectedText: string) => {
      if (capturing) return;
      setText(selectedText);
      setCapturing(true);

      const documentUrl = `${siteConfig.url}${href}`;
      const truncated = selectedText.slice(0, siteConfig.share.maxTextLength);
      const includeStyleProperties = getStandardStyleProperties();

      const blobPromise = new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Card mount timeout")), 3000);
        const waitForCard = () => {
          requestAnimationFrame(() => {
            const el = cardRef.current;
            if (el && el.clientWidth > 0) {
              clearTimeout(timeout);
              document.fonts.ready
                .then(() =>
                  toBlob(el, {
                    pixelRatio: 2,
                    backgroundColor: "#667eea",
                    width: el.scrollWidth,
                    height: el.scrollHeight,
                    ...(includeStyleProperties ? { includeStyleProperties } : {}),
                  })
                )
                .then((b) => (b ? resolve(b) : reject(new Error("Failed to generate image"))))
                .catch(reject);
            } else {
              waitForCard();
            }
          });
        };
        waitForCard();
      });

      const htmlContent = `<p>“${escapeHtml(truncated)}” - <a href="${escapeHtml(documentUrl)}">${escapeHtml(title)}</a></p>`;
      const plainContent = `“${truncated}”\n${documentUrl}`;

      const writePromise =
        typeof ClipboardItem !== "undefined"
          ? navigator.clipboard.write([
              new ClipboardItem({
                "image/png": blobPromise,
                "text/html": new Blob([htmlContent], { type: "text/html" }),
                "text/plain": new Blob([plainContent], { type: "text/plain" }),
              }),
            ])
          : navigator.clipboard.writeText(plainContent);

      writePromise
        .then(() =>
          toast.success("Copied to clipboard", {
            description: "Image and quote are ready to paste.",
          })
        )
        .catch(() =>
          toast.error("Couldn't copy to clipboard", {
            description: "Please try again, or check browser permissions.",
          })
        )
        .finally(() => setCapturing(false));
    },
    [capturing, href, title]
  );

  return { capture, capturing, text, cardRef };
}
