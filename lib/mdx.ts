import React, { cache } from "react";
import { compileMDX } from "next-mdx-remote/rsc";
import type { Pluggable, PluggableList } from "unified";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Options as RemarkRehypeOptions } from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import remarkInlineComments from "@/lib/plugins/remark-inline-comments";
import rehypeInlineComments from "@/lib/plugins/rehype-inline-comments";
import rehypeMermaid from "@/lib/plugins/rehype-mermaid";
import rehypeExcalidraw from "@/lib/plugins/rehype-excalidraw";
import rehypeD2 from "@/lib/plugins/rehype-d2";
import { getRehypeShikiPlugin } from "@/lib/shiki";
import { extractTOC } from "@/lib/toc";
import { mdxComponents } from "@/mdx-components";
import { getFileBySlug, readFileNodeSource } from "@/lib/content-source";
import { estimateReadingTime } from "@/lib/reading-time";
import type { TOCItem } from "@/lib/types";
import type { ContentFileNode } from "@/lib/content-source";

// ---------------------------------------------------------------------------
// Shared MDX compilation pipeline
//
// Used for both `.md` and `.mdx` files. Plain `.md` needs markdown format so
// CommonMark-only syntax like HTML comments or literal braces is not parsed as
// MDX JSX / expressions. Frontmatter is parsed into the returned object (or
// `{}` when absent).
// ---------------------------------------------------------------------------

export type ContentFormat = "md" | "mdx";

export interface CompileMDXContentOptions {
  format?: ContentFormat;
}

function formatFromExtension(ext: string): ContentFormat {
  return ext.toLowerCase() === ".md" ? "md" : "mdx";
}

export async function compileMDXContent<T extends Record<string, unknown>>(
  source: string,
  options: CompileMDXContentOptions = {},
): Promise<{ content: React.ReactElement; frontmatter: T }> {
  const rehypeShiki = await getRehypeShikiPlugin();
  const format = options.format ?? "mdx";
  const rawHtmlPlugin: Pluggable = [
    rehypeRaw,
    { passThrough: ["inlineCommentRef", "inlineCommentDef"] },
  ];
  const remarkRehypeOptions: RemarkRehypeOptions = {
    allowDangerousHtml: format === "md",
    passThrough: ["inlineCommentRef", "inlineCommentDef"],
  };
  const rehypePlugins: PluggableList = [
    ...(format === "md" ? [rawHtmlPlugin] : []),
    rehypeSlug,
    [rehypeAutolinkHeadings, { behavior: "wrap" }],
    rehypeInlineComments,
    // Mermaid runs *before* Shiki so ```mermaid blocks are extracted
    // out of the syntax-highlighting pipeline entirely.
    rehypeMermaid,
    // Excalidraw uses the same trick for ```excalidraw blocks.
    rehypeExcalidraw,
    // D2 uses the same trick for ```d2 blocks — keeps the WASM
    // bundle out of pages that don't use it.
    rehypeD2,
    // KaTeX runs *before* Shiki so math nodes don't get treated as code.
    // `strict: "ignore"` and `throwOnError: false` keep bad formulas
    // from crashing an entire page render.
    [
      rehypeKatex,
      { strict: "ignore", throwOnError: false, output: "html" },
    ],
    rehypeShiki,
  ];

  const { content, frontmatter } = await compileMDX<T>({
    source,
    options: {
      mdxOptions: {
        format,
        remarkPlugins: [remarkGfm, remarkMath, remarkInlineComments],
        rehypePlugins,
        remarkRehypeOptions,
      },
      parseFrontmatter: true,
    },
    components: mdxComponents,
  });

  return { content, frontmatter };
}

// ---------------------------------------------------------------------------
// Reader: load a document by slug
// ---------------------------------------------------------------------------

export interface RenderedDocument {
  node: ContentFileNode;
  content: React.ReactElement;
  toc: TOCItem[];
  readingMinutes: number;
}

/**
 * Load and render a document for the reader by URL slug. Returns `null` if
 * no readable file exists at that slug (the route should call `notFound()`).
 */
export const getDocumentBySlug = cache(
  async (slug: string[]): Promise<RenderedDocument | null> => {
    const node = await getFileBySlug(slug);
    if (!node) return null;
    const source = await readFileNodeSource(node);
    const { content } = await compileMDXContent<Record<string, unknown>>(
      source,
      { format: formatFromExtension(node.ext) },
    );
    // Honor frontmatter `toc: false | { minDepth, maxDepth }` to control TOC.
    let toc: TOCItem[] = [];
    if (node.toc !== false) {
      toc = extractTOC(
        source,
        typeof node.toc === "object" && node.toc !== null ? node.toc : undefined,
      );
    }
    return { node, content, toc, readingMinutes: estimateReadingTime(source) };
  },
);
