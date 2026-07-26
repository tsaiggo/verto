# DESIGN.md — Verto Product Design Contract

Authoritative design contract for the Verto UI. Product geometry and semantic
color must trace back to the tokens or primitives listed here. Small optical
adjustments belong in the owning CSS module and must preserve the same visual
system.

Sources of truth:

- `specs/design-tokens.json` — machine-readable colors and canonical geometry
- `components/layout/VertoShell.module.css` — runtime shell variables
- `components/reader/ReaderWorkspace.module.css` — canonical Reader geometry
- This document — product and interaction principles

---

## 1. Design principles (non-negotiable)

1. **The document is the primary visual object.** Chrome supports it, never
   competes.
2. **Neutral OpenAI/Notion-inspired surfaces.** Minimal shadows. Thin
   `1px` borders. No decorative gradients, no card-inside-card nesting more
   than one level.
3. **No mascot, no decorative illustrations.** SVG icons only (Lucide).
4. **Three canonical workspace modes:** Read / Edit / Split.
5. **Reader context is progressive:** a compact or floating Outline sits
   immediately beside the article; Agent owns the rightmost persistent panel.
6. **Agent answers cite sources.** Agent writes require preview + explicit
   approval + reversible undo.
7. **Your local library keeps files as the source of truth.** No hidden CMS.
8. **Samples exercise the real data shape.** Demo content never unlocks a
   separate or more capable UI than local files.

Add-on principles for this implementation:

- Motion serves meaning — a hover that changes nothing is slop and is
  forbidden.
- Every element that gains visual weight (background, border, shadow) has to
  earn it with a state change or affordance.
- CJK text must break naturally (no orphan particles, no split parenthetical
  citations). This applies to Korean, Japanese, Chinese.

---

## 2. Color tokens

Base palette (from `specs/design-tokens.json`):

| Role       | Hex       | CSS variable                | Use                                   |
| ---------- | --------- | --------------------------- | ------------------------------------- |
| canvas     | `#F7F7F5` | `--verto-canvas`            | Application canvas and compact rail   |
| surface    | `#FFFFFF` | `--verto-surface`           | Article and work surfaces             |
| subtle     | `#F4F4F1` | `--verto-surface-subtle`    | Inactive and hover-adjacent fill      |
| border     | `#E3E3DF` | `--verto-border`            | Thin panel outlines                   |
| border-soft| `#ECECEA` | `--verto-border-soft`       | Dividers and list rows                |
| text       | `#171715` | `--verto-text`              | Primary text                          |
| secondary  | `#42423E` | `--verto-text-secondary`    | Secondary text                        |
| muted      | `#6B6B67` | `--verto-muted`             | Metadata and tertiary labels          |
| accent     | `#2563EB` | `--accent-blue`             | Interactive accent (rare)             |
| success    | `#16A34A` | `--accent-green`            | Positive state, added diff            |
| warning    | `#F59E0B` | (`warning`)                 | Warning banner, cautions              |
| error      | `#DC2626` | (`error`)                   | Error state, removed diff             |

Light mode is the reference direction. Dark mode is supported by the shell and
content tokens and must preserve the same hierarchy and WCAG contrast; it
should not introduce a second visual language.

---

## 3. Typography

Two bundled local families, loaded via `next/font/local` in
[`app/layout.tsx`](app/layout.tsx):

- **Sans:** Inter (`--font-hanken`). Used for all UI and body text.
- **Mono:** JetBrains Mono (`--font-jbmono`). Used for code, diff, editor
  source, tabular numerics.

Type ramp used across boards:

| Role                | Size    | Weight  | Notes                            |
| ------------------- | ------- | ------- | -------------------------------- |
| Page H1             | 20–22px | 700     | E.g. `Search`, `Welcome to Verto`|
| Page subtitle       | 12–14px | 400/500 | Muted color                      |
| Card title (H2)     | 15–16px | 650–700 | Body cards, results              |
| Card body           | 12.5–13.5px | 400 | Muted default                    |
| Meta / timestamp    | 11.5–12px | 500    | `--text-light` or `--text-muted` |
| Reader H1           | ~32px   | 700     | Inside document reader           |
| Reader body         | ~15px   | 400     | 1.75 line-height                 |

Rules:

- Never introduce a new size or weight outside the ramp. If a design needs
  one, add it here first.
- CJK text uses same families. If a glyph is missing, degrade to system CJK,
  never fall back to a decorative substitute.

---

## 4. Spacing, radius, elevation

