import fs from "fs/promises";
import path from "path";
import React from "react";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import remarkInlineComments from "@/lib/plugins/remark-inline-comments";
import rehypeInlineComments from "@/lib/plugins/rehype-inline-comments";
import { getRehypeShikiPlugin } from "@/lib/shiki";
import { extractTOC } from "@/lib/toc";
import { mdxComponents } from "@/mdx-components";
import type { DocFrontmatter, BlogFrontmatter, TOCItem } from "@/lib/types";

const CONTENT_DIR = path.join(process.cwd(), "content");

// ---------------------------------------------------------------------------
// Single-doc fetching
// ---------------------------------------------------------------------------

export async function getDocBySlug(slug: string[]): Promise<{
  content: React.ReactElement;
  frontmatter: DocFrontmatter;
  toc: TOCItem[];
}> {
  const filePath = path.join(CONTENT_DIR, "docs", ...slug) + ".mdx";
  const source = await fs.readFile(filePath, "utf-8");

  const rehypeShiki = await getRehypeShikiPlugin();

  const { content, frontmatter } = await compileMDX<DocFrontmatter>({
    source,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm, remarkInlineComments],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
          rehypeInlineComments,
          // Type assertion: rehypeShikiFromHighlighter returns Transformer<Root,Root> but compileMDX expects Pluggable; ecosystem type mismatch
          rehypeShiki as any,
        ],
        remarkRehypeOptions: {
          passThrough: ["inlineCommentRef", "inlineCommentDef"] as never[],
        },
      },
      parseFrontmatter: true,
    },
    components: mdxComponents,
  });

  const toc = extractTOC(source);

  return { content, frontmatter, toc };
}

// ---------------------------------------------------------------------------
// Single-blog fetching
// ---------------------------------------------------------------------------

export async function getBlogBySlug(slug: string): Promise<{
  content: React.ReactElement;
  frontmatter: BlogFrontmatter;
  toc: TOCItem[];
}> {
  const filePath = path.join(CONTENT_DIR, "blog", slug) + ".mdx";
  const source = await fs.readFile(filePath, "utf-8");

  const rehypeShiki = await getRehypeShikiPlugin();

  const { content, frontmatter } = await compileMDX<BlogFrontmatter>({
    source,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm, remarkInlineComments],
        rehypePlugins: [
          rehypeSlug,
          [rehypeAutolinkHeadings, { behavior: "wrap" }],
          rehypeInlineComments,
          // Type assertion: same ecosystem type mismatch as above
          rehypeShiki as any,
        ],
        remarkRehypeOptions: {
          passThrough: ["inlineCommentRef", "inlineCommentDef"] as never[],
        },
      },
      parseFrontmatter: true,
    },
    components: mdxComponents,
  });

  const toc = extractTOC(source);

  return { content, frontmatter, toc };
}

// ---------------------------------------------------------------------------
// All blog posts (frontmatter only, sorted by date descending)
// ---------------------------------------------------------------------------

/**
 * Parse YAML frontmatter from raw MDX source without requiring `gray-matter`.
 * Extracts the block between the opening and closing `---` markers and parses
 * each `key: value` line. Handles quoted strings and basic arrays.
 */
function parseFrontmatter<T extends Record<string, unknown>>(
  raw: string
): T {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {} as T;

  const result: Record<string, unknown> = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (!kv) continue;

    const key = kv[1];
    let value: unknown = kv[2].trim();

    // Handle quoted strings
    if (
      (typeof value === "string" && value.startsWith('"') && value.endsWith('"')) ||
      (typeof value === "string" && value.startsWith("'") && value.endsWith("'"))
    ) {
      value = (value as string).slice(1, -1);
    }

    // Handle inline arrays like ["a", "b", "c"]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    }

    result[key] = value;
  }

  return result as T;
}

export async function getAllBlogPosts(): Promise<
  (BlogFrontmatter & { slug: string })[]
> {
  const blogDir = path.join(CONTENT_DIR, "blog");
  const entries = await fs.readdir(blogDir);
  const mdxFiles = entries.filter((f) => f.endsWith(".mdx"));

  const posts = await Promise.all(
    mdxFiles.map(async (file) => {
      const raw = await fs.readFile(path.join(blogDir, file), "utf-8");
      const frontmatter = parseFrontmatter(raw) as unknown as BlogFrontmatter;
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
