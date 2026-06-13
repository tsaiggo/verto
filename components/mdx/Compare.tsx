import type { ReactNode } from "react";
import CompareSlider from "./CompareSlider";

interface CompareSliderModeProps {
  mode?: "slider";
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  initial?: number;
  alt?: string;
  children?: never;
  titles?: never;
}

interface CompareSideModeProps {
  mode: "side";
  titles?: string[];
  children?: ReactNode;
  before?: never;
  after?: never;
  beforeLabel?: never;
  afterLabel?: never;
  initial?: never;
  alt?: never;
}

type CompareProps = CompareSliderModeProps | CompareSideModeProps;

/**
 * <Compare> — unified before/after comparison primitive with two modes.
 *
 * `mode="slider"` (default): a draggable image overlay slider. Routed to
 * the `<CompareSlider>` client component because it requires pointer + key
 * state. Use this for two same-shape images (screenshots, photo edits).
 *
 * `mode="side"`: a responsive grid that renders each MDX child as a column.
 * Stays a server component — zero client JS. Optionally takes a `titles`
 * array to render a header row above each column.
 *
 * @example
 * <Compare before="/before.png" after="/after.png" beforeLabel="Light" afterLabel="Dark" />
 *
 * @example
 * <Compare mode="side" titles={["Option A", "Option B"]}>
 *   <div>Column 1 content…</div>
 *   <div>Column 2 content…</div>
 * </Compare>
 */
export default function Compare(props: CompareProps) {
  if (props.mode === "side") {
    const { titles, children } = props;
    return (
      <div className="compare compare-side" role="group" aria-label="Side-by-side comparison">
        {titles && titles.length > 0 && (
          <div
            className="compare-side-headers"
            style={{ ["--compare-cols" as string]: titles.length }}
          >
            {titles.map((t, i) => (
              <div key={i} className="compare-side-header">
                {t}
              </div>
            ))}
          </div>
        )}
        <div
          className="compare-side-body"
          style={{ ["--compare-cols" as string]: titles?.length ?? undefined }}
        >
          {children}
        </div>
      </div>
    );
  }

  // Default slider mode
  return (
    <CompareSlider
      before={props.before}
      after={props.after}
      beforeLabel={props.beforeLabel}
      afterLabel={props.afterLabel}
      initial={props.initial}
      alt={props.alt}
    />
  );
}
