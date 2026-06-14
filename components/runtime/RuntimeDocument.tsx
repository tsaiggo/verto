"use client";

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
import type { Root } from "mdast";
import type { Parent } from "unist";
import { visit } from "unist-util-visit";

import {
  isExplicitRuntimeComponent,
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
    ],
    a: [...(defaultSchema.attributes?.a ?? []), ["href"], ["target"], ["rel"]],
    code: [...(defaultSchema.attributes?.code ?? []), ["className"]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className"]],
  },
};

export function RuntimeDocument({ source, format = "mdx" }: RuntimeDocumentProps) {
  if (format === "md") return <RuntimeMarkdownDocument source={source} />;
  return <RuntimeMdxDocument source={source} />;
}

function RuntimeMarkdownDocument({ source }: { source: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkFrontmatter, remarkGfm, remarkMath]}
      rehypePlugins={[
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
  const parsed = mdxProcessor.parse(source);
  const mdast = mdxProcessor.runSync(parsed) as Root;
  return (
    <SafeMdxRenderer
      markdown={source}
      mdast={mdast}
      components={runtimeComponents}
      allowClientEsmImports={false}
      onError={() => undefined}
    />
  );
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
