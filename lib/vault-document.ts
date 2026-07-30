/* eslint-disable max-lines -- Keep the small frontmatter parser self-contained and browser-safe. */
import { mdxParse } from "safe-mdx/parse";

/** The portable document format written by Verto's block editor. */
export const VERTO_BLOCKS_FORMAT = "blocks-v1" as const;

/** Top-level frontmatter fields reserved by Verto-managed documents. */
export const VERTO_ID_FIELD = "verto_id" as const;
export const VERTO_FORMAT_FIELD = "verto_format" as const;

const RESERVED_FRONTMATTER_FIELDS = new Set<string>([
  "title",
  "created",
  "updated",
  VERTO_ID_FIELD,
  VERTO_FORMAT_FIELD,
]);

export type VaultDocumentDate = Date | number | string;

export interface VertoDocumentMetadata {
  /** Stable document ID. Never regenerated when an existing document is updated. */
  id: string;
  format: typeof VERTO_BLOCKS_FORMAT;
  title?: string;
  created?: string;
  updated?: string;
}

export interface CreateVaultDocumentOptions {
  /** The page title written to top-level frontmatter. */
  title: string;
  /** Markdown/MDX body, without frontmatter. */
  body?: string;
  /**
   * Supply an ID when a caller already owns one (for example during an
   * import). The default is a browser Web Crypto UUID.
   */
  id?: string;
  /** Base timestamp used for both created and updated. */
  date?: VaultDocumentDate;
  /** Override the creation timestamp while retaining date for updated. */
  created?: VaultDocumentDate;
  /** Override the update timestamp while retaining date for created. */
  updated?: VaultDocumentDate;
  /** Extra, non-Verto frontmatter to include in the newly-created document. */
  frontmatter?: Readonly<Record<string, unknown>>;
}

export interface VaultDocumentMetadataUpdate {
  /** Set the top-level title when supplied. Empty titles are valid. */
  title?: string;
  /** Set the top-level updated timestamp when supplied. */
  updated?: VaultDocumentDate;
}

export interface VaultDocumentMetadataUpdateResult {
  /** Original source for a no-op; rewritten source for a recognized Verto document. */
  source: string;
  /** Whether frontmatter values actually changed. */
  changed: boolean;
  /** Present only for a recognized Verto blocks-v1 document. */
  metadata?: VertoDocumentMetadata;
}

/** Reasons that require the source editor rather than the visual block editor. */
export type MdxBlockSupportIssueKind =
  | "import"
  | "export"
  | "jsx-component"
  | "jsx-expression"
  | "parse-error";

export interface MdxBlockSupportIssue {
  kind: MdxBlockSupportIssueKind;
  message: string;
  line?: number;
  column?: number;
}

export interface MdxBlockSupport {
  /** True when the source contains only portable Markdown/block syntax. */
  blockEditable: boolean;
  /** Convenience inverse for UI code deciding whether to open source mode. */
  sourceOnly: boolean;
  issues: readonly MdxBlockSupportIssue[];
}

/**
 * Create a portable MDX document for Verto's visual block editor.
 *
 * Verto identity/version data lives in explicitly-named top-level fields so
 * other Markdown tools can inspect or ignore it without a private database.
 */
export function createVaultDocument(options: CreateVaultDocumentOptions): string {
  assertString(options.title, "title");
  if (options.body !== undefined) assertString(options.body, "body");

  const date = options.date ?? new Date();
  const created = toIsoTimestamp(options.created ?? date, "created");
  const updated = toIsoTimestamp(options.updated ?? date, "updated");
  const id = normalizeId(options.id ?? createVaultDocumentId());

  const lines = [
    "---",
    "title: " + yamlString(options.title),
    VERTO_ID_FIELD + ": " + yamlString(id),
    VERTO_FORMAT_FIELD + ": " + yamlString(VERTO_BLOCKS_FORMAT),
    "created: " + yamlString(created),
    "updated: " + yamlString(updated),
  ];

  for (const [key, value] of Object.entries(options.frontmatter ?? {})) {
    if (!RESERVED_FRONTMATTER_FIELDS.has(key)) lines.push(yamlEntry(key, value));
  }

  const body = options.body ?? "";
  return lines.join("\n") + "\n---\n" + (body ? ensureTrailingNewline(body) : "\n");
}

