import type { SVGProps } from "react";

/**
 * Hand-drawn line-art illustration of a person scratching their head,
 * looking a little lost. Used on the 404 page.
 *
 * Strokes use `currentColor`. Style inspired by Open Peeps (CC0); drawing
 * is original to this project.
 */
export default function LostPerson(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 220"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="A person scratching their head, looking confused"
      {...props}
    >
      {/* Three little question-mark sparkles floating around */}
      <path d="M40 40 C 40 34, 48 34, 48 40 C 48 44, 44 44, 44 48" />
      <circle cx="44" cy="54" r="1.2" fill="currentColor" />

      <path d="M160 60 C 160 56, 166 56, 166 60 C 166 63, 163 63, 163 66" />
      <circle cx="163" cy="71" r="1.2" fill="currentColor" />

      <path d="M168 110 C 168 107, 172 107, 172 110 C 172 112, 170 112, 170 114" />
      <circle cx="170" cy="118" r="1" fill="currentColor" />

      {/* Hair — short messy strokes */}
      <path d="M78 42 C 80 32, 92 28, 100 30 C 110 26, 124 32, 126 44" />
      <path d="M82 40 L 86 34" />
      <path d="M92 36 L 94 30" />
      <path d="M104 34 L 104 28" />
      <path d="M116 36 L 118 30" />

      {/* Head */}
      <path d="M78 60 C 76 46, 88 36, 102 36 C 118 36, 128 48, 128 62 C 128 76, 120 88, 106 90 C 90 92, 78 80, 78 64 Z" />

      {/* Ear */}
      <path d="M126 64 C 132 64, 132 74, 126 74" />

      {/* Eyes — small dots, slightly raised brow */}
      <path d="M92 56 L 96 54" />
      <circle cx="96" cy="62" r="1.6" fill="currentColor" />
      <path d="M114 54 L 118 56" />
      <circle cx="116" cy="62" r="1.6" fill="currentColor" />

      {/* Mouth — small uncertain squiggle */}
      <path d="M100 76 C 104 78, 110 74, 114 76" />

      {/* Neck */}
      <path d="M98 90 L 98 100" />
      <path d="M112 90 L 112 100" />

      {/* Right arm raised, hand scratching head */}
      <path d="M128 100 C 148 96, 158 80, 150 64" />
      <path d="M150 64 C 146 58, 138 58, 134 62" />
      {/* Fingers near the head */}
      <path d="M134 62 L 130 56" />
      <path d="M138 60 L 136 54" />
      <path d="M142 60 L 142 54" />

      {/* Shoulders / shirt */}
      <path d="M64 130 C 70 110, 86 100, 98 100" />
      <path d="M112 100 C 120 100, 124 102, 128 104" />

      {/* Left arm — hanging down */}
      <path d="M64 130 C 56 148, 54 168, 62 184" />
      <path d="M62 184 C 60 188, 64 192, 68 188" />

      {/* Body */}
      <path d="M128 104 C 142 116, 148 138, 144 168" />
      <path d="M144 168 L 70 168" />
      <path d="M70 168 C 68 174, 70 180, 74 184" />

      {/* Shirt hem hint */}
      <path d="M76 168 L 76 174" />
      <path d="M138 168 L 138 174" />

      {/* Ground — a couple of tiny pebbles */}
      <path d="M40 200 C 50 198, 70 198, 90 200" />
      <path d="M110 202 C 130 200, 150 200, 170 202" />
    </svg>
  );
}
