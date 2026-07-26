"use client";

import {
  Component,
  forwardRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { TriangleAlert } from "lucide-react";

import { MdxSourceEditor } from "@/components/editor/MdxSourceEditor";
import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";
import { cn } from "@/lib/utils";

import type { LocalMdxWorkspaceFormat } from "./local-mdx-workspace-types";
import styles from "./LocalMdxWorkspace.module.css";

interface SourcePaneProps {
  format: LocalMdxWorkspaceFormat;
  source: string;
  onChange: (source: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
}

export const SourcePane = forwardRef<HTMLTextAreaElement, SourcePaneProps>(function SourcePane(
  { format, source, onChange, onKeyDown, onFocus },
  ref
) {
  return (
    <MdxSourceEditor
      ref={ref}
      textareaClassName={styles.sourceTextarea}
      value={source}
      format={format}
      onValueChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      spellCheck={false}
      aria-label="MDX source"
    />
  );
});

interface PreviewPaneProps {
  source: string;
  format: LocalMdxWorkspaceFormat;
  unsupportedReason: string | null;
  onOpenSource?: () => void;
  onFocus?: () => void;
}

export function PreviewPane({
  source,
  format,
  unsupportedReason,
  onOpenSource,
  onFocus,
}: PreviewPaneProps) {
  if (unsupportedReason) {
    return (
      <SourceFallback reason={unsupportedReason} source={source} onOpenSource={onOpenSource} />
    );
  }

  return (
    <PreviewBoundary source={source} onOpenSource={onOpenSource}>
      <article className={cn(styles.previewDocument, "prose")} data-article onFocus={onFocus}>
        <RuntimeDocument source={source} format={format} />
      </article>
    </PreviewBoundary>
  );
}

interface PreviewBoundaryProps {
  source: string;
  onOpenSource?: () => void;
  children: ReactNode;
}

interface PreviewBoundaryState {
  hasError: boolean;
  source: string;
}

class PreviewBoundary extends Component<PreviewBoundaryProps, PreviewBoundaryState> {
  state: PreviewBoundaryState = { hasError: false, source: this.props.source };

  static getDerivedStateFromProps(
    props: PreviewBoundaryProps,
    state: PreviewBoundaryState
  ): Partial<PreviewBoundaryState> | null {
    if (props.source !== state.source) return { hasError: false, source: props.source };
    return null;
  }

  static getDerivedStateFromError(): Partial<PreviewBoundaryState> {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <SourceFallback
          reason="This MDX cannot be safely rendered in the preview."
          source={this.props.source}
          onOpenSource={this.props.onOpenSource}
        />
      );
    }

    return this.props.children;
  }
}

function SourceFallback({
  reason,
  source,
  onOpenSource,
}: {
  reason: string;
  source: string;
  onOpenSource?: () => void;
}) {
  return (
    <div className={styles.sourceFallback} role="alert">
      <div className={styles.fallbackHeader}>
        <TriangleAlert aria-hidden />
        <div>
          <strong>Preview kept in Source mode</strong>
          <p>{reason} Your file has not been changed.</p>
        </div>
        {onOpenSource ? (
          <button type="button" className={styles.openSourceButton} onClick={onOpenSource}>
            Open Source
          </button>
        ) : null}
      </div>
      <pre className={styles.fallbackSource}>{source || "(Empty document)"}</pre>
    </div>
  );
}