/**
 * Return Verto metadata for a blocks-v1 document, or null for a legacy note.
 * Legacy files are only inspected; they are never implicitly upgraded.
 */
export function readVertoDocumentMetadata(source: string): VertoDocumentMetadata | null {
  const parsed = parseFrontmatter(source);
  return parsed ? metadataFromFrontmatter(parsed) : null;
}

/**
 * Update Verto-owned title/updated fields without reserializing unrelated
 * YAML. That keeps unknown properties, comments, ordering, line endings, and
 * the document body intact. Legacy and unsafe frontmatter are exact no-ops.
 */
export function updateVaultDocumentMetadata(
  source: string,
  update: VaultDocumentMetadataUpdate
): VaultDocumentMetadataUpdateResult {
  if (update.title !== undefined) assertString(update.title, "title");

  const parsed = parseFrontmatter(source);
  const metadata = parsed ? metadataFromFrontmatter(parsed) : null;
  if (!parsed || !metadata) return { source, changed: false };

  const nextTitle = update.title ?? metadata.title;
  const nextUpdated =
    update.updated === undefined ? metadata.updated : toIsoTimestamp(update.updated, "updated");
  const titleChanged = nextTitle !== metadata.title;
  const updatedChanged = nextUpdated !== metadata.updated;
  if (!titleChanged && !updatedChanged) return { source, changed: false, metadata };

  const nextSource = rewriteFrontmatter(source, parsed, {
    ...(titleChanged && nextTitle !== undefined ? { title: nextTitle } : {}),
    ...(updatedChanged && nextUpdated !== undefined ? { updated: nextUpdated } : {}),
  });
  if (nextSource === null) return { source, changed: false, metadata };

  const nextMetadata = readVertoDocumentMetadata(nextSource);
  if (!nextMetadata) return { source, changed: false, metadata };
  return { source: nextSource, changed: true, metadata: nextMetadata };
}

/**
 * Parse MDX structurally and report syntax the block editor must not rewrite.
 * Examples inside fenced/inline code remain editable because the MDX parser
 * represents them as ordinary code nodes rather than MDX nodes.
 */
export function inspectMdxBlockSupport(source: string): MdxBlockSupport {
  try {
    const root = mdxParse(source) as unknown;
    const issues: MdxBlockSupportIssue[] = [];
    walkMdx(root, (node) => collectMdxIssues(node, issues));
    return { blockEditable: issues.length === 0, sourceOnly: issues.length > 0, issues };
  } catch (error) {
    const position = errorPosition(error);
    return {
      blockEditable: false,
      sourceOnly: true,
      issues: [{ kind: "parse-error", message: errorMessage(error), ...position }],
    };
  }
}

/**
 * SHA-256 of the exact UTF-8 source, represented as lower-case hexadecimal.
 * It uses Web Crypto only, so it runs in browsers, Tauri WebView, and modern
 * Node without importing a Node-only crypto module.
 */
export async function contentRevision(source: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto SHA-256 is unavailable in this runtime.");

  const bytes = new TextEncoder().encode(source);
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Generate a UUID v4 without relying on a Node-only runtime API. */
export function createVaultDocumentId(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  if (typeof crypto?.getRandomValues !== "function") {
    throw new Error("Web Crypto random UUID generation is unavailable in this runtime.");
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20)
  );
}

interface ParsedFrontmatter {
  headerStart: number;
  closingStart: number;
  header: string;
  newline: string;
  fields: ReadonlyMap<string, ParsedFrontmatterField>;
  unsafe: boolean;
}

