"use client";

import { Children, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNearViewport } from "@/components/mdx/useNearViewport";

interface D2Props {
  /** Diagram source — either as a `chart` prop or as text children */
  chart?: string;
  children?: ReactNode;
  /** Light-mode theme ID; see https://d2lang.com/tour/themes. Default 0. */
  themeId?: number;
  /** Dark-mode theme ID. Default 200 (D2's built-in dark theme). */
  darkThemeId?: number;
  /** Layout engine. `dagre` (default) keeps the WASM payload small. */
  layout?: "dagre" | "elk";
}

type D2Module = typeof import("@terrastruct/d2");
type SanitizeFn = (dirty: string) => string;

// Module-level promises so multiple diagrams on a page share one fetch.
let d2Promise: Promise<{ d2: InstanceType<D2Module["D2"]> }> | null = null;
let sanitizePromise: Promise<SanitizeFn> | null = null;

function loadD2() {
  if (!d2Promise) {
    d2Promise = import("@terrastruct/d2").then((mod) => ({
      d2: new mod.D2(),
    }));
  }
  return d2Promise;
}

function loadSanitize(): Promise<SanitizeFn> {
  if (!sanitizePromise) {
    sanitizePromise = import("isomorphic-dompurify").then((mod) => {
      const purify = mod.default;
      return (dirty: string) =>
        purify.sanitize(dirty, {
          USE_PROFILES: { svg: true, svgFilters: true },
          // Preserve foreignObject so D2 text rendering stays intact.
          ADD_TAGS: ["foreignObject"],
        }) as string;
    });
  }
  return sanitizePromise;
}

function isDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/**
 * <D2> — client-only D2 diagram renderer.
 *
 * Two ways to use:
 *   1. Fenced code block ```` ```d2 ```` — `rehype-d2` rewrites these
 *      into a `<d2-block data-source="…" />` marker, which the MDX
 *      components map then routes to this component.
 *   2. Explicit MDX `<D2 chart="…">` or `<D2>{`a -> b`}</D2>`.
 *
 * The D2 WASM bundle (~3MB) is dynamic-imported so pages without diagrams
 * pay no bundle cost. Re-renders on light/dark theme changes via a
 * MutationObserver watching `<html class>`. SVG output is sanitized with
 * DOMPurify before being injected.
 */
export default function D2({
  chart,
  children,
  themeId = 0,
  darkThemeId = 200,
  layout = "dagre",
}: D2Props) {
  const source = useMemo(() => {
    if (typeof chart === "string") return chart;
    return Children.toArray(children)
      .map((c) => (typeof c === "string" ? c : ""))
      .join("")
      .trim();
  }, [chart, children]);

  const [containerRef, isNearViewport] = useNearViewport<HTMLDivElement>();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState<boolean>(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDark(isDarkTheme()));
    const observer = new MutationObserver(() => setDark(isDarkTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
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
        const [{ d2 }, sanitize] = await Promise.all([loadD2(), loadSanitize()]);

        const compiled = await d2.compile({
          fs: { index: source },
          inputPath: "index",
          options: { layout },
        });
        const raw = await d2.render(compiled.diagram, {
          themeID: dark ? darkThemeId : themeId,
          // Strip the XML prolog so the SVG embeds directly in HTML.
          noXMLTag: true,
        });
        const clean = sanitize(raw);
        if (!cancelled) {
          setSvg(clean);
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
  }, [source, dark, themeId, darkThemeId, layout, isNearViewport]);

  if (!source) return null;

  if (error) {
    return (
      <div className="d2 d2-error" role="img" aria-label="D2 diagram error">
        <p style={{ margin: 0, fontWeight: 600 }}>D2 render error</p>
        <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{error}</pre>
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer" }}>Source</summary>
          <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{source}</pre>
        </details>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="d2"
      role="img"
      aria-label="Diagram"
      // SVG is sanitized by DOMPurify before injection (see loadSanitize).
      dangerouslySetInnerHTML={
        svg ? { __html: svg } : { __html: '<span class="d2-loading">Loading…</span>' }
      }
    />
  );
}
