"use client";

import { Copy, Highlighter, MessageSquarePlus, Share2 } from "lucide-react";
import { toast } from "sonner";
import { siteConfig } from "@/lib/site";
import ShareImageCard from "@/components/ui/ShareImageCard";
import { useShareCapture } from "@/components/ui/useShareCapture";

const PILL_WIDTH = 188;
const PILL_HEIGHT = 40;

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
}: {
  selection: ToolbarSelection;
  share: ShareInfo;
  onHighlight: () => void;
  onNote: () => void;
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

  function copy() {
    navigator.clipboard
      .writeText(selection.text)
      .then(() => toast.success("Copied to clipboard"))
      .catch(() => toast.error("Couldn't copy to clipboard"));
  }

  const { top, left } = position(selection.rect);

  return (
    <>
      <div
        role="toolbar"
        aria-label="Selection actions"
        data-selection-toolbar
        className="selection-toolbar animate-in fade-in-0 zoom-in-95 duration-150"
        style={{ top, left }}
        onMouseDown={(event) => event.preventDefault()}
      >
        <button
          type="button"
          className="selection-tool"
          aria-label="Highlight"
          title="Highlight (H)"
          onClick={onHighlight}
        >
          <Highlighter className="selection-tool-icon" aria-hidden />
        </button>
        <button
          type="button"
          className="selection-tool"
          aria-label="Highlight and add note"
          title="Note (N)"
          onClick={onNote}
        >
          <MessageSquarePlus className="selection-tool-icon" aria-hidden />
        </button>
        <span className="selection-toolbar-sep" aria-hidden />
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
  let left = rect.x + rect.width / 2 - PILL_WIDTH / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - PILL_WIDTH - margin));
  let top = rect.y - rect.height - PILL_HEIGHT - margin;
  if (top - window.scrollY < margin) top = rect.y + margin;
  return { top, left };
}
