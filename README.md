# Verto

Docs + blog in one. MDX content, Mintlify-style navigation, and a custom inline comments system that turns footnotes into floating popovers.

<!-- TODO: Add screenshot -->
<!-- ![Verto Preview](docs/preview.png) -->

## Why This Exists

<!-- Write your motivation here — why you built Verto, what problem it solves, what you were tired of. This is your section. Make it personal. -->

## Features

- **Docs + blog hybrid** — sidebar navigation for docs, magazine layout for blog, one codebase
- **Inline comments** — `[^c-N]` footnotes become highlighted text with click-to-reveal popovers
- **10+ block components** — Callout, Toggle, BookmarkCard, Figure, TaskList, Table, and more
- **Shiki syntax highlighting** — dual light/dark themes, rendered at build time, zero client JS
- **Dark mode** — CSS variables, no-flash script, persists preference
- **MDX authoring** — Markdown with JSX components, compiled server-side
- **Fully static** — every page pre-rendered at build time, ready for Vercel

## Getting Started

**Prerequisites**: Node.js 18.17+

```bash
git clone https://github.com/tsaiggo/verto.git
cd verto
npm install
npm run dev
```

Site runs at [localhost:3000](http://localhost:3000).

For a production build:

```bash
npm run build
npm start
```

| Command | What it does |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |

## Architecture

Content lives as `.mdx` files in `content/`. At build time, the MDX pipeline reads each file, runs it through a chain of remark and rehype plugins, and outputs React server components. No client-side compilation.

The **inline comments system** is the interesting part. A custom remark plugin walks the Markdown AST, finds `[^c-N]` footnote references, and transforms them into special `inlineCommentRef` / `inlineCommentDef` nodes. A matching rehype plugin converts those into custom HTML elements, which the MDX component map renders as highlighted text with popover UI. On GitHub or any standard Markdown renderer, the same syntax degrades to regular footnotes — no content lost.

**Code highlighting** uses Shiki v3's fine-grained bundle (`createHighlighterCore` + `rehypeShikiFromHighlighter`) with GitHub Light and GitHub Dark themes. Everything runs at build time — the output is plain HTML with inline styles, no runtime JS.

**Styling** is Tailwind CSS v4 with CSS-first configuration. Design tokens live in `@theme {}` blocks in `globals.css`. Dark mode toggles CSS custom properties.

## Project Structure

```
app/            → pages and layouts (App Router)
components/     → layout (Navbar, Sidebar, ToC) + mdx blocks + ui
content/        → MDX files for docs and blog + navigation.json
lib/            → MDX pipeline, Shiki config, remark/rehype plugins, types
```

## Content Guide

### Docs

Create `content/docs/{group}/{slug}.mdx`:

```mdx
---
title: Page Title
description: For SEO.
order: 1
---

Your content.
```

Register the page in `content/navigation.json` — each group becomes a collapsible sidebar section.

### Blog

Create `content/blog/{slug}.mdx`:

```mdx
---
title: Post Title
description: Summary.
date: "2026-03-06"
author: Name
tags: ["tag"]
---

Your content.
```

Filename = URL slug. Posts sort by date descending.

## Block Components

| Component | Description |
|-----------|-------------|
| `Callout` | Admonitions — `info`, `warning`, `tip` |
| `Toggle` | Collapsible content block |
| `BookmarkCard` | Link preview card with title + description |
| `Figure` | Image with caption |
| `DiagramPlaceholder` | Placeholder for diagrams |
| `TaskList` | Checkbox task lists |
| `Table` | Styled Markdown tables |
| `BlockquoteStyled` | Styled blockquotes |
| `CodeBlock` | Shiki-highlighted code with dual themes |
| `InlineCode` | Styled inline `code` spans |

## Inline Comments

The signature feature. Uses Markdown footnote syntax with a `c-` prefix:

```mdx
This took real effort[^c-1] to get right.

[^c-1]: Three days of SSR debugging. Worth it.
```

- `[^c-N]` → highlighted text + popover in Verto
- `[^N]` → regular footnote (still works)
- Degrades to standard footnotes on GitHub — no content lost either way

## Deployment

```bash
npx vercel
```

Static generation by default. No config needed.

## Tech Stack

- [Next.js 15](https://nextjs.org) — App Router, static generation
- [React 19](https://react.dev)
- [Tailwind CSS v4](https://tailwindcss.com) — CSS-first config
- [Shiki v3](https://shiki.style) — syntax highlighting
- [MDX](https://mdxjs.com) via next-mdx-remote
- TypeScript

## License

MIT
