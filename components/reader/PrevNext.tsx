import Link from "next/link";
import type { ContentFileNode } from "@/lib/content-source";

interface PrevNextProps {
  prev: ContentFileNode | null;
  next: ContentFileNode | null;
}

/**
 * Footer navigation linking to the previous and next documents in reading
 * order (depth-first traversal of the content tree).
 */
export default function PrevNext({ prev, next }: PrevNextProps) {
  if (!prev && !next) return null;
  return (
    <nav
      aria-label="Document navigation"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        marginTop: 48,
        paddingTop: 24,
        borderTop: "1px solid var(--border)",
      }}
    >
      <div>
        {prev && (
          <Link
            href={prev.href}
            className="block rounded-lg border border-border no-underline transition-colors hover:bg-bg-muted"
            style={{ padding: "12px 16px", borderRadius: "var(--radius)" }}
          >
            <div
              className="text-text-muted"
              style={{ fontSize: 12, marginBottom: 4 }}
            >
              ← Previous
            </div>
            <div
              className="text-text"
              style={{ fontSize: 14, fontWeight: 500 }}
            >
              {prev.title}
            </div>
          </Link>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        {next && (
          <Link
            href={next.href}
            className="block rounded-lg border border-border no-underline transition-colors hover:bg-bg-muted"
            style={{ padding: "12px 16px", borderRadius: "var(--radius)" }}
          >
            <div
              className="text-text-muted"
              style={{ fontSize: 12, marginBottom: 4 }}
            >
              Next →
            </div>
            <div
              className="text-text"
              style={{ fontSize: 14, fontWeight: 500 }}
            >
              {next.title}
            </div>
          </Link>
        )}
      </div>
    </nav>
  );
}
