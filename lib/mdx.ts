import fs from "fs/promises";
import React, { cache } from "react";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import remarkInlineComments from "@/lib/plugins/remark-inline-comments";
import rehypeInlineComments from "@/lib/plugins/rehype-inline-comments";
import { getRehypeShikiPlugin } from "@/lib/shiki";
import { extractTOC } from "@/lib/toc";
import { mdxComponents } from "@/mdx-components";
import { getFileBySlug } from "@/lib/content-source";
import type { TOCItem } from "@/lib/types";
import type { ContentFileNode } from "@/lib/content-source";

// ---------------------------------------------------------------------------
// Shared MDX compilation pipeline
//
// Used for both `.md` and `.mdx` files. `next-mdx-remote` happily compiles
// plain CommonMark with the same pipeline, so a single entry point is enough.
// Frontmatter is parsed into the returned object (or `{}` when absent).
// ---------------------------------------------------------------------------

export async function compileMDXContent<T extends Record<string, unknown>>(
  source: string,
): Promise<{ content: React.ReactElement; frontmatter: T }> {
  const rehypeShiki = await getRehypeShikiPlugin();

  const { content, frontmatter } = await compileMDX<T>({
    source,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm, remarkInlineComments],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
          rehypeInlineComments,
          rehypeShiki,
        ],
        remarkRehypeOptions: {
          // @ts-expect-error passThrough is valid for remark-rehype at runtime but not in the published types
          passThrough: ["inlineCommentRef", "inlineCommentDef"],
        },
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
}

/**
 * Load and render a document for the reader by URL slug. Returns `null` if
 * no readable file exists at that slug (the route should call `notFound()`).
 */
export const getDocumentBySlug = cache(
  async (slug: string[]): Promise<RenderedDocument | null> => {
    const node = await getFileBySlug(slug);
    if (!node) return null;
    const source = await fs.readFile(node.filePath, "utf-8");
    const { content } =
      await compileMDXContent<Record<string, unknown>>(source);
    const toc = extractTOC(source);
    return { node, content, toc };
  },
);
