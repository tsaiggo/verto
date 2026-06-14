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
    <nav aria-label="Document navigation" className="prevnext">
      <div>
        {prev && (
          <Link href={prev.href} className="prevnext-card">
            <div className="prevnext-label">← Previous</div>
            <div className="prevnext-title">{prev.title}</div>
          </Link>
        )}
      </div>
      <div className="prevnext-next">
        {next && (
          <Link href={next.href} className="prevnext-card">
            <div className="prevnext-label">Next →</div>
            <div className="prevnext-title">{next.title}</div>
          </Link>
        )}
      </div>
    </nav>
  );
}
