# Verto

> **Write. Transform. Publish.**  
> *Latin vertō — to transform*

Verto is a modern blog engine that fuses **Mintlify's** structured navigation, **Notion's** expressive block system, and **OpenAI Blog's** magazine-like reading aesthetics into one cohesive publishing platform.

---

## ✨ Live Demo

Open [`index.html`](./index.html) directly in your browser — no build step, no dependencies.  
It showcases the full Verto design system: layout, typography, dark mode, all block elements, and the signature **Inline Comment** feature.

---

## 🎯 Design Philosophy

| Pillar | Inspiration | What it means |
|--------|-------------|---------------|
| **Write** | Notion | Rich block elements authored in plain Markdown |
| **Transform** | Verto engine | Markdown → beautifully structured, interactive HTML |
| **Publish** | OpenAI Blog | Magazine-grade reading experience, zero compromise |

---

## 🧩 Block Elements

Every element has a clean Markdown syntax and a beautiful default render:

- **Headings** — H1 / H2 / H3 with clear typographic hierarchy
- **Code Blocks** — syntax highlighting (Shiki), copy button, line/word highlighting, Code Hike animations for tutorials
- **Callouts** — 💡 Info · ⚠️ Warning · ✅ Success
- **Toggle Sections** — collapsible detail blocks
- **Task Lists** — interactive checkboxes
- **Blockquotes** — elegant left-border style
- **Tables** — clean, striped rows
- **Bookmark Cards** — link preview with title, description, favicon
- **Excalidraw / Mermaid** — embedded diagrams
- **Images** — full-width with caption
- **Inline Comments** — Verto's signature feature (see below)

---

## 💬 Inline Comments

The standout feature. Authors annotate text with a `c-` footnote prefix — rendered as highlighted text with a floating popup on click:

```markdown
Today we shipped Verto v1, a milestone[^c-1] in the project's history.

[^c-1]: This took three days to debug the SSR issue 😅
[^1]:   Regular footnote — rendered at page bottom as usual
```

| Syntax | Renders as |
|--------|-----------|
| `[^c-N]` | 💬 Yellow highlight + floating "Author's Note" popup |
| `[^N]`   | 📎 Traditional footnote at the bottom of the page |

Graceful degradation: on GitHub, Typora, or any standard Markdown renderer, both render as normal footnotes — no content is ever lost.

---

## 🌙 Dark Mode

- CSS custom properties for instant, flicker-free switching
- Toggle in the navbar; persisted to `localStorage`
- Respects `prefers-color-scheme` on first visit

---

## 📐 Layout

```
┌─ Navbar ────────────────────────────────────────────┐
│  Verto                                    🌙  v0.1  │
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│ Sidebar  │   Main Content           │  Table of     │
│          │   (single column,        │  Contents     │
│ Mintlify │    magazine reading)     │  (scroll-spy) │
│ nav with │                          │               │
│ groups   │   OpenAI aesthetics      │  Mintlify     │
│          │                          │  style        │
└──────────┴──────────────────────────┴───────────────┘
```

- **Desktop:** Full three-column layout
- **Tablet (≤1100px):** Right ToC hidden
- **Mobile:** Left sidebar collapses behind a hamburger menu

---

## 📦 Tech Stack

See [`TECH_STACK.md`](./TECH_STACK.md) for full design decisions, including:

- Parser pipeline (unified / remark extensions)
- Renderer strategy (Astro components)
- Code block tooling (Shiki + Code Hike)
- Color palette and typography specification
- Branch & contribution strategy

---

## 🚀 Getting Started

The demo runs with zero dependencies — just open `index.html`:

```bash
# Clone the repo
git clone https://github.com/tsaiggo/verto.git  # or your fork
cd verto

# Open the demo
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

Or serve it locally:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

---

## 🤝 Contributing

Issues and pull requests are welcome. Please read [`TECH_STACK.md`](./TECH_STACK.md) before contributing to understand the design constraints and aesthetic goals.

---

## 📄 License

Licensed under the [Apache License 2.0](./LICENSE).