<h1 align="center">🔄 Verto</h1>

<p align="center">
  <strong>Open. Read. Comment.</strong><br>
  A reader for your Markdown and MDX library — Latin <em>vertō</em>, to turn the page.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs" alt="Next.js 16">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Tailwind%20CSS-4-06b6d4?style=flat-square&logo=tailwindcss" alt="Tailwind v4">
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?style=flat-square&logo=typescript" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square" alt="License">
</p>

---

## 🎯 What is Verto?

**Verto** is a static-first **MD / MDX reader** built on Next.js. Drop any
collection of `.md` and `.mdx` files into the `content/` directory and Verto
turns them into a navigable site: an auto-generated file-tree sidebar, a
table of contents, breadcrumbs, prev/next navigation, and inline-comment
popovers — all pre-rendered at build time.

It's a *reader*, not a CMS. Verto doesn't care whether your content is docs,
notes, blog posts, papers, or all of them at once. There is no fixed schema
and no required frontmatter; every file is treated as a document, and metadata
is filled in from sensible fallbacks when missing.

## ✨ Features

- 📁 **Auto file-tree sidebar** — recursively scans `content/`, collapsible directories, current-file highlight
- 📄 **`.md` and `.mdx` side by side** — same pipeline, same components
- 🪶 **Optional frontmatter** — title falls back to first H1 then filename; description to the first paragraph; sort by `order`, date, then title
- 🧭 **Breadcrumbs + prev/next** — derived from the file tree's reading order
- 📊 **Reading-progress bar** — thin indicator below the navbar, updates on scroll
- 🗂 **Directory index pages** — landing on a folder lists its contents (or renders `_index.md` if present)
- 💬 **Inline comments** — `[^c-N]` footnotes become highlighted text with click-to-reveal popovers → [demo](/read/docs/core-concepts/inline-comments)
- 🧩 **10+ MDX block components** — Callout, Toggle, BookmarkCard, Figure, TaskList, Table, and more
- 🛡️ **Unknown-component fallback** — third-party MDX with custom JSX won't crash; unmapped tags render as a friendly placeholder
- 🎨 **Shiki syntax highlighting** — dual light/dark themes, rendered at build time, zero client JS
- 🌓 **Dark mode** — CSS variables, no-flash script, persists preference
- ⚡ **Pre-rendered at build time** — every page statically generated, ready for Vercel
- 📱 **Responsive** — mobile-first layout with adaptive breakpoints

---

## 🚀 Quick Start

### Prerequisites

- 📦 **Node.js** 18.17 or higher

### Run Locally

```bash
git clone https://github.com/tsaiggo/verto.git
cd verto
npm install
npm run dev
```

Site runs at **http://localhost:3000**.

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest suite |

### Deployment

```bash
npx vercel
```

Static generation by default. No config needed.

---

## 📁 Project Structure

```
verto/
├── app/
│   ├── page.tsx               → Reader home (sections + recently updated)
│   ├── read/[[...path]]/      → Unified document route
│   └── layout.tsx             → Root layout (Navbar + Footer + theme script)
├── components/
│   ├── reader/                → FileTree, Breadcrumb, PrevNext, ReadingProgress, DirectoryIndex
│   ├── layout/                → Navbar, TableOfContents, Footer
│   ├── mdx/                   → Block components + UnknownComponent fallback
│   └── ui/                    → ThemeToggle, MobileMenu, selection-share helpers
├── content/                   → Drop your .md / .mdx here, any depth
│   └── navigation.json        → Optional sort / hide / rename overrides
└── lib/
    ├── content-source.ts      → File-system scan, tree builder, slug resolver
    ├── mdx.ts                 → Compile + render pipeline (Shiki, GFM, inline-comments)
    ├── plugins/               → remark/rehype-inline-comments
    ├── shiki.ts               → Lazy-loaded highlighter
    ├── toc.ts                 → Heading extraction for the right sidebar
    └── format.ts              → Date formatter
```

---

## 📝 Content Guide

### Adding a Document

Drop a `.md` or `.mdx` file anywhere under `content/`. The URL mirrors the
file path:

| File | URL |
|------|-----|
| `content/notes/quick-thought.md` | `/read/notes/quick-thought` |
| `content/blog/2026/launch.mdx` | `/read/blog/2026/launch` |
| `content/projects/_index.md` | `/read/projects` |

### Frontmatter (all fields optional)

```mdx
---
title: My Document
description: Shown in directory listings and meta tags.
date: "2026-05-14"
author: Me
tags: ["draft", "ideas"]
order: 1
hidden: false
---

Your content here.
```

When a field is omitted Verto fills it in:

| Field | Fallback |
|-------|----------|
| `title` | First `# H1` heading → humanized filename |
| `description` | First non-heading paragraph (truncated) |
| `date` | File modification time (shown as "Updated …") |
| `order` | Date → alphabetical |

### Directory Indexes

A file named `_index.md`, `index.md`, or `README.md` inside a directory
becomes that directory's landing page. Without one, Verto renders an
auto-generated index listing the directory's children.

### Optional Overrides — `content/navigation.json`

Use this file only when you want to override what the file system would do
naturally:

```json
{
  "overrides": {
    "docs": { "title": "Docs", "order": 1 },
    "drafts": { "hidden": true },
    "notes/old-name": { "title": "New Name" }
  }
}
```

Keys are slug paths relative to `content/`, without the file extension.

---

## 🧩 MDX Block Components

| Component | Description |
|-----------|-------------|
| `Callout` | Admonitions: `info`, `warning`, `tip` |
| `Toggle` | Collapsible content block |
| `BookmarkCard` | Link preview card with title + description |
| `Figure` | Image with caption |
| `DiagramPlaceholder` | Placeholder for diagrams |
| `TaskList` | Checkbox task lists |
| `Table` | Styled Markdown tables |
| `BlockquoteStyled` | Styled blockquotes |
| `CodeBlock` | Shiki-highlighted code with dual themes |
| `InlineCode` | Styled inline `code` spans |
| `UnknownComponent` | Placeholder shown when a doc references an unmapped JSX component |

---

## 💬 Inline Comments

The signature feature, repurposed for the reader: turn footnote-style
annotations into floating popovers as you read.

```mdx
This took real effort[^c-1] to get right.

[^c-1]: Three days of SSR debugging. Worth it.
```

- `[^c-N]` → highlighted text + popover in Verto
- `[^N]` → regular footnote (still works)
- Degrades to standard footnotes on GitHub — no content lost either way

---

## 🔁 Migrating from the old Verto

The previous routes — `/docs/*` and `/blog/*` — are now permanent (308)
redirects to `/read/docs/*` and `/read/blog/*`. Existing content under
`content/docs/` and `content/blog/` continues to work unchanged.

---

## 📄 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/tsaiggo">tsaiggo</a>
</p>
