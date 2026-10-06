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

type ColorSwatchProps = { onChange: (color: HighlightColor) => void } & (
  | { mode: "action" }
  | { mode?: "choice"; value: HighlightColor }
);

export function ColorSwatches(props: ColorSwatchProps) {
  const action = props.mode === "action";
  const value = props.mode === "action" ? null : props.value;
  return (
    <div
      className="annotation-swatches"
      role={action ? "group" : "radiogroup"}
      aria-label={action ? "Highlight in a color" : "Highlight color"}
    >
      {HIGHLIGHT_COLORS.map((key) => (
        <button
          key={key}
          type="button"
          role={action ? undefined : "radio"}
          aria-checked={action ? undefined : value === key}
          aria-label={action ? `Highlight in ${COLOR_LABELS[key]}` : COLOR_LABELS[key]}
          title={COLOR_LABELS[key]}
          data-color={key}
          data-selected={value === key}
          className="annotation-swatch"
          onClick={() => props.onChange(key)}
        />
      ))}
    </div>
  );
}
