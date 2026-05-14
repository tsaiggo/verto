import Link from "next/link";

interface BreadcrumbProps {
  /** Slug segments from the URL (no leading "read") */
  slug: string[];
  /** Resolved title for each segment, in order */
  titles: string[];
}

/**
 * Breadcrumb trail. Segments are clickable except for the last (current
 * page). Always shows a leading "Home" link to `/`.
 */
export default function Breadcrumb({ slug, titles }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-text-muted"
      style={{ fontSize: 13, marginBottom: 16 }}
    >
      <ol
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        <li>
          <Link
            href="/"
            className="hover:text-text"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            Home
          </Link>
        </li>
        {slug.map((seg, i) => {
          const isLast = i === slug.length - 1;
          const href = "/read/" + slug.slice(0, i + 1).join("/");
          const title = titles[i] ?? seg;
          return (
            <li
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span aria-hidden style={{ opacity: 0.6 }}>
                /
              </span>
              {isLast ? (
                <span
                  aria-current="page"
                  style={{ color: "var(--text)", fontWeight: 500 }}
                >
                  {title}
                </span>
              ) : (
                <Link
                  href={href}
                  className="hover:text-text"
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {title}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
