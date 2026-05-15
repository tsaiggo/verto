'use client';

import {
  Children,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface ExcalidrawProps {
  /** Scene source — Excalidraw JSON, either as a `scene` prop or as text children */
  scene?: string;
  children?: ReactNode;
}

// Loader for the heavy excalidraw bundle — shared module-level promise so
// multiple diagrams on a single page only fetch the chunk once.
type ExcalidrawModule = typeof import('@excalidraw/excalidraw');
let excalidrawPromise: Promise<ExcalidrawModule> | null = null;

function loadExcalidraw(): Promise<ExcalidrawModule> {
  if (!excalidrawPromise) {
    excalidrawPromise = import('@excalidraw/excalidraw');
  }
  return excalidrawPromise;
}

function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * <Excalidraw> — client-only diagram renderer that turns an Excalidraw
 * scene (JSON) into an inline read-only SVG.
 *
 * Two ways to use:
 *   1. Fenced code block ```` ```excalidraw ```` — `rehype-excalidraw`
 *      rewrites these into a `<excalidraw-block data-source="…" />` marker,
 *      which the MDX components map then routes to this component.
 *   2. Explicit MDX `<Excalidraw scene="…">` or
 *      `<Excalidraw>{`{ "elements": [...] }`}</Excalidraw>`.
 *
 * The excalidraw package is dynamic-imported so pages without diagrams pay
 * no bundle cost. Re-renders on light/dark theme changes via a
 * MutationObserver watching `<html class>`.
 */
export default function Excalidraw({ scene, children }: ExcalidrawProps) {
  // Reduce children to a single string. Tolerates whitespace text nodes from MDX.
  const source = useMemo(() => {
    if (typeof scene === 'string') return scene;
    return Children.toArray(children)
      .map((c) => (typeof c === 'string' ? c : ''))
      .join('')
      .trim();
  }, [scene, children]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);

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
    setReady(false);
    (async () => {
      try {
        // Parse the scene JSON. Tolerate a top-level `.excalidraw` file or a
        // bare `{ elements, appState, files }` payload.
        let parsed: unknown;
        try {
          parsed = JSON.parse(source);
        } catch {
          throw new Error('Invalid Excalidraw JSON');
        }
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Excalidraw scene must be a JSON object');
        }
        const scenePayload = parsed as {
          elements?: unknown;
          appState?: unknown;
          files?: unknown;
        };

        const mod = await loadExcalidraw();
        // `restore` normalizes legacy/partial scenes into a fully-formed
        // { elements, appState, files } triple that exportToSvg expects.
        const restored = mod.restore(
          {
            elements: Array.isArray(scenePayload.elements)
              ? (scenePayload.elements as Parameters<typeof mod.restore>[0]['elements'])
              : [],
            appState:
              (scenePayload.appState as Parameters<typeof mod.restore>[0]['appState']) ??
              undefined,
            files:
              (scenePayload.files as Parameters<typeof mod.restore>[2]) ?? null,
          },
          null,
          null,
        );

        const svg = await mod.exportToSvg({
          elements: restored.elements,
          appState: {
            ...restored.appState,
            exportBackground: false,
            exportWithDarkMode: dark,
            theme: dark ? 'dark' : 'light',
          },
          files: restored.files ?? null,
        });

        // Make the SVG responsive: clear the absolute width/height that
        // exportToSvg sets so it scales to the container width while
        // preserving aspect ratio via the inherited viewBox.
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.setAttribute('style', 'max-width: 100%; height: auto;');

        if (cancelled) return;
        const host = containerRef.current;
        if (host) {
          host.replaceChildren(svg);
          setReady(true);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
          const host = containerRef.current;
          if (host) host.replaceChildren();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [source, dark]);

  if (!source) {
    return null;
  }

  if (error) {
    return (
      <div
        className="excalidraw excalidraw-error"
        role="img"
        aria-label="Excalidraw diagram error"
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Excalidraw render error</p>
        <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{error}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="excalidraw"
      role="img"
      aria-label="Diagram"
    >
      {!ready && <span className="excalidraw-loading">Loading…</span>}
    </div>
  );
}
