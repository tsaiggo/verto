import type { LocalMdxWorkspaceFormat, LocalMdxWorkspaceMode } from "./local-mdx-workspace-types";
import { inspectMdxBlockSupport } from "@/lib/vault-document";

export function resolveInitialWorkspaceMode(
  initialMode: LocalMdxWorkspaceMode | undefined,
  editable: boolean
): LocalMdxWorkspaceMode {
  if (initialMode === "read") return "read";
  if (initialMode && editable) return initialMode;
  return editable ? "split" : "read";
}

/** Removes a YAML frontmatter block so local metadata does not become body copy in the preview. */
export function stripMdxFrontmatter(source: string): string {
  return source.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
}

/**
 * RuntimeDocument intentionally has no execution environment for imported
 * modules or standalone JavaScript expressions. Keeping those files in a
 * source fallback is safer than silently dropping meaningful content.
 */
export function unsupportedMdxReason(
  source: string,
  format: LocalMdxWorkspaceFormat
): string | null {
  if (format !== "mdx") return null;
  // Registered and unknown JSX components are rendered through
  // RuntimeDocument's safe component proxy. They remain source-only for a
  // future structural block editor, but they do not make the preview unsafe.
  const issue = inspectMdxBlockSupport(source).issues.find(
    (candidate) => candidate.kind !== "jsx-component"
  );
  if (!issue) return null;
  if (issue.kind === "import" || issue.kind === "export") {
    return "This page imports or exports JavaScript, which local preview does not execute.";
  }
  if (issue.kind === "jsx-expression") {
    return "This page includes an MDX expression, which local preview does not execute.";
  }
  return "This MDX could not be parsed safely, so local preview stays in Source mode.";
}
