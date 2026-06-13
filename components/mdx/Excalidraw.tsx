'use client';

import {
  Children,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNearViewport } from '@/components/mdx/useNearViewport';

interface ExcalidrawProps {
  /** Scene source — Excalidraw JSON, either as a `scene` prop or as text children */
  scene?: string;
  children?: ReactNode;
}

// Loader for the heavy excalidraw bundle — shared module-level promise so
// multiple diagrams on a single page only fetch the chunk once.
type ExcalidrawModule = typeof import('@excalidraw/excalidraw');
type ExcalidrawRestoreInput = NonNullable<
  Parameters<ExcalidrawModule['restore']>[0]
>;
let excalidrawPromise: Promise<ExcalidrawModule> | null = null;

// Excalidraw resolves its font subset Worker and font assets relative to
// `window.EXCALIDRAW_ASSET_PATH`. When self-hosted via Next.js, the bundler
// rewrites the worker URL to a `file:///ROOT/...` path that the browser
// rejects with a SecurityError (and Excalidraw silently falls back to the
// main thread). Pointing the asset path at a public CDN that mirrors the
// installed version restores worker-based subsetting and avoids the noisy
// console error.
// Pinned manually because `@excalidraw/excalidraw`'s `exports` field does not
// expose `package.json` for runtime introspection. Bump alongside the
// dependency in `package.json`.
const EXCALIDRAW_PKG_VERSION = '0.18.1';
const EXCALIDRAW_VIEWPORT_FALLBACK_MS = 1200;

function ensureExcalidrawAssetPath(): void {
  if (typeof window === 'undefined') return;
  const w = window as typeof window & { EXCALIDRAW_ASSET_PATH?: string };
  if (!w.EXCALIDRAW_ASSET_PATH) {
    w.EXCALIDRAW_ASSET_PATH = `https://unpkg.com/@excalidraw/excalidraw@${EXCALIDRAW_PKG_VERSION}/dist/prod/`;
  }
}

function loadExcalidraw(): Promise<ExcalidrawModule> {
  if (!excalidrawPromise) {
    ensureExcalidrawAssetPath();
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

  const [viewportRef, isNearViewport] = useNearViewport<HTMLDivElement>(
    undefined,
    EXCALIDRAW_VIEWPORT_FALLBACK_MS,
  );
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
    if (!source || !isNearViewport) return;
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
              ? (scenePayload.elements as ExcalidrawRestoreInput['elements'])
              : [],
            appState:
              (scenePayload.appState as ExcalidrawRestoreInput['appState']) ??
              undefined,
            files: (scenePayload.files as ExcalidrawRestoreInput['files']) ?? undefined,
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
  }, [source, dark, isNearViewport]);

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

  // The SVG host (`containerRef`) is managed imperatively via
  // `replaceChildren`. It MUST NOT contain any React-rendered children, or
  // React's reconciler will later attempt to remove a node that imperative
  // code has already detached, throwing
  // `NotFoundError: Failed to execute 'removeChild' on 'Node'`.
  return (
    <div ref={viewportRef} className="excalidraw" role="img" aria-label="Diagram">
      {!ready && <span className="excalidraw-loading">Loading…</span>}
      <div ref={containerRef} className="excalidraw-host" />
    </div>
  );
}
