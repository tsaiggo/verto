# Verto — Tech Stack & Design Decisions

> **The MDX reader.** Point it at a folder. Get a site.  
> Latin *vertō* — to turn the page.

---

## 🎯 Brand Positioning

| Dimension | Description |
|-----------|-------------|
| **Name** | Verto |
| **Tagline** | The MDX reader. |
| **One-liner** | Verto is to MDX what Obsidian is to Markdown. |
| **Aesthetic** | Restrained, premium, modern |
| **Target** | Anyone with a folder of `.mdx` (or `.md`) files — developers, technical writers, note-takers, researchers |
| **Style Fusion** | Mintlify navigation × Notion elements × OpenAI reading aesthetics |

### Why this framing

Obsidian succeeded by treating a folder of Markdown as a first-class library:
no database, no schema, no lock-in, just files you already own. Verto applies
the same posture to **MDX** — the format people actually reach for once their
notes need to render components, embeds, callouts, or diagrams.

| | Obsidian (Markdown) | Verto (MDX) |
|--|--|--|
| Source of truth | A vault folder of `.md` | A `content/` folder of `.mdx` / `.md` |
| Schema | None | None |
| Extensibility | Plugins | MDX components |
| Surface | Local editor / reader pane | Statically-rendered Next.js site |
| Lock-in | None — text on disk | None — text on disk |

Verto is a **reader**, not a CMS and not an editor. The file system is the
schema; MDX is the native format; `.md` is treated as a strict subset.

---

## 🏗️ Design Principles

### Folder-as-vault — your files, your schema
- Drop any `.mdx` / `.md` files into `content/`, at any depth
- Verto auto-discovers, builds the tree, and serves them under `/read`
- No required frontmatter — fallbacks fill in title, description, and order
- Optional `content/navigation.json` for surgical overrides (rename, sort, hide)
- No database, no admin UI, no required server — the files *are* the source of truth

### MDX-first — components are the point
- One pipeline for `.mdx` and `.md`; MDX is the native format
- 10+ built-in block components — no imports required in your files
- Unknown JSX components don't crash; they render a friendly placeholder
- Code blocks: Shiki dual-theme highlight at build time, zero client JS
- Same compile pipeline used for both formats: remark-gfm → inline-comments → rehype-slug → autolink → Shiki

### Reader-grade UI
- Magazine-grade typography, generous whitespace, dual light/dark themes
- Auto-generated file-tree sidebar, table of contents, breadcrumbs, prev/next
- Reading-progress bar pinned below the navbar
- Mobile-first responsive layout

### Inline comments — the Verto signature
- `[^c-xxx]` footnotes → highlighted text + floating comment popups
- `[^xxx]` footnotes → traditional bottom-of-page footnotes
- Degrades gracefully on GitHub / Typora — content is never lost

---

## 📚 Reader Architecture

The reader is built around a **pluggable content-source abstraction** that
turns any tree of `.md` / `.mdx` files into a navigable site — whether
they live on disk, in a GitHub repo, or in OneDrive.

```
                                           ┌────────────────────────────┐
                                           │  lib/content-source/       │
  ┌─ local FS (default) ─┐                 │                            │
  │ content/             │ ──listFiles──►  │  ContentSource interface   │
  ├─ github repo ────────┤ ──readFile───►  │   (local | github |        │
  │ owner/repo@branch    │                 │    onedrive)               │
  ├─ onedrive folder ────┤                 │                            │
  │ share-url or app-OAuth                 │  tree.ts                   │
  └──────────────────────┘                 │   ├─ frontmatter parse     │
                                           │   ├─ overrides + sort      │
                                           │   └─ slug → node           │
                                           └────────────┬───────────────┘
                                                        │
                              ┌─────────────────────────┼─────────────────────────┐
                              ▼                         ▼                         ▼
                       app/page.tsx            app/read/[[...path]]        components/reader/
                       (sections grid +        (renders file or            (FileTree, Breadcrumb,
                        recently updated)       auto directory index)       PrevNext, Progress)
```

