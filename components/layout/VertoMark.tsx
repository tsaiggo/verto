interface VertoMarkProps {
  className?: string;
  size?: number;
}

/**
 * Verto wordmark glyph — a bold "V" chevron. Uses `currentColor` so it can be
 * tinted by its container (ink in light mode, near-white in dark mode).
 */
export default function VertoMark({ className, size = 22 }: VertoMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path d="M4.2 4.5h3.55L12 15.1 16.25 4.5h3.55L13.7 19.5h-3.4L4.2 4.5Z" fill="currentColor" />
    </svg>
  );
}
