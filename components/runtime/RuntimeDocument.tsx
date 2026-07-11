"use client";

import { useMemo } from "react";
import GithubSlugger from "github-slugger";
import ReactMarkdown from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { SafeMdxRenderer } from "safe-mdx";
import { createMdxProcessor } from "safe-mdx/parse";
import type { Element, Root as HastRoot } from "hast";
import type { Root } from "mdast";
import type { Parent } from "unist";
import { visit } from "unist-util-visit";

import { RuntimeHeadingSluggerContext } from "@/components/runtime/runtime-heading-context";

import {
  RuntimeCodeBlock,
  isExplicitRuntimeComponent,
  runtimeCodeMetaProps,
  runtimeComponents,
} from "@/components/runtime/runtime-components";

export type RuntimeDocumentFormat = "md" | "mdx";

interface RuntimeDocumentProps {
  source: string;
  format?: RuntimeDocumentFormat;
}

const mdxProcessor = createMdxProcessor({
  remarkPlugins: [remarkMath, normalizeRuntimeMdx],
});

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "className",
      "id",
      "aria-hidden",
      "aria-label",
      "data-language",
      "dataCodeMeta",
      "dataTitle",
      "dataLineNumbers",
      "dataNoCopy",
    ],
    a: [...(defaultSchema.attributes?.a ?? []), ["href"], ["target"], ["rel"]],
    code: [...(defaultSchema.attributes?.code ?? []), ["className"]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className"]],
  },
};

export function RuntimeDocument({ source, format = "mdx" }: RuntimeDocumentProps) {
  return (
    <RuntimeHeadingSluggerContext.Provider value={new GithubSlugger()}>
      {format === "md" ? (
        <RuntimeMarkdownDocument source={source} />
      ) : (
        <RuntimeMdxDocument source={source} />
      )}
    </RuntimeHeadingSluggerContext.Provider>
  );
}
function RuntimeMarkdownDocument({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkFrontmatter, remarkGfm, remarkMath]}
      rehypePlugins={[
        rehypeRuntimeCodeMeta,
        rehypeRaw,
        [rehypeSanitize, sanitizeSchema],
        rehypeKatex,
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: "wrap" }],
      ]}
      components={runtimeComponents}
    >
      {source}
    </ReactMarkdown>
  );
}

function RuntimeMdxDocument({ source }: { source: string }) {
  // Parsing + transforming MDX is synchronous and runs on the UI thread; it is
  // also the single most expensive step when opening a document (especially in
  // WebView2 on Windows). Memoize it by `source` so re-renders that don't
  // change the document text never re-parse it.
  const mdast = useMemo(() => {
    const parsed = mdxProcessor.parse(source);
    return mdxProcessor.runSync(parsed) as Root;
  }, [source]);
  return (
    <SafeMdxRenderer
      markdown={source}
      mdast={mdast}
      components={runtimeComponents}
      renderNode={renderRuntimeNode}
      allowClientEsmImports={false}
      onError={() => undefined}
    />
  );
}

function renderRuntimeNode(node: unknown) {
  if (!isRuntimeCodeNode(node)) return undefined;
  return <RuntimeCodeBlock code={node.value} language={node.lang} meta={node.meta} />;
}

interface RuntimeCodeNode {
  type: "code";
  value: string;
  lang?: string | null;
  meta?: string | null;
}

function isRuntimeCodeNode(node: unknown): node is RuntimeCodeNode {
  if (!isRecord(node)) return false;
  return node.type === "code" && typeof node.value === "string";
}

function rehypeRuntimeCodeMeta() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "pre") return;
      const codeNode = node.children.find(
        (child): child is Element =>
          isRecord(child) && child.type === "element" && child.tagName === "code"
      );
      const data = codeNode?.data as { meta?: unknown } | undefined;
      const meta = typeof data?.meta === "string" ? data.meta : "";
      if (!meta) return;
      const metaProps = runtimeCodeMetaProps(meta);
      node.properties = {
        ...node.properties,
        dataCodeMeta: meta,
        dataTitle: metaProps["data-title"],
        dataLineNumbers: metaProps["data-line-numbers"],
        dataNoCopy: metaProps["data-no-copy"],
      };
    });
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRuntimeMdx() {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (
        node.type === "mdxTextExpression" ||
        node.type === "mdxFlowExpression" ||
        node.type === "mdxjsEsm"
      ) {
        replaceChild(parent, index, { type: "text", value: "" });
        return;
      }

      if (
        (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
        typeof node.name === "string" &&
        isUnknownComponentName(node.name)
      ) {
        node.attributes = [{ type: "mdxJsxAttribute", name: "name", value: node.name }];
        node.name = "UnknownComponent";
      }
    });
  };
}

function replaceChild(
  parent: Parent | undefined,
  index: number | undefined,
  replacement: Root["children"][number]
) {
  if (!parent || typeof index !== "number") return;
  const children = parent.children as Root["children"];
  children[index] = replacement;
}

function isUnknownComponentName(name: string) {
  if (!name || name[0] === name[0].toLowerCase()) return false;
  return !isExplicitRuntimeComponent(name);
}
