# DESIGN.md — Verto UHD Design Contract

Authoritative design contract for the Verto UI. Every color, font size, spacing
value, radius, and layout dimension in the implementation must trace back to
tokens or primitives listed here. When the implementation and this file
disagree, this file is the target; update the implementation, not the contract
(unless the pack itself moves).

Sources of truth:

- `Verto_Final_Implementation_Pack_v1` — 92 UHD board PNGs + generated HTML
- `specs/design-tokens.json` — machine-readable base tokens (colors, spacing,
  radius, shell dimensions)
- `CODING_AGENT_HANDOFF.md` — non-negotiable interaction rules
- Foundation boards: `00_design-system-reference`, `21_design-tokens`,
  `22_component-library`, `23_app-shell-anatomy`

---

## 1. Design principles (non-negotiable)

Copied from `CODING_AGENT_HANDOFF.md`:

1. **The document is the primary visual object.** Chrome supports it, never
   competes.
2. **Neutral OpenAI/Notion-inspired surfaces.** Minimal shadows. Thin
   `1px` borders. No decorative gradients, no card-inside-card nesting more
   than one level.
3. **No mascot, no decorative illustrations.** SVG icons only (Lucide).
4. **Three canonical workspace modes:** Read / Edit / Split.
5. **One context rail order:** Outline / Notes / Links / Agent.
6. **Agent answers cite sources.** Agent writes require preview + explicit
   approval + reversible undo.
7. **Local files are the source of truth.** No hidden CMS.
8. **Demo identity is Alex Chen. Core example documents use `.mdx`.**

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
| bg         | `#FAFAFA` | `--bg`                      | Application background                |
| surface    | `#FFFFFF` | `--surface` (canvas)        | Cards, panels, elevated surfaces      |
| subtle     | `#F5F5F3` | `--bg-subtle`               | Rail, sidebar, inactive fill          |
| border     | `#E6E6E2` | `--border`                  | Thin dividers, card outlines          |
| border-soft| —         | `--border-soft`             | Even softer dividers (list rows)      |
| text       | `#0F1115` | `--text`                    | Primary text                          |
| muted      | `#6B6F76` | `--text-muted`              | Secondary / meta text                 |
| light      | —         | `--text-light`              | Timestamps, tertiary hints            |
| accent     | `#2563EB` | `--accent-blue`             | Interactive accent (rare)             |
| success    | `#16A34A` | `--accent-green`            | Positive state, added diff            |
| warning    | `#F59E0B` | (`warning`)                 | Warning banner, cautions              |
| error      | `#DC2626` | (`error`)                   | Error state, removed diff             |

Data-viz palette (activity heatmap monochrome, from board 10):
`#ECECEA → #D7D7D2 → #AEAEA8 → #777772 → #30302F`.
The activity heatmap must stay monochrome — no blues, no purples.

Dark mode is out of scope for the final pack (no dark reference beyond board
19 as a preview). Do not invent a dark palette without a reference.

---

## 3. Typography

Two families, both loaded via `next/font/google` in [`app/layout.tsx`](app/layout.tsx):

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
| Stat display        | 22–26px | 700     | Activity stat cards              |
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
No `10px`, no `14px` — round to the nearest scale value.

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

From board 23 + `specs/design-tokens.json → desktopPanels`:

| Region           | Width         | Notes                                    |
| ---------------- | ------------- | ---------------------------------------- |
| Primary nav      | 64px          | Icon-only rail, always visible           |
| Sources rail     | 240–280px     | Contextual for source/library work       |
| Document tree    | 280–340px     | File tree inside reader/editor           |
| Context rail     | 320–360px     | Outline / Notes / Links / Agent          |
| Top bar          | 56px          | Search + user; NEVER stacks multiple rows |
| Status bar       | 28px          | Optional, footer-height only             |

Rules:

- The primary nav order matches board 23: Home / Inbox / Library / Collections
  / Tags / Bookmarks / Graph / Agent / Knowledge Studio / Activity. Settings
  and the profile row sit at the bottom of the rail.
- The context rail's tab order is fixed: Outline / Notes / Links / Agent. No
  reordering.
- A page's own tabs live BELOW the top bar and ABOVE the two-column split (see
  `/search` layout). Never inline extra buttons into the search input row.

---

## 6. Component primitives

From board 22 + implementation classes. Each row below is BOTH the design
spec and the CSS surface. When a component is missing here, do NOT invent one
per-route — add it here and reuse.

