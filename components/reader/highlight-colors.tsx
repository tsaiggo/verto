"use client";

export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

export const DEFAULT_HIGHLIGHT_COLOR: HighlightColor = "yellow";

const COLOR_LABELS: Record<HighlightColor, string> = {
  yellow: "Amber",
  green: "Green",
  blue: "Blue",
  pink: "Rose",
};

export function ColorSwatches({
  value,
  onChange,
  disabled = false,
}: {
  value: HighlightColor;
  onChange: (color: HighlightColor) => void;
  disabled?: boolean;
}) {
  return (
    <div className="annotation-swatches" role="radiogroup" aria-label="Highlight color">
      {HIGHLIGHT_COLORS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          aria-label={COLOR_LABELS[key]}
          title={COLOR_LABELS[key]}
          data-color={key}
          data-selected={value === key}
          className="annotation-swatch"
          disabled={disabled}
          onClick={() => onChange(key)}
        />
      ))}
    </div>
  );
}
