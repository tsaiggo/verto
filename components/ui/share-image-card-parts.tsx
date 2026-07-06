import { siteConfig } from "@/lib/site";

export function ShareImageQuote({ text, fontStack }: { text: string; fontStack: string }) {
  return (
    <div
      style={{
        position: "relative",
        borderLeft: "4px solid #667eea",
        paddingLeft: 20,
        marginBottom: 20,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -8,
          left: 8,
          fontSize: 48,
          lineHeight: 1,
          color: "#2563eb",
          fontFamily: "Georgia, serif",
          opacity: 0.25,
          pointerEvents: "none",
          userSelect: "none",
        }}
        aria-hidden="true"
      >
        {"\u201C"}
      </span>

      <div
        style={{
          fontSize: 16,
          color: "#374151",
          lineHeight: 1.65,
          fontStyle: "italic",
          fontFamily: fontStack,
        }}
      >
        {text}
      </div>
    </div>
  );
}

export function ShareImageTags({ tags, fontStack }: { tags: string[]; fontStack: string }) {
  if (tags.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        marginBottom: 16,
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            fontSize: 11,
            padding: "2px 8px",
            background: "#f3f4f6",
            color: "#6b7280",
            borderRadius: 9999,
            fontFamily: fontStack,
            marginRight: 6,
            marginBottom: 6,
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function ShareImageFooter({ blogUrl, fontStack }: { blogUrl: string; fontStack: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTop: "1px solid #e5e7eb",
        paddingTop: 14,
        marginTop: 4,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#9ca3af",
          fontFamily: fontStack,
          overflow: "hidden",
          whiteSpace: "nowrap",
          maxWidth: "65%",
        }}
      >
        {blogUrl}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox={siteConfig.logo.viewBox}
          fill="#9ca3af"
          style={{ flexShrink: 0, marginRight: 4 }}
        >
          <path d={siteConfig.logo.svgPath} />
        </svg>
        <span
          style={{
            fontSize: 11,
            color: "#9ca3af",
            fontWeight: 500,
            fontFamily: fontStack,
          }}
        >
          {siteConfig.name}
        </span>
      </div>
    </div>
  );
}