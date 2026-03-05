/**
 * DiagramPlaceholder — dashed border box for diagrams not yet embedded.
 * Mirrors `.excalidraw-placeholder` pattern from the prototype.
 */
export default function DiagramPlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="excalidraw-placeholder">
      {/* Diagram icon */}
      <span className="excalidraw-placeholder-icon" aria-hidden="true">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M17.5 14v7" />
          <path d="M14 17.5h7" />
        </svg>
      </span>
      <h4>{title}</h4>
      {description && <p>{description}</p>}
    </div>
  );
}
