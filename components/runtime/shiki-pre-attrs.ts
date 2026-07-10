import type { CSSProperties } from "react";

interface ShikiPreProps {
  className?: string;
  style?: CSSProperties;
}

export function shikiPreProps(html: string): ShikiPreProps {
  const match = /^<pre\b([^>]*)>/i.exec(html.trim());
  if (!match) return {};
  const className = attributeFromHtmlTag(match[1], "class");
  const styleText = attributeFromHtmlTag(match[1], "style");
  return {
    className,
    style: styleText ? parseStyleAttribute(styleText) : undefined,
  };
}

function attributeFromHtmlTag(attributes: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attributes);
  const value = match?.[1] ?? match?.[2];
  return typeof value === "string" ? decodeHtmlAttribute(value) : undefined;
}

function parseStyleAttribute(styleText: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const declaration of styleText.split(";")) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex < 0) continue;
    const name = declaration.slice(0, separatorIndex).trim();
    const value = declaration.slice(separatorIndex + 1).trim();
    if (!name || !value) continue;
    style[cssPropertyName(name)] = value;
  }
  return style as CSSProperties;
}

function cssPropertyName(name: string): string {
  if (name.startsWith("--")) return name;
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function mergeClassNames(...values: unknown[]): string | undefined {
  const className = values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
  return className || undefined;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
