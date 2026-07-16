import type React from "react";
import { Info, Lightbulb, TriangleAlert } from "lucide-react";

const icons = {
  info: Info,
  warning: TriangleAlert,
  tip: Lightbulb,
};

/** Maps MDX callout types to CSS class names from globals.css */
const typeToClass: Record<string, string> = {
  info: "info",
  warning: "warn",
  tip: "ok",
};

/** Short label shown above the body, mirroring the prototype callout header. */
const typeToLabel: Record<string, string> = {
  info: "Note",
  warning: "Warning",
  tip: "Tip",
};

export default function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}) {
  const cssClass = typeToClass[type] ?? "info";
  const label = typeToLabel[type] ?? "Note";
  const Icon = icons[type];

  return (
    <div className={`callout ${cssClass}`} role="note">
      <span className="callout-icon" aria-hidden="true">
        <Icon width={18} height={18} strokeWidth={2} />
      </span>
      <div className="callout-body">
        <div className="callout-title">{label}</div>
        {children}
      </div>
    </div>
  );
}
