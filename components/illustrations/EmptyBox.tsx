import type { SVGProps } from "react";

/**
 * Hand-drawn line-art illustration of an empty open box with a couple of
 * sparkles. Used as a friendly empty state.
 *
 * Strokes use `currentColor`. Style inspired by Open Peeps (CC0); drawing
 * is original to this project.
 */
export default function EmptyBox(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="An empty open box"
      {...props}
    >
      {/* Sparkles */}
      <path d="M40 30 L 40 42" />
      <path d="M34 36 L 46 36" />

      <path d="M160 50 L 160 60" />
      <path d="M155 55 L 165 55" />

      <path d="M170 22 L 170 30" />
      <path d="M166 26 L 174 26" />

      {/* Box back flaps (open) */}
      <path d="M52 70 L 70 56" />
      <path d="M148 70 L 130 56" />
      <path d="M70 56 L 130 56" />

      {/* Box front opening */}
      <path d="M52 70 L 148 70" />
      <path d="M52 70 L 56 130" />
      <path d="M148 70 L 144 130" />
      <path d="M56 130 L 144 130" />

      {/* Inner shadow / opening line */}
      <path d="M58 76 C 90 84, 110 84, 142 76" />

      {/* Tape strip on the front */}
      <path d="M88 88 L 88 130" />
      <path d="M112 88 L 112 130" />

      {/* Ground line */}
      <path d="M30 142 C 70 138, 130 138, 170 142" />
    </svg>
  );
}