interface ParsedFrontmatterField {
  key: string;
  value: string;
  start: number;
  end: number;
  simple: boolean;
}

interface SourceLine {
  text: string;
  start: number;
  end: number;
}

interface MdxNode {
  type?: unknown;
  value?: unknown;
  name?: unknown;
  attributes?: unknown;
  children?: unknown;
  position?: unknown;
  data?: unknown;
}

function parseFrontmatter(source: string): ParsedFrontmatter | null {
  const headerStart = frontmatterHeaderEnd(source);
  if (headerStart === null) return null;

  const closingStart = frontmatterClosingStart(source, headerStart);
  if (closingStart === null) return null;

  const header = source.slice(headerStart, closingStart);
  const lines = splitLines(header);
  const fields = new Map<string, ParsedFrontmatterField>();
  let unsafe = !hasBalancedYamlSyntax(header);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || /^[ \t]/.test(line.text)) continue;
    const entry = parseRootYamlEntry(line.text);
    if (!entry || !RESERVED_FRONTMATTER_FIELDS.has(entry.key)) continue;
    if (fields.has(entry.key)) {
      unsafe = true;
      continue;
    }
    const nextLine = lines[index + 1];
    const simple = !nextLine || !/^[ \t]+[^\r\n]*\S/.test(nextLine.text);
    fields.set(entry.key, {
      key: entry.key,
      value: entry.value,
      start: line.start,
      end: line.end,
      simple,
    });
  }

  return {
    headerStart,
    closingStart,
    header,
    newline: source.includes("\r\n") ? "\r\n" : "\n",
    fields,
    unsafe,
  };
}

function frontmatterHeaderEnd(source: string): number | null {
  const line = firstSourceLine(source);
  if (!line || !/^(?:\uFEFF)?---[ \t]*$/.test(line.text)) return null;
  return line.end;
}

function firstSourceLine(source: string): SourceLine | null {
  const lines = splitLines(source);
  return lines[0] ?? null;
}

function frontmatterClosingStart(source: string, start: number): number | null {
  const lines = splitLines(source.slice(start));
  for (const line of lines) {
    if (/^(?:---|\.\.\.)[ \t]*$/.test(line.text)) return start + line.start;
  }
  return null;
}

function splitLines(source: string): SourceLine[] {
  if (!source) return [];
  const lines: SourceLine[] = [];
  let start = 0;
  while (start < source.length) {
    const newline = source.indexOf("\n", start);
    if (newline < 0) {
      lines.push({ text: stripCarriageReturn(source.slice(start)), start, end: source.length });
      break;
    }
    lines.push({
      text: stripCarriageReturn(source.slice(start, newline)),
      start,
      end: newline + 1,
    });
    start = newline + 1;
  }
  return lines;
}

function stripCarriageReturn(value: string): string {
  return value.endsWith("\r") ? value.slice(0, -1) : value;
}

function parseRootYamlEntry(line: string): { key: string; value: string } | null {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*|"[^"]*"|'[^']*')[ \t]*:[ \t]*(.*)$/);
  if (!match) return null;
  const key = yamlKeyValue(match[1] ?? "");
  return key === null ? null : { key, value: match[2] ?? "" };
}

