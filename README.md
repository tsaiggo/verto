# Verto — Write. Transform. Publish.

Verto is a hybrid documentation site and blog built with Next.js 15 App Router. It combines Mintlify-style sidebar navigation, an OpenAI Blog-like reading experience, and Notion-style block components into a single, cohesive platform. Its key differentiator is a custom inline comments system that transforms footnote syntax into highlighted text with floating popovers.

Content lives as MDX files. You write in Markdown, sprinkle in rich block components, and Verto handles the rest: syntax highlighting, table of contents, dark mode, SEO metadata, and static generation at build time.

## Features

- **Docs + Blog hybrid** — documentation with three-column layout (sidebar, content, table of contents) and a blog with magazine-style reading experience, all in one site
- **Inline comments system** — `[^c-N]` footnote syntax renders as highlighted text with click-to-reveal popovers, degrades gracefully to standard footnotes on GitHub
- **10+ block components** — Callouts, Toggles, Bookmark Cards, Figures, Task Lists, Tables, Diagram Placeholders, styled Blockquotes, and more
- **MDX authoring** — write content in Markdown with JSX components, powered by next-mdx-remote
- **Shiki syntax highlighting** — VS Code-accurate highlighting with dual light/dark themes, rendered at build time with zero client JS
- **Dark mode** — CSS variable theming with no-flash script, persisted to localStorage, respects system preference
- **Responsive layout** — mobile-friendly with collapsible sidebar and hamburger menu
- **SEO-ready** — static generation with per-page metadata via frontmatter

## Quick Start

```bash
npm install
npm run dev    # http://localhost:3000
```

Available scripts:

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (static generation) |
| `npm start` | Serve production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
verto/
├── app/                       # Next.js App Router pages
│   ├── globals.css            # CSS design system + Tailwind v4
│   ├── layout.tsx             # Root layout with Navbar, Footer, dark mode
│   ├── page.tsx               # Homepage
│   ├── not-found.tsx          # 404 page
│   ├── docs/                  # Documentation routes
│   │   ├── layout.tsx         # 3-column layout (sidebar + content + ToC)
│   │   └── [[...slug]]/page.tsx
│   └── blog/                  # Blog routes
│       ├── page.tsx           # Blog listing
│       └── [slug]/page.tsx    # Blog post
├── components/
│   ├── layout/                # Navbar, Footer, Sidebar, TableOfContents
│   ├── mdx/                   # Block components + InlineComment system
│   └── ui/                    # ThemeToggle, MobileMenu
├── content/
│   ├── navigation.json        # Sidebar navigation config
│   ├── docs/                  # Documentation MDX files
│   └── blog/                  # Blog MDX files
├── lib/
│   ├── mdx.ts                 # MDX compilation pipeline
│   ├── shiki.ts               # Syntax highlighting (Shiki fine-grained bundle)
│   ├── toc.ts                 # Table of contents extraction
│   ├── navigation.ts          # Navigation utilities
│   ├── types.ts               # TypeScript interfaces
│   └── plugins/               # Custom remark/rehype plugins
│       ├── remark-inline-comments.ts
│       └── rehype-inline-comments.ts
└── mdx-components.tsx         # MDX component mapping
```

## Adding Content

### Adding a docs page

1. Create an MDX file in `content/docs/`. Nest it in a subfolder to match your navigation groups:

```
content/docs/getting-started/my-new-page.mdx
```

2. Add frontmatter at the top of the file:

```mdx
---
title: My New Page
description: A brief description for SEO and page metadata.
order: 3
---

Your content here...
```

The `order` field controls the sort position within its navigation group.

3. Register the page in `content/navigation.json`:

```json
{
  "docs": [
    {
      "group": "Getting Started",
      "items": [
        { "title": "Introduction", "href": "/docs/getting-started/introduction" },
        { "title": "My New Page", "href": "/docs/getting-started/my-new-page" }
      ]
    }
  ]
}
```

Each group becomes a collapsible section in the sidebar. The `href` must match the file path under `content/docs/`.

### Adding a blog post

Create an MDX file in `content/blog/`:

```
content/blog/my-post-slug.mdx
```

Add the required frontmatter:

```mdx
---
title: My Blog Post
description: What this post is about.
date: "2026-03-06"
author: Your Name
tags: ["next.js", "mdx"]
---

Your content here...
```

The file name becomes the URL slug (`/blog/my-post-slug`). Posts are sorted by `date` descending on the blog listing page.

### Using inline comments

Inline comments are Verto's signature feature. They use Markdown footnote syntax with a `c-` prefix:

```mdx
This feature took significant effort[^c-1] to build correctly.

Regular footnotes[^1] still work as expected.

[^c-1]: Three days of debugging SSR edge cases, but worth it.
[^1]: See the official documentation for details.
```

In Verto, `[^c-1]` renders as highlighted text with a clickable popover that reveals the comment. On GitHub, Typora, or any other Markdown renderer, it degrades to a standard footnote at the bottom of the page. No content is lost either way.

The syntax rules:

- `[^c-N]` (with `c-` prefix) becomes an inline comment
- `[^N]` (without prefix) stays a regular footnote
- Definitions go at the bottom of the file: `[^c-N]: Your comment text`

## Block Components

Use these components directly in your MDX files:

### Callout

```mdx
<Callout type="info">
  Informational note for the reader.
</Callout>

<Callout type="warning">
  Something to watch out for.
</Callout>

<Callout type="tip">
  A helpful suggestion.
</Callout>
```

Supported types: `info`, `warning`, `tip`.

### Toggle

```mdx
<Toggle title="Click to expand">
  Hidden content revealed on click.
</Toggle>
```

### BookmarkCard

```mdx
<BookmarkCard
  url="https://nextjs.org"
  title="Next.js"
  description="The React Framework for the Web"
/>
```

### Figure

```mdx
<Figure
  src="/images/screenshot.png"
  alt="Screenshot of the dashboard"
  caption="The new dashboard layout"
/>
```

### DiagramPlaceholder

```mdx
<DiagramPlaceholder
  title="System Architecture"
  description="High-level overview of the data flow"
/>
```

### Task Lists

```mdx
- [x] Completed item
- [ ] Pending item
- [ ] Another pending item
```

### Tables

Standard Markdown tables:

```mdx
| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |
```

### Code Blocks

Fenced code blocks with Shiki syntax highlighting:

````mdx
```typescript
const greeting: string = "Hello, Verto";
console.log(greeting);
```
````

Supports TypeScript, JavaScript, JSX, TSX, JSON, Bash, CSS, HTML, Markdown, and MDX.

## Deployment

Verify the build passes locally before deploying:

```bash
npm run build     # Verify build passes locally
```

Deploy to Vercel by connecting your GitHub repo through the Vercel dashboard, or use the CLI:

```bash
npx vercel
```

No special configuration needed. Verto uses static generation by default, so all pages are pre-rendered at build time.

## Tech Stack

- **Next.js 15** (App Router, static generation)
- **React 19**
- **Tailwind CSS v4** (CSS-first configuration)
- **Shiki** (syntax highlighting, fine-grained bundle)
- **MDX** via next-mdx-remote
- **TypeScript**
