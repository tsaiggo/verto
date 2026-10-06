"use client";

import { Copy, Highlighter, MessageSquarePlus, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { siteConfig } from "@/lib/site";
import ShareImageCard from "@/components/ui/ShareImageCard";
import { useShareCapture } from "@/components/ui/useShareCapture";
import { ColorSwatches, type HighlightColor } from "./highlight-colors";
import styles from "./SelectionToolbar.module.css";

const TOOLBAR_WIDTH = 340;
const TOOLBAR_HEIGHT = 44;
const COMPACT_WIDTH = 304;
const COMPACT_HEIGHT = 108;

export interface ToolbarSelection {
  rect: { x: number; y: number; width: number; height: number };
  text: string;
}

export interface ShareInfo {
  title: string;
  author: string;
  tags: string[];
  href: string;
}

export default function SelectionToolbar({
  selection,
  share,
  onHighlight,
  onNote,
  onAsk,
}: {
  selection: ToolbarSelection;
  share: ShareInfo;
  onHighlight: (color?: HighlightColor) => void;
  onNote: () => void;
  onAsk?: () => void;
}) {
  const {
    capture,
    capturing,
    text: shareText,
    cardRef,
  } = useShareCapture({
    title: share.title,
    href: share.href,
  });

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(selection.text);
      else if (!document.execCommand("copy")) throw new Error("Copy unavailable");
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy text. Use your browser's Copy command.");
    }
  }

  const { top, left } = position(selection.rect);

  return (
    <>
      <div
        role="toolbar"
        aria-label="Selection actions"
        data-selection-toolbar
        className={`selection-toolbar ${styles.toolbar}`}
        style={{ top, left }}
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className={`${styles.group} ${styles.highlightGroup}`}>
          <button
            type="button"
            className="selection-tool"
            aria-label="Highlight"
            title="Highlight (H)"
            onClick={() => onHighlight()}
          >
            <Highlighter className="selection-tool-icon" aria-hidden />
          </button>
          <ColorSwatches mode="action" onChange={onHighlight} />
        </div>
        <div className={`${styles.group} ${styles.noteGroup}`}>
          <button
            type="button"
            className="selection-tool"
            aria-label="Highlight and add note"
            title="Note (N)"
            onClick={onNote}
          >
            <MessageSquarePlus className="selection-tool-icon" aria-hidden />
          </button>
          {onAsk && (
            <button
              type="button"
              className="selection-tool"
              aria-label="Ask AI about this"
              title="Ask AI (A)"
              onClick={onAsk}
            >
              <Sparkles className="selection-tool-icon" aria-hidden />
            </button>
          )}
        </div>
        <div className={styles.group}>
          <button
            type="button"
            className="selection-tool"
            aria-label="Copy text"
            title="Copy"
            onClick={copy}
          >
            <Copy className="selection-tool-icon" aria-hidden />
          </button>
          <button
            type="button"
            className="selection-tool"
            aria-label="Share as image"
            title="Share"
            disabled={capturing}
            onClick={() => capture(selection.text)}
          >
            <Share2 className="selection-tool-icon" aria-hidden />
          </button>
        </div>
      </div>

      {capturing && (
        <div style={{ height: 0, overflow: "hidden" }}>
          <ShareImageCard
            ref={cardRef}
            title={share.title}
            selectedText={shareText}
            author={share.author}
            tags={share.tags}
            blogUrl={`${siteConfig.url}${share.href}`}
          />
        </div>
      )}
    </>
  );
}

function position(rect: ToolbarSelection["rect"]): { top: number; left: number } {
  const margin = 8;
  const compact = window.innerWidth <= 700;
  const width = Math.min(compact ? COMPACT_WIDTH : TOOLBAR_WIDTH, window.innerWidth - margin * 2);
  const height = compact ? COMPACT_HEIGHT : TOOLBAR_HEIGHT;
  let left = rect.x + rect.width / 2 - width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  let top = rect.y - rect.height - height - margin;
  if (top - window.scrollY < margin) top = rect.y + margin;
  top = Math.max(
    window.scrollY + margin,
    Math.min(top, window.scrollY + window.innerHeight - height - margin)
  );
  return { top, left };
}