function yamlKeyValue(value: string): string | null {
  if (value.startsWith('"')) {
    try {
      const decoded = JSON.parse(value);
      return typeof decoded === "string" ? decoded : null;
    } catch {
      return null;
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

function metadataFromFrontmatter(parsed: ParsedFrontmatter): VertoDocumentMetadata | null {
  if (parsed.unsafe) return null;
  const format = stringField(parsed.fields.get(VERTO_FORMAT_FIELD));
  const id = stringField(parsed.fields.get(VERTO_ID_FIELD));
  if (format !== VERTO_BLOCKS_FORMAT || !id) return null;

  return {
    id,
    format: VERTO_BLOCKS_FORMAT,
    title: stringField(parsed.fields.get("title")),
    created: stringField(parsed.fields.get("created")),
    updated: stringField(parsed.fields.get("updated")),
  };
}

function stringField(field: ParsedFrontmatterField | undefined): string | undefined {
  if (!field || !field.simple) return undefined;
  return yamlStringValue(field.value);
}

function yamlStringValue(value: string): string | undefined {
  const raw = stripYamlComment(value).trim();
  if (!raw || raw === "~" || raw === "null" || raw === "true" || raw === "false") return undefined;
  if (raw.startsWith('"')) {
    try {
      const decoded = JSON.parse(raw);
      return typeof decoded === "string" ? decoded : undefined;
    } catch {
      return undefined;
    }
  }
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  if (/^[\[{\]|>&*!]/.test(raw)) return undefined;
  return raw;
}

function stripYamlComment(value: string): string {
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote === '"') {
      if (char === "\\") index += 1;
      else if (char === '"') quote = null;
      continue;
    }
    if (quote === "'") {
      if (char === "'" && value[index + 1] === "'") index += 1;
      else if (char === "'") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "#" && (index === 0 || /\s/.test(value[index - 1] ?? ""))) {
      return value.slice(0, index);
    }
  }
  return value;
}

// eslint-disable-next-line complexity -- Quote/comment state makes a compact scanner safer than regex.
function hasBalancedYamlSyntax(source: string): boolean {
  const expected: string[] = [];
  let quote: '"' | "'" | null = null;
  let comment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? "";
    if (comment) {
      if (char === "\n") comment = false;
      continue;
    }
    if (quote === '"') {
      if (char === "\\") index += 1;
      else if (char === '"') quote = null;
      continue;
    }
    if (quote === "'") {
      if (char === "'" && source[index + 1] === "'") index += 1;
      else if (char === "'") quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "#" && (index === 0 || /\s/.test(source[index - 1] ?? ""))) {
      comment = true;
      continue;
    }
    if (char === "[") expected.push("]");
    else if (char === "{") expected.push("}");
    else if ((char === "]" || char === "}") && expected.pop() !== char) return false;
  }

  return quote === null && expected.length === 0;
}

function rewriteFrontmatter(
  source: string,
  parsed: ParsedFrontmatter,
  values: Readonly<Partial<Record<"title" | "updated", string>>>
): string | null {
  let header = parsed.header;
  const replacements: Array<{ start: number; end: number; value: string }> = [];
  const additions: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    const field = parsed.fields.get(key);
    if (!field) {
      additions.push(key + ": " + yamlString(value));
      continue;
    }
    if (!field.simple) return null;
    const previous = header.slice(field.start, field.end);
    const ending = previous.endsWith("\r\n")
      ? "\r\n"
      : previous.endsWith("\n")
        ? "\n"
        : parsed.newline;
    replacements.push({
      start: field.start,
      end: field.end,
      value: key + ": " + yamlString(value) + ending,
    });
  }

  replacements.sort((left, right) => right.start - left.start);
  for (const replacement of replacements) {
    header = header.slice(0, replacement.start) + replacement.value + header.slice(replacement.end);
  }

  if (additions.length > 0) {
    if (header && !header.endsWith("\n") && !header.endsWith("\r")) header += parsed.newline;
    header += additions.map((line) => line + parsed.newline).join("");
  }

  return source.slice(0, parsed.headerStart) + header + source.slice(parsed.closingStart);
}

function yamlEntry(key: string, value: unknown): string {
  return yamlKey(key) + ": " + yamlValue(value);
}

function yamlKey(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : yamlString(key);
}

function yamlValue(value: unknown): string {
  if (typeof value === "string") return yamlString(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("frontmatter numbers must be finite.");
    return String(value);
  }
  if (value === null) return "null";
  if (value instanceof Date) return yamlString(toIsoTimestamp(value, "frontmatter date"));
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError("frontmatter values must be JSON-compatible.");
  }
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined)
      throw new TypeError("frontmatter values must be JSON-compatible.");
    return serialized;
  } catch {
    throw new TypeError("frontmatter values must be JSON-compatible.");
  }
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : value + "\n";
}

