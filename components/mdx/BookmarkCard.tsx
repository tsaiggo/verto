/**
 * BookmarkCard — styled link preview card.
 * Mirrors the `.link-card` pattern from the prototype.
 */
export default function BookmarkCard({
  url,
  title,
  description,
}: {
  url: string;
  title: string;
  description?: string;
}) {
  /** Display a clean hostname from the URL */
  let displayUrl = url;
  try {
    displayUrl = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep raw url if parsing fails
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="link-card"
      style={{ display: "flex", textDecoration: "none" }}
    >
      {/* Favicon / link icon */}
      <span className="link-card-favicon" aria-hidden="true">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      </span>

      <span className="link-card-body">
        <span className="link-card-title">{title}</span>
        {description && <span className="link-card-desc">{description}</span>}
        <span className="link-card-url">{displayUrl}</span>
      </span>

      {/* Arrow */}
      <span className="link-card-arrow" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="7" y1="17" x2="17" y2="7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </span>
    </a>
  );
}
