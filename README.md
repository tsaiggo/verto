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
    ├── content-source/        → Pluggable storage backend (local, github, onedrive)
    │   ├── types.ts           → ContentSource / RawFileEntry / ContentNode types
    │   ├── tree.ts            → Source-agnostic tree builder + slug resolvers
    │   ├── local.ts           → Filesystem source (default)
    │   ├── github.ts          → GitHub repo source (Git Trees API)
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

## 🗄 Content Sources

Verto resolves the readable content behind `/read/*` through a pluggable
**ContentSource** abstraction. By default it walks the local `./content`
directory, but the same site can be pointed at a remote vault — a GitHub
repository or a OneDrive folder — by setting environment variables. See
[`.env.example`](.env.example) for the full list.

| Source | When to use | Required env |
|--------|-------------|--------------|
| **`local`** (default) | Files in a local folder; static site, no network | _none_ (`VERTO_LOCAL_DIR` optional) |
| **`github`** | Vault lives in a GitHub repo (public or private) | `VERTO_GITHUB_REPO` |
| **`onedrive`** | Vault lives in OneDrive (shared link or private) | `VERTO_ONEDRIVE_SHARE_URL` *or* `VERTO_ONEDRIVE_REFRESH_TOKEN` (+ client id/secret) |

Pick the source with `VERTO_CONTENT_SOURCE` (`local` | `github` | `onedrive`).
The selected source is used at **build time**, so changing content still
requires a rebuild — Verto remains a statically-rendered reader.

### Local

```bash
VERTO_CONTENT_SOURCE=local
VERTO_LOCAL_DIR=content           # optional; folder to read .md/.mdx from
```

`VERTO_LOCAL_DIR` points the reader at any folder on disk. It may be
absolute or relative to the project root; when unset it defaults to the
bundled `./content` directory.

In the **desktop app**, the **Sources** page offers a _Local Library_
provider with a **Choose folder…** button that opens the native folder
picker, so you can browse to the directory you want to read instead of
editing env vars by hand. Saving a folder refreshes the desktop Library rail
with the `.md` / `.mdx` files found there. The document route is still part of
the static export, so files that were not present at build time may need a
future runtime reader before their contents can be opened from the rail.


### GitHub

```bash
VERTO_CONTENT_SOURCE=github
VERTO_GITHUB_REPO=owner/repo
VERTO_GITHUB_BRANCH=main          # optional, defaults to "main"
VERTO_GITHUB_PATH=content         # optional sub-directory in the repo
VERTO_GITHUB_TOKEN=ghp_xxx        # optional; required for private repos
```

A single Git Trees API call enumerates the whole repo, then individual
files are fetched as blobs on demand. Without a token the unauthenticated
rate limit is 60 requests/hour — set `VERTO_GITHUB_TOKEN` (a fine-grained
PAT with `Contents: read` is enough) to raise it to 5000/h.

### OneDrive

Two operating modes — share-URL mode is the simplest:

```bash
VERTO_CONTENT_SOURCE=onedrive
VERTO_ONEDRIVE_SHARE_URL=https://1drv.ms/u/s!...
VERTO_ONEDRIVE_PATH=content       # optional sub-folder inside the shared item
```

Any user with the share link can read the folder, so no OAuth is needed.
Verto encodes the share URL into Microsoft Graph's `u!…` share-id scheme
and walks the folder via `/shares/{id}/driveItem`.

For **private** content register a Microsoft Entra (Azure AD) app, grant
it `Files.Read` + `offline_access`, complete a one-off auth dance to get
a refresh token, and configure:

```bash
VERTO_CONTENT_SOURCE=onedrive
VERTO_ONEDRIVE_TENANT=common          # or "consumers" / a tenant GUID
VERTO_ONEDRIVE_CLIENT_ID=...
VERTO_ONEDRIVE_CLIENT_SECRET=...
VERTO_ONEDRIVE_REFRESH_TOKEN=...
VERTO_ONEDRIVE_PATH=content
```

Tokens are refreshed automatically each build. The implementation
respects Graph `@odata.nextLink` pagination and backs off on `429` /
`Retry-After`.

### Caveats

- Remote sources don't reliably surface a per-file modification time.
  Prefer frontmatter `date` / `updated` / `order` for deterministic sort.
- `navigation.json` lives at the **source root** — for GitHub that's
  `VERTO_GITHUB_PATH/navigation.json`, for OneDrive it's
  `VERTO_ONEDRIVE_PATH/navigation.json`.

