import type { SVGProps } from "react";

/**
 * Hand-drawn line-art illustration of a person reading a book.
 * Strokes use `currentColor`; set the parent element's `color` to recolor.
 *
 * Style inspired by Open Peeps (CC0) — drawing is original to this project.
 */
export default function ReadingPerson(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 220"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="A person reading a book"
      {...props}
    >
      {/* Hair tuft on top */}
      <path d="M82 38 C 82 26, 95 22, 102 24 C 112 20, 126 28, 126 40" />
      <path d="M86 36 C 88 32, 92 30, 96 32" />
      <path d="M118 34 C 122 32, 126 34, 128 38" />

      {/* Head — slightly wobbly oval */}
      <path d="M82 56 C 80 42, 92 32, 104 32 C 120 32, 130 44, 130 58 C 130 72, 122 84, 108 86 C 92 88, 82 76, 82 60 Z" />

      {/* Ear */}
      <path d="M128 60 C 134 60, 134 70, 128 70" />

      {/* Eyes — closed/peaceful, looking down at book */}
      <path d="M94 60 C 96 62, 100 62, 102 60" />
      <path d="M114 60 C 116 62, 120 62, 122 60" />

      {/* Smile */}
      <path d="M102 72 C 105 75, 110 75, 113 72" />

      {/* Neck */}
      <path d="M100 86 L 100 96" />
      <path d="M114 86 L 114 96" />

      {/* Shoulders / sweater */}
      <path d="M64 124 C 70 104, 88 96, 100 96 L 114 96 C 128 96, 144 104, 152 124" />

      {/* Body / torso outline */}
      <path d="M64 124 C 60 144, 60 168, 66 188" />
      <path d="M152 124 C 156 144, 156 168, 150 188" />
      <path d="M66 188 L 150 188" />

      {/* Sweater collar detail */}
      <path d="M94 100 C 100 108, 116 108, 122 100" />

      {/* Left arm — holding book */}
      <path d="M68 128 C 60 142, 58 156, 70 162" />
      {/* Right arm — holding book */}
      <path d="M148 128 C 156 142, 158 156, 146 162" />

      {/* Book — open, held in front */}
      <path d="M70 158 L 70 184" />
      <path d="M146 158 L 146 184" />
      <path d="M70 158 C 90 152, 108 152, 108 158 L 108 184 C 108 178, 90 178, 70 184 Z" />
      <path d="M108 158 C 108 152, 126 152, 146 158 L 146 184 C 126 178, 108 178, 108 184 Z" />
      <path d="M108 158 L 108 184" />

      {/* A few text lines on the book pages */}
      <path d="M78 164 L 96 162" />
      <path d="M78 170 L 96 168" />
      <path d="M78 176 L 92 174" />
      <path d="M120 162 L 138 164" />
      <path d="M120 168 L 138 170" />
      <path d="M120 174 L 134 176" />
    </svg>
  );
}
