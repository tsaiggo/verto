<h1 align="center">🔄 Verto</h1>

<p align="center">
  <strong>The MDX reader.</strong><br>
  Point it at a folder. Get a site. <em>Vertō</em> — to turn the page.
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

**Verto is to MDX what Obsidian is to Markdown** — a reader that treats a
folder of files as a first-class library.

Drop any collection of `.mdx` (or `.md`) files into `content/` and Verto
turns the folder into a navigable, statically-rendered site: file-tree
sidebar, table of contents, breadcrumbs, prev/next, and a rich set of
MDX block components — all pre-rendered at build time.

Verto is a **reader**, not a CMS and not an editor. There is no database, no
admin UI, no required frontmatter. Your files are the source of truth; the
file system *is* the schema. If you can write MDX in any editor — VS Code,
Obsidian, Cursor, vim — Verto can read it.

### Why MDX-first?

Markdown is a great format for plain text. MDX is what you reach for the
moment your notes want to *do* something — embed a callout, lay out a
comparison table, sketch a diagram, attach a comment, drop in an interactive
component. Verto is built around that need:

- **MDX is native.** Components are first-class; `.md` is treated as a
  strict subset that just works.
- **A built-in component library.** Callouts, Toggles, Bookmarks, Figures,
  Task Lists, code blocks with line highlighting, inline-comment popovers —
  ready out of the box, no imports required.
- **Unknown components don't crash.** Third-party MDX with custom JSX
  renders a friendly placeholder instead of throwing — paste from anywhere.
- **Static-first.** Every page is pre-rendered. Zero runtime, deploy
  anywhere.

### The Obsidian analogy

|                  | Obsidian (Markdown)            | Verto (MDX)                                  |
|------------------|--------------------------------|----------------------------------------------|
| Source of truth  | A folder (vault) of `.md`      | A folder (`content/`) of `.mdx` / `.md`      |
| Schema           | None — files and folders       | None — files and folders                     |
| Extensibility    | Plugins                        | MDX components                               |
| Reading UI       | Built-in reader pane           | Statically-rendered Next.js site             |
| Lock-in          | None — plain text on disk      | None — plain text on disk                    |
| Output           | Local app                      | A site you can host anywhere                 |

---

## ✨ Features

### MDX, rendered properly
- 🧩 **10+ built-in block components** — Callout, Toggle, BookmarkCard, Figure, TaskList, Table, BlockquoteStyled, CodeBlock, and more — no imports required
- 🎨 **Shiki syntax highlighting** — dual light/dark themes, rendered at build time, zero client JS
- 💬 **Inline comments** — `[^c-N]` footnotes become highlighted text with click-to-reveal popovers → [demo](/help/core-concepts/inline-comments)
- 🛡️ **Unknown-component fallback** — MDX from anywhere won't crash; unmapped JSX tags render as a friendly placeholder
- 📄 **`.md` works too** — same pipeline, same components, same output

### Your folder, navigable
- 📁 **Auto file-tree sidebar** — recursively scans `content/`, collapsible directories, current-file highlight
- 🪶 **Optional frontmatter** — title falls back to first H1 then filename; description to the first paragraph; sort by `order`, date, then title
- 🧭 **Breadcrumbs + prev/next** — derived from the file tree's reading order
- 🗂 **Directory index pages** — landing on a folder lists its contents (or renders `_index.md` if present)
- 🎛 **Surgical overrides** — optional `content/navigation.json` to rename, sort, or hide entries without renaming files

