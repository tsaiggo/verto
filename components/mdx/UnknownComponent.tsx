import type React from "react";
import { TriangleAlert } from "lucide-react";

/**
 * Fallback rendered when MDX content references an unknown JSX component.
 * The reader is built to consume *any* third-party MDX file, so we display
 * a clear placeholder rather than crashing the whole page.
 */
export default function UnknownComponent({
  name,
  children,
}: {
  name: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="note"
      style={{
        margin: "12px 0",
        padding: "10px 14px",
        border: "1px dashed var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--bg-subtle)",
        fontSize: 13,
        color: "var(--text-muted)",
      }}
    >
      <strong
        style={{
          color: "var(--text)",
          marginRight: 6,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        <TriangleAlert width={14} height={14} strokeWidth={2} aria-hidden="true" />
        <span>Unknown component:</span>
      </strong>
      <code style={{ fontFamily: "var(--font-mono)" }}>{`<${name} />`}</code>
      {children ? <div style={{ marginTop: 6, color: "var(--text)" }}>{children}</div> : null}
    </div>
  );
}
