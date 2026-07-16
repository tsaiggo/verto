import { ExternalLink, Link as LinkIcon } from "lucide-react";

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
        <LinkIcon width={18} height={18} strokeWidth={2} />
      </span>

      <span className="link-card-body">
        <span className="link-card-title">{title}</span>
        {description && <span className="link-card-desc">{description}</span>}
        <span className="link-card-url">{displayUrl}</span>
      </span>

      {/* Arrow */}
      <span className="link-card-arrow" aria-hidden="true">
        <ExternalLink width={16} height={16} strokeWidth={2} />
      </span>
    </a>
  );
}
