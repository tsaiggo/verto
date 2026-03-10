import fs from "fs/promises";
import path from "path";
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
import matter from "gray-matter";
import type { DocFrontmatter, BlogFrontmatter, TOCItem } from "@/lib/types";

const CONTENT_DIR = path.join(process.cwd(), "content");

// ---------------------------------------------------------------------------
// Shared MDX compilation pipeline
// ---------------------------------------------------------------------------

export async function compileMDXContent<
  T extends DocFrontmatter | BlogFrontmatter,
>(source: string): Promise<{ content: React.ReactElement; frontmatter: T }> {
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
// Single-doc fetching
// ---------------------------------------------------------------------------

export const getDocBySlug = cache(async (slug: string[]): Promise<{
  content: React.ReactElement;
  frontmatter: DocFrontmatter;
  toc: TOCItem[];
}> => {
  const filePath = path.join(CONTENT_DIR, "docs", ...slug) + ".mdx";
  const source = await fs.readFile(filePath, "utf-8");
  const { content, frontmatter } =
    await compileMDXContent<DocFrontmatter>(source);
  const toc = extractTOC(source);
  return { content, frontmatter, toc };
});

// ---------------------------------------------------------------------------
// Single-blog fetching
// ---------------------------------------------------------------------------

export const getBlogBySlug = cache(async (slug: string): Promise<{
  content: React.ReactElement;
  frontmatter: BlogFrontmatter;
  toc: TOCItem[];
}> => {
  const filePath = path.join(CONTENT_DIR, "blog", slug) + ".mdx";
  const source = await fs.readFile(filePath, "utf-8");
  const { content, frontmatter } =
    await compileMDXContent<BlogFrontmatter>(source);
  const toc = extractTOC(source);
  return { content, frontmatter, toc };
});

// ---------------------------------------------------------------------------
// All blog posts (frontmatter only, sorted by date descending)
// ---------------------------------------------------------------------------

export async function getAllBlogPosts(): Promise<
  (BlogFrontmatter & { slug: string })[]
> {
  const blogDir = path.join(CONTENT_DIR, "blog");
  const entries = await fs.readdir(blogDir);
  const mdxFiles = entries.filter((f) => f.endsWith(".mdx"));

  const posts = await Promise.all(
    mdxFiles.map(async (file) => {
      const raw = await fs.readFile(path.join(blogDir, file), "utf-8");
      const frontmatter = matter(raw).data as BlogFrontmatter;
      const slug = file.replace(/\.mdx$/, "");
      return { ...frontmatter, slug };
    })
  );

  // Sort by date descending
  posts.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return db - da;
  });

  return posts;
}

// ---------------------------------------------------------------------------
// Slug enumeration (for generateStaticParams)
// ---------------------------------------------------------------------------

/**
 * Recursively collect all `.mdx` file paths relative to `dir`.
 */
async function collectMdxFiles(dir: string, base: string = ""): Promise<string[][]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[][] = [];

  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const nested = await collectMdxFiles(path.join(dir, entry.name), rel);
      results.push(...nested);
    } else if (entry.name.endsWith(".mdx")) {
      // Strip .mdx extension and split into slug segments
      const slug = rel.replace(/\.mdx$/, "").split("/");
      results.push(slug);
    }
  }

  return results;
}

export async function getAllDocSlugs(): Promise<string[][]> {
  const docsDir = path.join(CONTENT_DIR, "docs");
  return collectMdxFiles(docsDir);
}

export async function getAllBlogSlugs(): Promise<string[]> {
  const blogDir = path.join(CONTENT_DIR, "blog");
  const entries = await fs.readdir(blogDir);
  return entries
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => f.replace(/\.mdx$/, ""));
}
