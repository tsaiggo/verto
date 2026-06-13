'use client';

import {
  Children,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNearViewport } from '@/components/mdx/useNearViewport';

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

/**
 * Theme variables aligned with Verto's design tokens (see `app/globals.css`).
 * We use the `base` mermaid theme so these overrides take effect across all
 * diagram types (flowchart / sequence / state / class / er / gantt). Colors
 * were chosen to harmonize with `--accent-blue` while keeping enough hue
 * separation between primary / secondary / tertiary nodes to remain legible.
 *
 * Values are hardcoded hex (not `var(--accent-blue)`) because mermaid's
 * `themeVariables` API serializes these into the generated SVG at render
 * time and does not resolve CSS custom properties. They are kept in sync
 * manually with `app/globals.css`.
 */
const LIGHT_THEME_VARS = {
  // Core palette
  background: '#ffffff',
  primaryColor: '#eff6ff', // blue-50 — node fill
  primaryBorderColor: '#2563eb', // = --accent-blue
  primaryTextColor: '#111827', // = --text
  secondaryColor: '#f0fdf4', // mint — sequence actors, alt nodes
  secondaryBorderColor: '#16a34a',
  secondaryTextColor: '#111827',
  tertiaryColor: '#fef3c7', // amber-100 — nested states, third tier
  tertiaryBorderColor: '#d97706',
  tertiaryTextColor: '#111827',
  // Edges and labels
  lineColor: '#6b7280', // = --text-muted
  textColor: '#111827',
  // Notes
  noteBkgColor: '#fef9c3',
  noteBorderColor: '#ca8a04',
  noteTextColor: '#111827',
  // Sequence diagram
  actorBkg: '#eff6ff',
  actorBorder: '#2563eb',
  actorTextColor: '#111827',
  actorLineColor: '#6b7280',
  signalColor: '#374151',
  signalTextColor: '#111827',
  labelBoxBkgColor: '#eff6ff',
  labelBoxBorderColor: '#2563eb',
  labelTextColor: '#111827',
  loopTextColor: '#111827',
  activationBkgColor: '#dbeafe',
  activationBorderColor: '#2563eb',
} as const;

const DARK_THEME_VARS = {
  background: '#0f1117',
  primaryColor: '#1e293b', // slate-800
  primaryBorderColor: '#58a6ff', // = dark --accent-blue
  primaryTextColor: '#e6edf3', // = dark --text
  secondaryColor: '#14532d', // deep green
  secondaryBorderColor: '#4ade80',
  secondaryTextColor: '#e6edf3',
  tertiaryColor: '#451a03', // deep amber
  tertiaryBorderColor: '#f59e0b',
  tertiaryTextColor: '#e6edf3',
  lineColor: '#8b949e', // = dark --text-muted
  textColor: '#e6edf3',
  noteBkgColor: '#3f3f1d',
  noteBorderColor: '#a16207',
  noteTextColor: '#e6edf3',
  actorBkg: '#1e293b',
  actorBorder: '#58a6ff',
  actorTextColor: '#e6edf3',
  actorLineColor: '#8b949e',
  signalColor: '#c9d1d9',
  signalTextColor: '#e6edf3',
  labelBoxBkgColor: '#1e293b',
  labelBoxBorderColor: '#58a6ff',
  labelTextColor: '#e6edf3',
  loopTextColor: '#e6edf3',
  activationBkgColor: '#1e3a5f',
  activationBorderColor: '#58a6ff',
} as const;

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
  const [containerRef, isNearViewport] = useNearViewport<HTMLDivElement>();
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
    if (!source || !isNearViewport) return;
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: dark ? DARK_THEME_VARS : LIGHT_THEME_VARS,
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
  }, [source, dark, id, isNearViewport]);

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