**Spacing scale** (from `specs/design-tokens.json`):
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`.
Use the scale for layout. Optical corrections such as icon alignment, compact
control padding, or a 1–2px divider offset are allowed inside the component
that owns them; they are not new layout tokens.

**Radius scale**:
`0 · 2 · 4 · 6 · 8 · 12 · 18 · 24`.
Pills use `999px` (fully rounded), never a large numeric radius.

**Elevation** — flat by design:

- No box-shadow on cards. A `1px var(--border)` outline is the elevation.
- Modals and popovers may use a soft shadow (`0 20px 60px rgba(0,0,0,.18)`
  matches the reference pack).
- Never combine card gradient + card shadow + card border. Pick one.

---

## 5. App shell anatomy

Canonical desktop shell and Reader geometry:

| Region           | Width         | Notes                                    |
| ---------------- | ------------- | ---------------------------------------- |
| Primary nav      | 64px          | Icon-only rail, always visible           |
| Native title bar | 44px          | History + workspace tabs                 |
| Top bar          | 48px          | Breadcrumbs and sparse page utilities    |
| Document tabs    | 40px          | Open local documents; Reader only        |
| Reader article   | ≤760px        | Primary visual object                    |
| Floating TOC     | 218px         | Visible from 1440px; compact below       |
| Agent            | 352px         | Rightmost persistent panel from 1280px   |
| Mobile rail      | Sheet         | 390px layouts use the same nav hierarchy |

Rules:

- The primary nav order is Home / Inbox / Library / Collections / Tags /
  Bookmarks / Agent / Knowledge Studio. Sources, Local runtime, Settings,
  Help, and the profile row sit in the utility area.
- Titlebar tabs represent workspaces or sources. Document identity belongs in
  the dedicated Document Tabs band and must not be repeated in the Titlebar.
- A page's own tabs live BELOW the top bar and ABOVE the two-column split (see
  `/search` layout). Never inline extra buttons into the search input row.

---

## 6. Component primitives

shadcn/Radix supplies behavior and accessibility; Verto tokens and page
modules supply visual character. When a component is missing here, extend the
shared primitive before creating a route-specific interaction.

| Primitive | Runtime source | Anatomy |
| --- | --- | --- |
| Button | `components/ui/button.tsx` | Default, outline, ghost, destructive; icon + concise label |
| Tabs | `components/ui/tabs.tsx` | Radix keyboard model, one active panel |
| Dialog / Sheet | `components/ui/dialog.tsx`, `sheet.tsx` | Modal confirmation or narrow-screen panel |
| Popover / Dropdown | `components/ui/popover.tsx`, `dropdown-menu.tsx` | Anchored, dismissible transient action |
| Tooltip | `components/ui/tooltip.tsx` | Label for compact rail and icon-only controls |
| Page header | `components/layout/PageHeader.tsx` | Title, subtitle, sparse trailing tools |
| System state | `components/layout/SystemState.tsx` | Honest loading, empty, unavailable, and recovery copy |
| Document tabs | `components/layout/DocumentTabs.tsx` | Roving keyboard focus, Delete to close, local persistence |
| Page modules | `components/*/*.module.css` | Thin border, neutral surface, route-specific information layout |

Rules:

- Do not create a card simply to group adjacent content. Use spacing and a
  divider first; a border must communicate a reusable object or state.
- Icon columns and preview panels are reserved for information that cannot be
  scanned from title, source, and metadata alone.
- Segmented "Grid/List" view toggles must correspond to real behavior. If
  the second view mode is not implemented, do not render the toggle.

---

## 7. State inventory (per surface)

Every real product surface has these states unless otherwise noted:

- **default**  — populated with real data
- **empty**    — no content, actionable next step visible
- **loading**  — skeleton preserving layout
- **error**    — recoverable, with retry
- **read-only** / **archived** (for documents)

Product states are exercised through the real routes and local state stores.
`/final/[id]` remains reference material only.

---

## 8. Sample data policy

When `content/` is empty (fresh checkout, CI), routes that would render real
files fall back to samples from `components/pages/sample.ts`:

- `SAMPLE_DOCS`   — for the home screen and search results
- `SAMPLE_TAGS`   — for tag counts
- `SAMPLE_COLLECTIONS` — for collections grid

Rules:

- Fallbacks must produce the same shape as real data — no route may render
  differently between "real" and "sample" mode, only the underlying values
  differ.
- Do not hardcode data inline in a page component when a sample export can
  cover it. Add to `sample.ts`.

---

## 9. Maintained constraints and debt

- **`/final/[id]`** is a design-reference route, not a product-completeness
  signal. Primary-flow tests intentionally exclude it.
- **Legacy global CSS** now contains only runtime-generated document styles
  and still-active cross-page layers. Agent, Search, Inbox, and portions of
  Reader should continue migrating to CSS modules when they are next changed.
- **Test-only rail compatibility** retains the older rail cluster until its
  source-level honesty tests are migrated to `VxRail`.
- **Dark mode** is supported and contrast-safe, but light mode remains the
  visual acceptance reference.

---

## 10. Verification protocol

Before claiming a product pass:

1. Run format, TypeScript, ESLint, unit tests, and a production Next build.
2. Exercise the primary route matrix at desktop and `390 × 844`; reject
   horizontal overflow, page errors, or missing main content.
3. Run axe on every primary surface at both supported viewport classes and
   resolve all critical or serious WCAG findings.
4. Exercise the canonical Library → Reader → citation → Editor path and all
   approval/undo loops with deterministic providers.
5. Build the Tauri frontend and run the native Rust check. Treat missing host
   packaging tools as an environment blocker, never as a product pass.
6. Visually confirm hierarchy, neutral token use, CJK wrapping, focus states,
   and that no new card layer competes with the document.

---

Maintained by the redesign engineering pass. When you add a new token, size,
component, or accepted gap, update this file BEFORE the code.