| Primitive          | CSS class(es)                      | Anatomy                                    |
| ------------------ | ---------------------------------- | ------------------------------------------ |
| Card               | `.v-card`                          | 1px border, `--surface` bg, 8–12px radius  |
| Card header        | `.v-cardhead`, `.v-cardhead-title` | 13px semibold, muted title                 |
| Card divider       | `.v-card-divider`                  | 1px `--border-soft` inside a card          |
| Page header        | `<PageHeader title subtitle tools>`| Title + subtitle + right-slot actions      |
| Page tab bar       | `<PageTabs tabs=[]>`               | Underlined tab, single active              |
| Segmented control  | `.v-seg`, `.v-seg-btn`             | Grid/list toggle, radio-style single-active|
| Button (default)   | `.v-btn .v-btn--sm`                | Text + optional leading icon               |
| Button (primary)   | `.v-btn .v-btn--primary`           | High-contrast, primary CTA                 |
| Tag pill           | `.tag-pill`                        | `999px` radius, subtle count chip on right |
| Search prompt      | `<SpecBoardSearchPrompt>`          | Reusable full-width search input           |
| Stat card          | `.act-stat`                        | Label above, value below, no delta text    |
| Heatmap cell       | `.act-heat-cell` with `data-level` | 5-step monochrome only                     |
| Result row         | `.uhd05-result`                    | Title + `source · time` + relevance % right |
| Timeline row       | `.act-recent-row`                  | Title / sub / right-aligned time-ago       |

Rules:

- Do NOT create a per-route bespoke card style when `.v-card` will work.
- Icon columns and preview panels on result cards (as the old `/search`
  had) are forbidden unless the reference explicitly shows them.
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

Board-specific states are indexed under `/final/[id]` and (currently) still
mirror the reference pack as coverage scaffolds. See §9 for known gaps.

---

## 8. Sample data policy

When `content/` is empty (fresh checkout, CI), routes that would render real
files fall back to samples from `components/pages/sample.ts`:

- `SAMPLE_DOCS`   — for recent activity, search results
- `SAMPLE_TAGS`   — for tag counts
- `SAMPLE_COLLECTIONS` — for collections grid

Rules:

- Fallbacks must produce the same shape as real data — no route may render
  differently between "real" and "sample" mode, only the underlying values
  differ.
- Do not hardcode data inline in a page component when a sample export can
  cover it. Add to `sample.ts`.

---

## 9. Known gaps (not yet aligned to the pack)

These are tracked here so they are neither silently accepted nor forgotten:

- **State/step/error routes** — `/agent/[state]`, `/editor/[state]`,
  `/git/[state]`, `/integrations/[...state]`, `/settings/[section]`,
  `/onboarding/[step]`, `/states/[state]` still render `FinalPackScreen`
  scaffolds rather than the real feature component in that state. Each of
  these should be either (a) removed if the state is unreachable in product
  navigation, or (b) rewired to the real component with the state as a prop.
- **`/final/[id]`** — intentionally kept as a coverage scaffold that
  reproduces the 92 PNGs for reference-fidelity QA. This is not a product
  route and its screenshots do not prove product completeness.
- **`/read/*` reader typography** — matches the pack but has not been
  measured against the reader-mode boards (33–40) with settled scroll
  positions.
- **Responsive breakpoints (boards 12–14)** — the app renders responsively
  but no reference-fidelity capture has been done at tablet (768) and
  mobile (375).
- **Dark mode (board 19)** — a light-mode inversion exists via CSS, but is
  not validated against the reference; treat as out-of-scope until a full
  dark reference lands.

---

## 10. Verification protocol

Before claiming a page matches the pack:

1. Render at viewport `1920 × 1080` with `deviceScaleFactor: 2` (to match
   the pack's `3840 × 2160` PNGs).
2. Compare via `pixelmatch` at `threshold: 0.1`. Similarity is an aim
   number, not the verdict.
3. Look at the composite `[reference | actual | diff]` and confirm:
   - Header hierarchy matches
   - Above-the-fold coverage matches
   - Component primitives match (no per-page bespoke cards)
   - Color tokens match (no unexpected blues, purples, tints)
   - CJK text (if present) breaks naturally
4. If the page fails on any of those, fix it — do not paper over with a
   higher similarity score. `/activity` at 94% is a better failure than
   `/tags` at 99.19% would be if `/tags` used the wrong visual model.

---

Maintained by the redesign engineering pass. When you add a new token, size,
component, or accepted gap, update this file BEFORE the code.