| Stage | Module | Responsibility |
|-------|--------|----------------|
| Pick source | `lib/content-source/index.ts` | Resolves `VERTO_CONTENT_SOURCE` → an active `ContentSource` |
| Enumerate | `ContentSource.listFiles()` | Lists every `.md` / `.mdx` entry (path + opaque id) |
| Discover | `lib/content-source/tree.ts` | Parses frontmatter, derives titles/desc, applies `navigation.json` overrides, sorts |
| Resolve | `getNodeBySlug` / `getFileBySlug` | Maps URL slug → tree node, descends into `_index.md` for directory landings |
| Read | `ContentSource.readFile(node)` | Streams raw text from disk / Git Blobs API / Graph download URL |
| Compile | `lib/mdx.ts` → `compileMDXContent` | Single pipeline for both `.md` and `.mdx` (remark-gfm, inline-comments, rehype-slug, autolink, Shiki) |
| Render | `app/read/[[...path]]/page.tsx` | Breadcrumb + header + content + ToC + prev/next, with `DirectoryIndex` fallback |
| Tolerate | `mdx-components.tsx` (Proxy) | Unknown JSX components render as `UnknownComponent` instead of crashing |

### Adding a new source

A source only needs to implement three methods (`listFiles`, `readFile`,
optionally `readOptionalFile` for `navigation.json`). Drop a file into
`lib/content-source/your-source.ts`, register it in `index.ts`, and the
rest of the pipeline picks it up unchanged. See `local.ts` / `github.ts`
/ `onedrive.ts` for reference implementations.

### Title & description fallbacks

| Field | Fallback chain |
|-------|----------------|
| `title` | frontmatter `title` → first `# H1` → humanized filename |
| `description` | frontmatter `description` → first non-heading paragraph (truncated) |
| `date` | frontmatter `date` → file `mtime` (shown as "Updated …") |
| `order` | frontmatter `order` → date desc (when present) → title asc |
| `hidden` | frontmatter `hidden` or override; hides node and descendants |

---

## 💻 Code Block Strategy

### Daily Code Blocks — Shiki + Rehype Pretty Code

| Setting | Choice |
|---------|--------|
| **Engine** | Shiki (TextMate grammar, VS Code-level accuracy) |
| **Theme** | Vitesse Dark / Light (dual mode) |
| **Font** | JetBrains Mono |
| **Features** | Line highlighting, word highlighting, copy button, language label |
| **Runtime JS** | Zero — rendered at build time |

```markdown
# Markdown syntax for daily code blocks

Normal:
\`\`\`js
const x = 1;
\`\`\`

With filename:
\`\`\`js title="verto.config.ts"
export default { theme: "vitesse" };
\`\`\`

Line highlighting:
\`\`\`js {2-3}
const a = 1;
const b = 2;  // highlighted
const c = 3;  // highlighted
\`\`\`

Word highlighting:
\`\`\`js /verto/
const name = "verto";
\`\`\`
```

### Tutorial Code Blocks — Code Hike

| Setting | Choice |
|---------|--------|
| **Engine** | Code Hike (built on Shiki) |
| **Features** | Step-by-step animation, spotlight/focus, scroll-driven transitions, side-by-side layout |
| **Use Case** | Tutorials, walkthroughs, step-by-step guides |

Code Hike enables:
- 🎬 Smooth code transition animations between steps
- 🔦 Spotlight — blur non-focused lines, highlight key lines
- 📜 Scroll-driven — code follows along as reader scrolls
- 🪟 Side-by-side — explanation on left, code on right

### Code Block Visual Design

```
┌─ Top Bar ───────────────────────────────────────┐
│  ● ● ●   filename.ts              📋 Copy      │
├─────────────────────────────────────────────────┤
│                                                 │
│  1  │ const verto = {                           │
│  2  │   name: "Verto",           ← line number  │
│  3  │   slogan: "Write.",        ← highlighted   │
│  4  │ };                                        │
│                                                 │
└─────────────────────────────────────────────────┘

Design checklist:
✅ Rounded corners (border-radius: 12px)
✅ Soft shadow
✅ macOS-style dots + filename + language label
✅ Line numbers (optional)
✅ Line & word highlighting
✅ Copy button with "Copied!" feedback
✅ JetBrains Mono font
✅ Auto dark/light theme switching
```

---

## 💬 Inline Comments System

### Syntax

Uses Markdown footnote syntax with `c-` prefix to distinguish from regular footnotes:

