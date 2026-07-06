import {
  ChevronDown,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

export const metadata = { title: "Graph" };

interface Node {
  label: string;
  x: number;
  y: number;
}

const CENTER = { x: 400, y: 300 };
const SATELLITES: Node[] = [
  { label: "Agents", x: 250, y: 120 },
  { label: "Prompt Patterns", x: 640, y: 200 },
  { label: "Design Principles", x: 660, y: 400 },
  { label: "Evaluation Framework", x: 470, y: 470 },
  { label: "Knowledge Graphs", x: 210, y: 430 },
  { label: "Context Windows", x: 150, y: 280 },
];

export default function GraphPage() {
  return (
    <>
      <PageHeader title="Graph" subtitle="Explore connections between your knowledge." />

      <div className="v-page graph">
        <div className="graph-toolbar">
          <button type="button" className="v-btn v-btn--sm">
            <SlidersHorizontal aria-hidden /> Filters <ChevronDown aria-hidden />
          </button>
          <button type="button" className="v-btn v-btn--sm">
            Types <ChevronDown aria-hidden />
          </button>
          <button type="button" className="v-btn v-btn--sm">
            Depth 2 <ChevronDown aria-hidden />
          </button>
          <div className="graph-toolbar-spacer" />
          <button type="button" className="v-btn v-btn--sm" aria-label="Fit to screen">
            <Maximize2 aria-hidden />
          </button>
          <button type="button" className="v-btn v-btn--sm" aria-label="Reset view">
            <RotateCcw aria-hidden />
          </button>
        </div>

        <div className="v-card graph-canvas">
          <label className="graph-search">
            <Search aria-hidden />
            <input type="text" placeholder="Search in graph" />
          </label>

          <svg viewBox="0 0 800 600" className="graph-svg" role="img" aria-label="Knowledge graph">
            {SATELLITES.map((n) => (
              <line
                key={`edge-${n.label}`}
                x1={CENTER.x}
                y1={CENTER.y}
                x2={n.x}
                y2={n.y}
                className="graph-edge"
              />
            ))}
            {SATELLITES.map((n) => (
              <g key={`node-${n.label}`} className="graph-node">
                <circle cx={n.x} cy={n.y} r={9} className="graph-dot" />
                <text x={n.x} y={n.y - 16} textAnchor="middle" className="graph-label">
                  {n.label}
                </text>
              </g>
            ))}
            <g className="graph-node graph-node--center">
              <rect
                x={CENTER.x - 26}
                y={CENTER.y - 26}
                width={52}
                height={52}
                rx={14}
                className="graph-hub"
              />
              <text x={CENTER.x} y={CENTER.y + 48} textAnchor="middle" className="graph-hub-label">
                Agent-native Workflows
              </text>
            </g>
          </svg>

          <div className="graph-zoom">
            <button type="button" aria-label="Zoom in">
              <Plus aria-hidden />
            </button>
            <button type="button" aria-label="Zoom out">
              <Minus aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
