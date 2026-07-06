import type React from "react";

/** Keyboard step for the slider: ←/→ ±5%, Home/End jump to 0/100. */
export function nextPosForKey(key: string, pos: number): number | null {
  switch (key) {
    case "ArrowLeft":
      return pos - 5;
    case "ArrowRight":
      return pos + 5;
    case "Home":
      return 0;
    case "End":
      return 100;
    default:
      return null;
  }
}

/** The two floating before/after labels overlaid on the frame. */
export function CompareLabels({
  beforeLabel,
  afterLabel,
  pos,
}: {
  beforeLabel?: string;
  afterLabel?: string;
  pos: number;
}) {
  return (
    <>
      {beforeLabel && (
        <span
          className="compare-slider-label compare-slider-label-before"
          style={{ opacity: pos > 8 ? 1 : 0 }}
        >
          {beforeLabel}
        </span>
      )}
      {afterLabel && (
        <span
          className="compare-slider-label compare-slider-label-after"
          style={{ opacity: pos < 92 ? 1 : 0 }}
        >
          {afterLabel}
        </span>
      )}
    </>
  );
}

/** The draggable divider + WAI-ARIA slider handle. */
export function CompareHandle({
  pos,
  labelId,
  hasLabel,
  onKeyDown,
  onPointerDown,
}: {
  pos: number;
  labelId: string;
  hasLabel: boolean;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="compare-slider-divider" style={{ left: `${pos}%` }} aria-hidden="true">
      <button
        type="button"
        className="compare-slider-handle"
        role="slider"
        aria-label="Drag to compare before and after"
        aria-labelledby={hasLabel ? labelId : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)}% before`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 6 9 12 15 18" />
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
    </div>
  );
}

/** Static caption under the frame, shown when either label is set. */
export function CompareCaption({
  labelId,
  beforeLabel,
  afterLabel,
}: {
  labelId: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  if (!beforeLabel && !afterLabel) return null;
  return (
    <figcaption id={labelId} className="compare-caption">
      {beforeLabel && <span>{beforeLabel}</span>}
      {beforeLabel && afterLabel && <span aria-hidden="true"> ↔ </span>}
      {afterLabel && <span>{afterLabel}</span>}
    </figcaption>
  );
}
