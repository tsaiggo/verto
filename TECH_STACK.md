# Verto — Tech Stack & Design Decisions

> **Write. Transform. Publish.**  
> Latin *vertō* — to transform

---

## 🎯 Brand Positioning

| Dimension | Description |
|-----------|-------------|
| **Name** | Verto |
| **Slogan** | Write. Transform. Publish. |
| **Aesthetic** | Restrained, premium, modern |
| **Target** | Developers, technical writers, indie bloggers |
| **Style Fusion** | Mintlify navigation × Notion elements × OpenAI aesthetics |

---

## 🏗️ Design Principles

### Write — like Notion
- Rich block elements: Callouts, Toggles, Task Lists, Bookmarks
- Inline Comments via footnote syntax `[^c-xxx]`
- Excalidraw / Mermaid embeds
- Content authored in Markdown / MDX

### Transform — the Verto engine
- Markdown → beautiful, structured HTML
- `[^c-xxx]` footnotes → highlighted text + floating comment popups
- `[^xxx]` footnotes → traditional bottom footnotes
- Code blocks → syntax-highlighted, animated, interactive blocks
- Build-time rendering for zero client-side JS overhead

### Publish — like OpenAI Blog
- Magazine-like single-column reading experience
- Generous whitespace, large typography, clear hierarchy
- Dark mode support
- Responsive three-column layout (sidebar + content + TOC)

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
| Headings (H1-H3) | OpenAI | Clear hierarchy, large, bold |
| Paragraphs | OpenAI | 18-20px, line-height 1.7-1.8 |
| Code Blocks | Shiki / Code Hike | Syntax highlight, copy, animate |
| Inline Code | Mintlify | Subtle background, rounded |
| Callouts | Notion + Mintlify | Info 💡 / Warning ⚠️ / Success ✅ |
| Toggle | Notion | Collapsible sections |
| Task Lists | Notion | Checkboxes |
| Blockquotes | OpenAI | Elegant left-border style |
| Tables | Mintlify | Clean, striped rows |
| Bookmark Cards | Notion | Link preview with title + description |
| Excalidraw | Verto | Embedded hand-drawn diagrams |
| Mermaid | Verto | Flowcharts, sequence diagrams |
| Inline Comments | Verto | `[^c-xxx]` footnote → popup |
| Images | OpenAI | Full-width with caption |

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