---

## 🤖 AI Assistant (GitHub Copilot)

Verto can show an **Ask AI** panel in the right rail that answers questions
about the document you're currently reading, powered by **GitHub Models** —
an OpenAI-compatible inference endpoint authenticated with a GitHub token (the
same kind of token the desktop app already obtains when you *Sign in with
GitHub*). The model sees the open document's title and text, so answers are
grounded in what you're reading.

The feature is **off by default**. Enable it by selecting a backend:

```bash
NEXT_PUBLIC_VERTO_ASSISTANT=github          # aliases: copilot, github-models
NEXT_PUBLIC_VERTO_ASSISTANT_MODEL=openai/gpt-4o-mini   # optional override
```

### Credentials & privacy

Tokens are **never** written to the repository:

| Build | Where the token comes from |
|-------|----------------------------|
| **Desktop (Tauri)** | Reuses the GitHub OAuth token from the device-flow sign-in. Requests go through the Tauri HTTP plugin to bypass the webview's CORS restrictions. |
| **Web** | You paste a GitHub token with Models access; it is kept **only** in your browser's `localStorage` and sent only to the inference endpoint. |

If the assistant is enabled but no token is available, the panel shows a short
prompt (sign in on desktop, or paste a key on the web) instead of a chat box.

### Extending

The assistant is built on a small pluggable `AssistantProvider` interface in
[`lib/ai/`](lib/ai), mirroring the `ContentSource` design. Add a new backend by
implementing `chat()` in `lib/ai/<name>.ts` and registering it in
`lib/ai/index.ts`.

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

### Sign in with GitHub

The desktop app can sign in with a GitHub account and connect to a
repository **interactively at runtime** — no `VERTO_GITHUB_TOKEN` in the
environment. It uses GitHub's **OAuth Device Flow**, which only needs a
*public* client id (there is no client secret to ship).

**One-time setup (maintainer):**

1. Register a GitHub **OAuth App**
   (Settings → Developer settings → OAuth Apps → New) and enable
   **Device Flow**.
2. Grant the scopes the reader needs: `repo` (read private repos; use
   `public_repo` for public-only) and `read:user`.
3. Expose the app's **Client ID** to the build. For local source builds,
   put it in `.env.local`:

   ```bash
   NEXT_PUBLIC_VERTO_GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxx
   ```

   For the released installers built by GitHub Actions
   (`release.yml` / `nightly.yml`), set the Client ID as a repository
   **Actions Variable** named `VERTO_GITHUB_CLIENT_ID` (Settings →
   Secrets and variables → Actions → **Variables**). The workflows inject
   it as `NEXT_PUBLIC_VERTO_GITHUB_CLIENT_ID` at build time so the shipped
   binaries can sign in out of the box. It is a *public* value, so it
   belongs in a Variable, not a Secret. If the variable is unset, the
   build still succeeds but the **Sign in** button reports a missing
   client id.

**How it works at runtime:**

- A **Sign in** button appears in the top bar only inside the desktop
  shell (same Tauri detection as *Check for updates*; the browser build
  is unaffected).
- Signing in opens GitHub's device-verification page in your system
  browser and shows a short user code to enter.
- On success the OAuth token and your profile are written to a file in
  the OS app-data directory
  (e.g. `~/Library/Application Support/com.tsaiggo.verto/auth.json` on
  macOS, `%APPDATA%\com.tsaiggo.verto\auth.json` on Windows), with
  owner-only permissions (`0600`) on Unix. **The token is never stored
  in the repository.**
- Open **Integrations → Connect source**, pick a repository and branch
  from your account, set the content path, and **Save & connect**. Verto
  verifies the path against the live repo and saves the selection
  alongside the token. **Sign out** deletes the auth file.

The cross-origin calls to `github.com` / `api.github.com` go through the
Tauri HTTP plugin (scoped to those hosts in
`src-tauri/capabilities/default.json`) so they bypass the webview's CORS
restrictions. The web/CI build continues to use the build-time
`VERTO_GITHUB_*` environment variables described under
[Content Sources](#-content-sources).

### Build a local installer

```bash
npm run tauri:build    # → src-tauri/target/release/bundle/...
```

Before the first build you need icons; generate them once from the
included `icon.png` at the repo root (any square ≥ 1024×1024 PNG works):

```bash
npx @tauri-apps/cli icon icon.png
```

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