```markdown
# In your .md file

Today we shipped Verto v1,
a milestone achievement[^c-1] in the project's history.

The system uses a brand new architecture[^c-2].

For more details, see the official docs[^1].

---

[^c-1]: This took three days to debug the SSR issue 😅
[^c-2]: Chose Astro over Next.js — static-first is better for blogs

[^1]: Astro documentation https://docs.astro.build
```

### Rendering Rules

| Syntax | Renders As |
|--------|-----------|
| `[^c-xxx]` | 💬 **Inline Comment** — yellow highlight + floating popup on click |
| `[^xxx]` | 📎 **Regular Footnote** — traditional bottom-of-page footnote |

### Visual Behavior

```
Normal:    ██milestone achievement██💬
                                        
Clicked:   ██milestone achievement██💬
             ┌──────────────────────────┐
             │ 💬 Author's Note         │
             │                          │
             │ This took three days to  │
             │ debug the SSR issue 😅   │
             └──────────────────────────┘
```

### Graceful Degradation

| Platform | Behavior |
|----------|----------|
| **Verto** | ██highlighted██💬 + floating popup |
| **GitHub** | Standard footnote at bottom |
| **Typora** | Standard footnote at bottom |
| **Any Markdown renderer** | Standard footnote — no content lost |

---

## 🧩 Supported Block Elements

| Element | Style Source | Description |
|---------|-------------|-------------|
| Headings (H1-H4) | OpenAI | Clear hierarchy, large, bold; H2-H4 in TOC |
| Paragraphs | OpenAI | 18-20px, line-height 1.7-1.8 |
| Code Blocks | Shiki | Syntax highlight, copy, line numbers, title bar, diff/focus/word, collapse |
| Inline Code | Mintlify | Subtle background, rounded |
| Callouts | Notion + Mintlify | Info 💡 / Warning ⚠️ / Success ✅ |
| Toggle | Notion | Single collapsible section |
| Accordion / AccordionGroup | Notion | Multi-panel collapse, optional `exclusive` mode |
| Tabs | Mintlify | Keyboard-navigable, optional URL hash sync |
| Steps | Mintlify | Auto-numbered procedure list (CSS counter) |
| Card / CardGroup | Mintlify | Linkable cards in 1–4 column grid |
| FileTree | Verto | Static directory illustration |
| Task Lists | Notion | Checkboxes (GFM) |
| Blockquotes | OpenAI | Elegant left-border style |
| Tables | Mintlify | Clean, striped rows |
| Bookmark Cards | Notion | Link preview with title + description |
| Footnotes | GFM | Bottom-of-page section + back-references |
| Math (KaTeX) | KaTeX | `$inline$` and `$$block$$` math rendering |
| Mermaid | Mermaid.js | Flowcharts, sequence, state diagrams (dynamic-loaded) |
| Inline Comments | Verto | `[^c-xxx]` footnote → popup |
| Images | OpenAI | Full-width with caption |
| Cover image | Verto | 16:7 banner above the title (frontmatter `cover`) |
| Tag chips | Verto | Frontmatter `tags` rendered as clickable chips → tag index |

---

## 🌙 Dark Mode

- CSS custom properties for theming
- Toggle switch in navbar
- Persisted to `localStorage`
- Respects `prefers-color-scheme` on first visit
- Smooth transition between modes

---

## 🔒 Branch Strategy

| Rule | Setting |
|------|---------|
| Direct push to main | ❌ Blocked |
| Force push to main | ❌ Blocked |
| Delete main | ❌ Blocked |
| Merge method | ✅ Squash and Merge only |
| Require PR | ✅ Yes |

---

## 🎨 Design References

| Reference | Aspect |
|-----------|--------|
| [Mintlify Docs](https://docs.mintlify.com) | Sidebar navigation, TOC, callouts |
| [Notion](https://notion.so) | Block elements, inline comments, toggles |
| [OpenAI Blog](https://openai.com/blog) | Typography, whitespace, reading experience |
| [Code Hike](https://codehike.org) | Code animations, spotlight, scroll-driven |
| [Josh Comeau](https://joshwcomeau.com) | Code block aesthetics, rounded + gradient |
| [Vercel Blog](https://vercel.com/blog) | Minimal dark code blocks |
| [Raycast Blog](https://raycast.com/blog) | Radial gradient, animated borders |
| [Linear Changelog](https://linear.app/changelog) | Card-style, 3D effects |