function walkMdx(value: unknown, visit: (node: MdxNode) => void): void {
  if (!isRecord(value)) return;
  const node = value as MdxNode;
  visit(node);
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) walkMdx(child, visit);
}

function collectMdxIssues(node: MdxNode, issues: MdxBlockSupportIssue[]): void {
  const type = node.type;
  if (type === "mdxjsEsm") {
    const statementTypes = esmStatementTypes(node.data);
    if (statementTypes.has("ImportDeclaration")) {
      issues.push(issue("import", "MDX imports require source mode.", node));
    }
    if (
      statementTypes.has("ExportNamedDeclaration") ||
      statementTypes.has("ExportDefaultDeclaration") ||
      statementTypes.has("ExportAllDeclaration")
    ) {
      issues.push(issue("export", "MDX exports require source mode.", node));
    }
    return;
  }

  if (type === "mdxFlowExpression" || type === "mdxTextExpression") {
    issues.push(issue("jsx-expression", "MDX expressions require source mode.", node));
    return;
  }

  if (type !== "mdxJsxFlowElement" && type !== "mdxJsxTextElement") return;

  if (isMdxComponentName(node.name)) {
    issues.push(issue("jsx-component", "MDX JSX components require source mode.", node));
  }

  if (hasJsxExpressionAttribute(node.attributes)) {
    issues.push(issue("jsx-expression", "MDX JSX expressions require source mode.", node));
  }
}

function esmStatementTypes(data: unknown): Set<string> {
  if (!isRecord(data) || !isRecord(data.estree) || !Array.isArray(data.estree.body))
    return new Set();
  return new Set(
    data.estree.body.flatMap((statement) =>
      isRecord(statement) && typeof statement.type === "string" ? [statement.type] : []
    )
  );
}

function isMdxComponentName(name: unknown): boolean {
  // MDX fragments have no name. Member expressions and namespaces are
  // component-like too, even when their first segment is lower case.
  return (
    typeof name !== "string" || /^[A-Z]/.test(name) || name.includes(".") || name.includes(":")
  );
}

function hasJsxExpressionAttribute(attributes: unknown): boolean {
  if (!Array.isArray(attributes)) return false;
  return attributes.some((attribute) => {
    if (!isRecord(attribute)) return false;
    if (attribute.type === "mdxJsxExpressionAttribute") return true;
    return isRecord(attribute.value) && attribute.value.type === "mdxJsxAttributeValueExpression";
  });
}

function issue(
  kind: MdxBlockSupportIssueKind,
  message: string,
  node: MdxNode
): MdxBlockSupportIssue {
  return { kind, message, ...nodePosition(node.position) };
}

function nodePosition(value: unknown): Pick<MdxBlockSupportIssue, "line" | "column"> {
  if (!isRecord(value) || !isRecord(value.start)) return {};
  const line = typeof value.start.line === "number" ? value.start.line : undefined;
  const column = typeof value.start.column === "number" ? value.start.column : undefined;
  return { ...(line === undefined ? {} : { line }), ...(column === undefined ? {} : { column }) };
}

function errorPosition(error: unknown): Pick<MdxBlockSupportIssue, "line" | "column"> {
  if (!isRecord(error)) return {};
  const line = typeof error.line === "number" ? error.line : undefined;
  const column = typeof error.column === "number" ? error.column : undefined;
  return { ...(line === undefined ? {} : { line }), ...(column === undefined ? {} : { column }) };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "This MDX document could not be parsed by the block editor.";
}

function normalizeId(value: string): string {
  const id = value.trim();
  if (!id) throw new TypeError("id must be a non-empty string.");
  return id;
}

function toIsoTimestamp(value: VaultDocumentDate, field: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) throw new TypeError(field + " must be a valid date.");
  return date.toISOString();
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string") throw new TypeError(field + " must be a string.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
