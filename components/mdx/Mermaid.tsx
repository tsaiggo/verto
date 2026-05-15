'use client';

import {
  Children,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface MermaidProps {
  /** Diagram source — either as a `chart` prop or as text children */
  chart?: string;
  children?: ReactNode;
}

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default);
  }
  return mermaidPromise;
}

function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * <Mermaid> — client-only diagram renderer.
 *
 * Two ways to use:
 *   1. Fenced code block ```` ```mermaid ```` — `rehype-mermaid` rewrites
 *      these into a `<mermaid-block data-source="…" />` marker, which the
 *      MDX components map then routes to this component.
 *   2. Explicit MDX `<Mermaid chart="…">` or `<Mermaid>graph TD; …</Mermaid>`.
 *
 * Mermaid itself is dynamic-imported so pages without diagrams pay no
 * bundle cost. Re-renders on light/dark theme changes via a MutationObserver
 * watching `<html class>`.
 */
export default function Mermaid({ chart, children }: MermaidProps) {
  // Reduce children to a single string. Tolerates whitespace text nodes from MDX.
  const source = useMemo(() => {
    if (typeof chart === 'string') return chart;
    return Children.toArray(children)
      .map((c) => (typeof c === 'string' ? c : ''))
      .join('')
      .trim();
  }, [chart, children]);

  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '_');
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState<boolean>(false);

  // Track theme — re-render when html.dark toggles. The initial read is
  // deferred to a microtask via `requestAnimationFrame` to satisfy
  // `react-hooks/set-state-in-effect`.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDark(isDarkTheme()));
    const observer = new MutationObserver(() => setDark(isDarkTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? 'dark' : 'default',
          fontFamily:
            'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
          securityLevel: 'strict',
        });
        // Per-render unique ID — mermaid.render reuses DOM otherwise
        const renderId = `mmd-${id}-${dark ? 'd' : 'l'}`;
        const result = await mermaid.render(renderId, source);
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
          setSvg(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, dark, id]);

  if (!source) {
    return null;
  }

  if (error) {
    return (
      <div
        className="mermaid mermaid-error"
        role="img"
        aria-label="Mermaid diagram error"
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Mermaid render error</p>
        <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{error}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid"
      role="img"
      aria-label="Diagram"
      // SVG comes from a trusted server-side source string, sanitized by
      // mermaid (securityLevel: 'strict'). Safe to inject.
      dangerouslySetInnerHTML={
        svg ? { __html: svg } : { __html: '<span class="mermaid-loading">Loading…</span>' }
      }
    />
  );
}
