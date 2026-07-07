"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { GraphData } from "@/lib/graph";
import {
  clampScale,
  drawGraph,
  EMPTY_SIZE,
  fitView,
  hitNode,
  layoutGraph,
  readGraphPalette,
  RESET_VIEW,
  visibleIds,
  type CanvasSize,
  type DrawState,
  type Point,
  type Viewport,
} from "./graph-layout";

type DragState = { readonly start: Point; readonly origin: Viewport; readonly moved: boolean };

export default function GraphCanvas({ data }: { readonly data: GraphData }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [query, setQuery] = useState("");
  const [size, setSize] = useState<CanvasSize>(EMPTY_SIZE);
  const [view, setView] = useState<Viewport>(RESET_VIEW);

  const nodes = useMemo(() => layoutGraph(data), [data]);
  const ids = useMemo(() => visibleIds(nodes, query), [nodes, query]);
  const drawState: DrawState = useMemo(
    () => ({ nodes, edges: data.edges, view, size }),
    [data.edges, nodes, size, view]
  );
  const fit = useCallback(() => setView(fitView(nodes, size)), [nodes, size]);
  const zoomBy = useCallback(
    (delta: number) =>
      setView((current) => ({ ...current, scale: clampScale(current.scale * delta) })),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(size.width * ratio));
    canvas.height = Math.max(1, Math.floor(size.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawGraph(ctx, ids, drawState, readGraphPalette(document.documentElement));
  }, [drawState, ids, size]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => fit());
    return () => cancelAnimationFrame(frame);
  }, [fit]);

  function pointerPoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDrag(event: React.PointerEvent<HTMLCanvasElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { start: pointerPoint(event), origin: view, moved: false };
  }

  function moveDrag(event: React.PointerEvent<HTMLCanvasElement>): void {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointerPoint(event);
    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    dragRef.current = { ...drag, moved: drag.moved || Math.hypot(dx, dy) > 3 };
    setView({ ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy });
  }

  function endDrag(event: React.PointerEvent<HTMLCanvasElement>): void {
    const drag = dragRef.current;
    dragRef.current = null;
    const node = drag?.moved ? null : hitNode(pointerPoint(event), ids, drawState);
    if (node) router.push(node.href);
  }

  function wheelZoom(event: React.WheelEvent<HTMLCanvasElement>): void {
    event.preventDefault();
    zoomBy(event.deltaY > 0 ? 0.9 : 1.1);
  }

  return (
    <div className="v-page graph">
      <div className="graph-toolbar">
        <DisabledToolbarButton label="Filters" icon="filters" />
        <DisabledToolbarButton label="Types" />
        <DisabledToolbarButton label="Depth 2" />
        <div className="graph-toolbar-spacer" />
        <button type="button" className="v-btn v-btn--sm" onClick={fit} aria-label="Fit to screen">
          <Maximize2 aria-hidden /> Fit
        </button>
        <button
          type="button"
          className="v-btn v-btn--sm"
          onClick={() => setView(RESET_VIEW)}
          aria-label="Reset view"
        >
          <RotateCcw aria-hidden /> Reset
        </button>
      </div>
      <div className="v-card graph-canvas">
        <label className="graph-search">
          <Search aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="text"
            placeholder="Search in graph"
          />
        </label>
        <canvas
          ref={canvasRef}
          className="graph-svg"
          aria-label="Knowledge graph"
          role="img"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onWheel={wheelZoom}
        />
        <div className="graph-zoom">
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.16)}>
            <Plus aria-hidden />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(0.86)}>
            <Minus aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function DisabledToolbarButton({
  label,
  icon,
}: {
  readonly label: string;
  readonly icon?: "filters";
}) {
  return (
    <button
      type="button"
      className="v-btn v-btn--sm"
      disabled
      title="Filter controls coming in a future update"
    >
      {icon === "filters" ? <SlidersHorizontal aria-hidden /> : null}
      {label} <ChevronDown aria-hidden />
    </button>
  );
}
