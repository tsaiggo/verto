"use client";

import { Children, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DiagramLightbox } from "@/components/mdx/DiagramLightbox";
import { useNearViewport } from "@/components/mdx/useNearViewport";
import { withTimeout } from "@/lib/with-timeout";

interface ExcalidrawProps {
  /** Scene source — Excalidraw JSON, either as a `scene` prop or as text children */
  scene?: string;
  children?: ReactNode;
}

interface ExcalidrawRenderState {
  source: string;
  dark: boolean;
  error: string | null;
  markup: string | null;
}

// Loader for the heavy excalidraw bundle — shared module-level promise so
// multiple diagrams on a single page only fetch the chunk once.
type ExcalidrawModule = typeof import("@excalidraw/excalidraw");
type ExcalidrawRestoreInput = NonNullable<Parameters<ExcalidrawModule["restore"]>[0]>;
let excalidrawPromise: Promise<ExcalidrawModule> | null = null;

// Excalidraw resolves its font subset Worker and font assets relative to
// `window.EXCALIDRAW_ASSET_PATH`. Upstream defaults this to a public CDN, so
// every diagram depends on a live network round-trip at render time. In an
// offline, firewalled, or otherwise network-restricted context — most notably
// the packaged desktop app — those `fetch`es never settle, and because
// `exportToSvg` awaits them with no timeout the diagram hangs on "Loading…"
// indefinitely.
//
// We instead self-host the asset bundle: `scripts/copy-excalidraw-assets.mjs`
// copies `@excalidraw/excalidraw/dist/prod` into `public/excalidraw-assets/`
// (wired to `pre{dev,build,build:tauri}` in package.json), so the assets are
// served same-origin and always resolve — in the browser
// (`/excalidraw-assets/…`) and in the static desktop export alike.
const EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";
// Even with same-origin assets, a wedged Worker or font load must not pin the
// component on "Loading…" forever; surface an error past this ceiling instead.
const EXCALIDRAW_RENDER_TIMEOUT_MS = 15_000;

function ensureExcalidrawAssetPath(): void {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { EXCALIDRAW_ASSET_PATH?: string };
  if (!w.EXCALIDRAW_ASSET_PATH) {
    w.EXCALIDRAW_ASSET_PATH = EXCALIDRAW_ASSET_PATH;
  }
}

function loadExcalidraw(): Promise<ExcalidrawModule> {
  if (!excalidrawPromise) {
    ensureExcalidrawAssetPath();
    excalidrawPromise = import("@excalidraw/excalidraw");
  }
  return excalidrawPromise;
}

function isDarkTheme(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
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
    if (typeof scene === "string") return scene;
    return Children.toArray(children)
      .map((c) => (typeof c === "string" ? c : ""))
      .join("")
      .trim();
  }, [scene, children]);

  const [viewportRef, isNearViewport] = useNearViewport<HTMLDivElement>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState<boolean>(false);
  const [renderState, setRenderState] = useState<ExcalidrawRenderState>({
    source: "",
    dark: false,
    error: null,
    markup: null,
  });
  const renderIsCurrent = renderState.source === source && renderState.dark === dark;
  const error = renderIsCurrent ? renderState.error : null;
  const svgMarkup = renderIsCurrent ? renderState.markup : null;
  const ready = svgMarkup !== null;

  // Track theme — re-render when html.dark toggles. The initial read is
  // deferred to a microtask via `requestAnimationFrame` to satisfy
  // `react-hooks/set-state-in-effect`.
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
        // Parse the scene JSON. Tolerate a top-level `.excalidraw` file or a
        // bare `{ elements, appState, files }` payload.
        let parsed: unknown;
        try {
          parsed = JSON.parse(source);
        } catch {
          throw new Error("Invalid Excalidraw JSON");
        }
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Excalidraw scene must be a JSON object");
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
              ? (scenePayload.elements as ExcalidrawRestoreInput["elements"])
              : [],
            appState: (scenePayload.appState as ExcalidrawRestoreInput["appState"]) ?? undefined,
            files: (scenePayload.files as ExcalidrawRestoreInput["files"]) ?? undefined,
          },
          null,
          null
        );

        const svg = await withTimeout<SVGSVGElement>(
          mod.exportToSvg({
            elements: restored.elements,
            appState: {
              ...restored.appState,
              exportBackground: false,
              exportWithDarkMode: dark,
              theme: dark ? "dark" : "light",
            },
            files: restored.files ?? null,
          }),
          EXCALIDRAW_RENDER_TIMEOUT_MS,
          "Excalidraw render"
        );

        // Make the SVG responsive: clear the absolute width/height that
        // exportToSvg sets so it scales to the container width while
        // preserving aspect ratio via the inherited viewBox.
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.setAttribute("style", "max-width: 100%; height: auto;");
        const markup = svg.outerHTML;

        if (cancelled) return;
        const host = containerRef.current;
        if (host) {
          host.replaceChildren(svg);
          setRenderState({ source, dark, error: null, markup });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setRenderState({ source, dark, error: msg, markup: null });
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
      <div className="excalidraw excalidraw-error" role="img" aria-label="Excalidraw diagram error">
        <p style={{ margin: 0, fontWeight: 600 }}>Excalidraw render error</p>
        <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    );
  }

  // The SVG host (`containerRef`) is managed imperatively via
  // `replaceChildren`. It MUST NOT contain any React-rendered children, or
  // React's reconciler will later attempt to remove a node that imperative
  // code has already detached, throwing
  // `NotFoundError: Failed to execute 'removeChild' on 'Node'`.
  return (
    <DiagramLightbox
      title="Excalidraw sketch"
      disabled={!ready || !svgMarkup}
      expanded={
        <div
          className="excalidraw excalidraw-lightbox-view"
          role="img"
          aria-label="Excalidraw sketch"
          dangerouslySetInnerHTML={svgMarkup ? { __html: svgMarkup } : undefined}
        />
      }
    >
      <div ref={viewportRef} className="excalidraw" role="img" aria-label="Diagram">
        {!ready && <span className="excalidraw-loading">Loading…</span>}
        <div ref={containerRef} className="excalidraw-host" />
      </div>
    </DiagramLightbox>
  );
}