### Reading experience
- 📊 **Reading-progress bar** — thin indicator below the navbar, updates on scroll
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
│   ├── read/[[...path]]/      → Unified document route (your Library, /read/*)
│   ├── help/[[...path]]/      → Bundled Help docs route (/help/*)
│   └── layout.tsx             → Root layout (Navbar + Footer + theme script)
├── components/
│   ├── reader/                → FileTree, Breadcrumb, PrevNext, DirectoryIndex
│   ├── layout/                → Navbar, TableOfContents, Footer
│   ├── mdx/                   → Block components + UnknownComponent fallback
│   └── ui/                    → ThemeToggle, MobileMenu, selection-share helpers
├── content/                   → Your vault — drop .mdx / .md here, any depth
│   └── navigation.json        → Optional sort / hide / rename overrides
├── help-content/              → Bundled product docs (the Help section)
│   └── navigation.json        → Help-only sort / hide / rename overrides
└── lib/
    ├── content-source/        → Pluggable storage backend (local, onedrive)
    │   ├── types.ts           → ContentSource / RawFileEntry / ContentNode types
    │   ├── tree.ts            → Source-agnostic tree builder + slug resolvers
    │   ├── local.ts           → Filesystem source (default)
    │   ├── onedrive.ts        → OneDrive source (Microsoft Graph)
    │   └── index.ts           → Source selector (VERTO_CONTENT_SOURCE)
    ├── content-source.ts      → Re-export bridge (legacy import path)
    ├── help-source.ts         → Help tree API (content-source pinned to help-content/)
    ├── mdx.ts                 → Compile + render pipeline (Shiki, GFM, inline-comments)
    ├── plugins/               → remark/rehype-inline-comments
    ├── shiki.ts               → Lazy-loaded highlighter
    ├── toc.ts                 → Heading extraction for the right sidebar
    └── format.ts              → Date formatter
```

---

## 📝 Content Guide

### Adding a Document

Drop a `.mdx` or `.md` file anywhere under `content/`. The URL mirrors the
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
    "showcase": { "title": "Showcase", "order": 1 },
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
| `PackageInstall` | npm / pnpm / yarn / bun install tabs with copy button |
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

`/blog/*` is now a permanent (308) redirect to `/read/blog/*`, and content
under `content/blog/` continues to work unchanged. Verto's own bundled
documentation has moved out of the Library into the dedicated [Help
section](#-the-help-section): the old `/docs/*` routes now redirect to
`/help`.

---

## 📚 The Help section

Verto ships its own product documentation — the pages that explain Verto
itself — as a built-in **Help** section, reachable from the left rail and
served under `/help/*`. It is intentionally kept separate from your Library:

- **Always available.** Help is sourced from the bundled `help-content/`
  directory, *not* from `content/`. Pointing your Library at a GitHub repo or
  a OneDrive folder (see [Content Sources](#-content-sources)) swaps `/read/*`
  only — `/help/*` stays put.
- **Same engine.** Help reuses the exact tree builder, MDX pipeline and block
  components as the Library, so authoring a Help page is identical to authoring
  any other document.
- **Its own overrides.** `help-content/navigation.json` controls Help ordering,
  titles and visibility independently of `content/navigation.json`.

Internally, Help is a second `ContentSource` tree pinned to `help-content/`
([`lib/help-source.ts`](lib/help-source.ts)). Because that source is created
with an explicit root directory, it never follows `VERTO_LOCAL_DIR` /
`VERTO_CONTENT_SOURCE`, and every Help href is rendered under `/help`.

---

## Content Sources

Verto reads the documents behind /read from one configured content source. The
desktop product exposes a local library and RSS subscriptions; the build-time
source adapter also supports OneDrive for static deployments.

| Source | When to use | Required env |
|--------|-------------|--------------|
| local (default) | Files in a local folder | none (VERTO_LOCAL_DIR optional) |
| onedrive | Vault lives in OneDrive | VERTO_ONEDRIVE_SHARE_URL or VERTO_ONEDRIVE_REFRESH_TOKEN |

Pick the source with VERTO_CONTENT_SOURCE (local or onedrive). The selected
source is read at build time, so changing static-source content requires a
rebuild.

### Local

    VERTO_CONTENT_SOURCE=local
    VERTO_LOCAL_DIR=content

VERTO_LOCAL_DIR may be absolute or relative to the project root. In the
desktop app, Sources offers a Local Library provider with a native folder
picker. The selected folder is scanned immediately, including subfolders, and
its Markdown and MDX files can be opened in the Library.

### OneDrive

Share-URL mode is the simplest:

    VERTO_CONTENT_SOURCE=onedrive
    VERTO_ONEDRIVE_SHARE_URL=https://1drv.ms/u/s!...
    VERTO_ONEDRIVE_PATH=content

For private content, register a Microsoft Entra app and configure the tenant,
client id, client secret, and refresh token. See .env.example for the complete
set of OneDrive variables.

### Caveats

- Remote sources do not reliably expose a per-file modification time.
- navigation.json lives at the source root. For OneDrive, use
  VERTO_ONEDRIVE_PATH/navigation.json.

---
## AI Assistant

Verto can show an Ask AI panel for the document you are reading. The current
provider uses GitHub Models, an OpenAI-compatible inference endpoint. Verto
does not include GitHub sign-in: add a GitHub Models token manually in
Settings > AI & Agent.

The feature is off by default:

    NEXT_PUBLIC_VERTO_ASSISTANT=github
    NEXT_PUBLIC_VERTO_ASSISTANT_MODEL=openai/gpt-4o-mini

### Credentials and privacy

The assistant access key is stored only in the current device localStorage and
is sent only to the configured inference endpoint. The desktop app uses the
Tauri HTTP plugin for the request; it does not persist a GitHub identity or
OAuth token.

### Extending

The assistant is built on a small pluggable AssistantProvider interface in
lib/ai. Add a backend by implementing chat() in lib/ai/<name>.ts and
registering it in lib/ai/index.ts.

---
## 📄 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

---

## 🖥 Desktop app (Tauri)

The same codebase can ship as a native desktop app on macOS, Windows
and Linux via [Tauri 2](https://tauri.app). The web build is
unchanged — desktop is opt-in.

### How it works

- `src-tauri/` holds the Rust shell and `tauri.conf.json`.
- For desktop builds the Next.js app is statically exported
  (`output: 'export'`, gated on `TAURI=1`), and Tauri loads the
  `out/` folder directly from disk — no Node server at runtime.
- A small **Check for updates** button appears in the navbar only
  when running inside Tauri (detected via `window.__TAURI_INTERNALS__`),
  so the browser build is unaffected.

### Develop

```bash
npm install            # one time
npm run tauri:dev      # spawns `next dev` and opens the Tauri window
```

On macOS, local desktop builds require the full Xcode application with its
developer directory selected (Command Line Tools alone are not sufficient):

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

### Build a local installer

```bash
npm run tauri:build    # → src-tauri/target/release/bundle/...
```

The build generates its platform icon set automatically from the tracked
root `icon.png`. To regenerate it manually, run `npm run generate:tauri-icons`.

### Releases & auto-update

Installers are hosted on **GitHub Releases** and the in-app updater
fetches its manifest from a release asset URL.

During development the updater points at the rolling `nightly`
prerelease so that pushes to `main` are immediately testable:

```
https://github.com/tsaiggo/verto/releases/download/nightly/latest.json
```

Once you cut a stable, published (non-prerelease) `v*` release, switch
`plugins.updater.endpoints` in `src-tauri/tauri.conf.json` to the
`latest` channel — GitHub's `/releases/latest/` path only ever resolves
to a published, non-prerelease release:

```
https://github.com/tsaiggo/verto/releases/latest/download/latest.json
```

`.github/workflows/release.yml` runs on every pushed `v*` tag, builds
on a macOS + Windows matrix using
[`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action),
signs the artifacts, uploads them to a draft Release, and
auto-generates `latest.json`. Cut a release with:

```bash
git tag v0.2.0
git push origin v0.2.0
# then review and publish the draft release on GitHub
```

#### One-time signing setup

The updater verifies every downloaded package against an embedded
public key. Generate the key pair once:

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/verto.key
```

Then:

| Where | What |
|-------|------|
| `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` | The **public** key printed by the command |
| GitHub repo secret `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/verto.key` |
| GitHub repo secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you chose |

Back up the private key somewhere safe — if it's lost you cannot ship
updates that existing installs will accept.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/tsaiggo">tsaiggo</a>
</p>
