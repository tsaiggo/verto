import type { GraphData, GraphEdge, GraphNode } from "@/lib/graph";

export type Point = { readonly x: number; readonly y: number };
export type Viewport = { readonly x: number; readonly y: number; readonly scale: number };
export type CanvasSize = { readonly width: number; readonly height: number };
export type LayoutNode = GraphNode & { x: number; y: number; vx: number; vy: number };
export type DrawState = {
  readonly nodes: readonly LayoutNode[];
  readonly edges: readonly GraphEdge[];
  readonly view: Viewport;
  readonly size: CanvasSize;
};

type GraphPalette = {
  readonly accent: string;
  readonly bg: string;
  readonly edge: string;
  readonly text: string;
};

export const EMPTY_SIZE: CanvasSize = { width: 800, height: 560 };
export const RESET_VIEW: Viewport = { x: 0, y: 0, scale: 1 };

const NODE_RADIUS = 11;
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.6;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function visibleIds(nodes: readonly LayoutNode[], query: string): Set<string> {
  const needle = query.trim().toLowerCase();
  return new Set(
    nodes.filter((node) => node.label.toLowerCase().includes(needle)).map((node) => node.id)
  );
}

export function layoutGraph(data: GraphData): readonly LayoutNode[] {
  const count = Math.max(1, data.nodes.length);
  const links = data.edges.map((edge) => ({ source: edge.source, target: edge.target }));
  const nodes = data.nodes.map((node, index): LayoutNode => {
    const angle = (index / count) * Math.PI * 2;
    const radius = 120 + (index % 5) * 24;
    return { ...node, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, vx: 0, vy: 0 };
  });

  for (let tick = 0; tick < 220; tick += 1) {
    pushApart(nodes);
    pullLinked(nodes, links);
    settle(nodes);
  }
  return nodes;
}

export function fitView(nodes: readonly LayoutNode[], size: CanvasSize): Viewport {
  if (nodes.length === 0) return RESET_VIEW;
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs) - 80;
  const maxX = Math.max(...xs) + 80;
  const minY = Math.min(...ys) - 80;
  const maxY = Math.max(...ys) + 80;
  const scale = clampScale(Math.min(size.width / (maxX - minX), size.height / (maxY - minY), 1.4));
  return { x: -((minX + maxX) / 2) * scale, y: -((minY + maxY) / 2) * scale, scale };
}

export function hitNode(
  point: Point,
  ids: ReadonlySet<string>,
  state: DrawState
): LayoutNode | null {
  const world = toWorld(point, state);
  return (
    state.nodes.find((node) => {
      if (!ids.has(node.id)) return false;
      const dx = node.x - world.x;
      const dy = node.y - world.y;
      return Math.hypot(dx, dy) <= NODE_RADIUS + 4;
    }) ?? null
  );
}

export function readGraphPalette(root: Element): GraphPalette {
  const style = getComputedStyle(root);
  return {
    accent: style.getPropertyValue("--accent-blue").trim() || "#2563EB",
    bg: style.getPropertyValue("--bg").trim() || "#FAFAFA",
    edge: style.getPropertyValue("--text-muted").trim() || "#6B6F76",
    text: style.getPropertyValue("--text").trim() || "#0F1115",
  };
}

export function drawGraph(
  ctx: CanvasRenderingContext2D,
  ids: ReadonlySet<string>,
  state: DrawState,
  palette: GraphPalette
): void {
  ctx.clearRect(0, 0, state.size.width, state.size.height);
  ctx.save();
  ctx.translate(state.size.width / 2 + state.view.x, state.size.height / 2 + state.view.y);
  ctx.scale(state.view.scale, state.view.scale);
  drawEdges(ctx, ids, state, palette.edge);
  drawNodes(ctx, ids, state, palette);
  ctx.restore();
}

function pushApart(nodes: readonly LayoutNode[]): void {
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const a = nodes[left];
      const b = nodes[right];
      if (!a || !b) continue;
      const dx = a.x - b.x || 0.01;
      const dy = a.y - b.y || 0.01;
      const force = 950 / (dx * dx + dy * dy);
      a.vx += dx * force;
      a.vy += dy * force;
      b.vx -= dx * force;
      b.vy -= dy * force;
    }
  }
}

function pullLinked(
  nodes: readonly LayoutNode[],
  links: readonly { readonly source: string; readonly target: string }[]
): void {
  for (const edge of links) {
    const source = nodes.find((node) => node.id === edge.source);
    const target = nodes.find((node) => node.id === edge.target);
    if (!source || !target) continue;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    source.vx += dx * 0.006;
    source.vy += dy * 0.006;
    target.vx -= dx * 0.006;
    target.vy -= dy * 0.006;
  }
}

function settle(nodes: readonly LayoutNode[]): void {
  for (const node of nodes) {
    node.vx += -node.x * 0.004;
    node.vy += -node.y * 0.004;
    node.x += node.vx;
    node.y += node.vy;
    node.vx *= 0.78;
    node.vy *= 0.78;
  }
}

function toWorld(point: Point, state: DrawState): Point {
  return {
    x: (point.x - state.size.width / 2 - state.view.x) / state.view.scale,
    y: (point.y - state.size.height / 2 - state.view.y) / state.view.scale,
  };
}

function drawEdges(
  ctx: CanvasRenderingContext2D,
  ids: ReadonlySet<string>,
  state: DrawState,
  stroke: string
): void {
  const byId = new Map(state.nodes.map((node) => [node.id, node]));
  ctx.lineWidth = 1.4 / state.view.scale;
  ctx.strokeStyle = stroke;
  ctx.globalAlpha = 0.34;
  for (const edge of state.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  ids: ReadonlySet<string>,
  state: DrawState,
  palette: GraphPalette
): void {
  for (const node of state.nodes) {
    if (!ids.has(node.id)) continue;
    ctx.beginPath();
    ctx.fillStyle = palette.accent;
    ctx.strokeStyle = palette.bg;
    ctx.lineWidth = 3 / state.view.scale;
    ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.text;
    ctx.font = `${12 / state.view.scale}px var(--font-hanken), sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(node.label, node.x, node.y - 18);
  }
}
