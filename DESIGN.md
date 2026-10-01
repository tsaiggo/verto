---
name: Verto
description: Calm reading workspaces in the approved Sidebar visual system.
colors:
  canvas: "#fcfcfd"
  surface: "#FFFFFF"
  surface-subtle: "#f8f9fb"
  border: "#e9eaee"
  border-soft: "#f2f3f5"
  text: "#171715"
  text-secondary: "#42423E"
  muted: "#6B6B67"
  hover: "#f2f3f5"
  active: "#e9eaee"
  focus: "#2563EB"
  link: "#2563EB"
  success: "#16A34A"
  warning: "#D97706"
  error: "#DC2626"
  dark-canvas: "#0b0d10"
  dark-surface: "#111317"
  dark-surface-subtle: "#161a1f"
  dark-border: "#262b31"
  dark-border-soft: "#1c2127"
  dark-text: "#e6e7ea"
  dark-text-secondary: "#9ca3af"
  dark-muted: "#8b949e"
  dark-hover: "#1e232a"
  dark-active: "#262b31"
  dark-link: "#8ab4ff"
typography:
  route-title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: "28px"
    letterSpacing: "-0.025em"
  route-subtitle:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
  control-label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  mono:
    fontFamily: "JetBrains Mono, monospace"
rounded:
  none: "0px"
  2: "2px"
  4: "4px"
  5: "5px"
  6: "6px"
  7: "7px"
  8: "8px"
  9: "9px"
  10: "10px"
  12: "12px"
  14: "14px"
  18: "18px"
  24: "24px"
  pill: "999px"
spacing:
  4: "4px"
  8: "8px"
  12: "12px"
  16: "16px"
  20: "20px"
  24: "24px"
  32: "32px"
  40: "40px"
  48: "48px"
  64: "64px"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.surface}"
    typography: "{typography.control-label}"
    rounded: "{rounded.7}"
  button-primary-hover:
    backgroundColor: "{colors.text-secondary}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.control-label}"
    rounded: "{rounded.6}"
    padding: "0 12px"
    height: "36px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.6}"
    padding: "0 12px"
    height: "36px"
  navigation-row:
    textColor: "{colors.muted}"
    rounded: "{rounded.9}"
    padding: "0 10px"
    height: "35px"
  filter-chip:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.4}"
    padding: "2px 6px"
  document-row:
    textColor: "{colors.text}"
    padding: "16px 12px"
  reading-object:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text}"
    rounded: "{rounded.8}"
  agent-composer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.8}"
    padding: "12px"
---

# DESIGN.md — Verto Product Design Contract

Authoritative design contract for the Verto UI. Product geometry and semantic
color must trace back to the tokens or primitives listed here. Small optical
adjustments belong in the owning CSS module and must preserve the same visual
system.

**Creative North Star: "Approved Workspace Sidebar"**

The approved Workspace Sidebar is the visual authority: Inter typography,
cold neutral surfaces, thin dividers and quiet selected rows. Web workspace
pages adapt that world with compact views and tools, flat content objects and
progressive context.

Reading stays the primary task. Returning readers see a readable object or an
honest next action; source data, AI readiness and unavailable actions stay
explicit.

**Key Characteristics:**

- Cold neutral surfaces with thin dividers and quiet selection.
- Compact route identity, views and tools before the content objects.
- Progressive AI context attached to the current task, with a standalone Agent workspace.

Sources of truth:

- `specs/design-tokens.json` — machine-readable colors and canonical geometry
- `app/redesign.css` — global semantic palette, including portalled controls
- `components/layout/VertoShell.module.css` — runtime shell variables
- `components/reader/ReaderWorkspace.module.css` — canonical Reader geometry
- This document — product and interaction principles

---

## 1. Design principles (non-negotiable)

1. **The document is the primary visual object.** Chrome supports it, never
   competes.
2. **Cold neutral surfaces.** Minimal shadows. Thin `1px` borders. No
   decorative fills beyond the single workspace gradient-mark 23px (23px mark exception), no card-in-card nesting more than one level.
3. **No mascot, no decorative illustrations.** SVG icons only (Lucide).
4. **Three canonical workspace modes:** Read / Edit / Split.
5. **Reader context is progressive:** a compact or floating Outline sits
   immediately beside the article; Ask AI opens the standalone Agent with the current source.
6. **Agent answers cite sources.** Agent writes require preview + explicit
   approval + reversible undo.
7. **Your local library keeps files as the source of truth.** No hidden CMS.
8. **Samples exercise the real data shape.** Demo content never unlocks a
   separate or more capable UI than local files.
9. **Flat by intent:** cards carry no shadow, menus and modals own elevation.
10. **Same language in dark.** Dark preserves the cold neutral hierarchy and
    WCAG contrast, it does not introduce a second visual language.
11. **Accent, focus and links have separate roles.** Focus remains `#2563EB`
    in both themes. Links and Agent citations use the semantic link token,
    while interactive accent stays rare and restrained.

Add-on principles for this implementation:

- Motion serves meaning — a hover that changes nothing is slop and is
  forbidden.
- Every element that gains visual weight (background, border, shadow) has to
  earn it with a state change or affordance.
- CJK text must break naturally (no orphan particles, no split parenthetical
  citations). This applies to Korean, Japanese, Chinese.
- Shell is 56+232 collapsible with topbar 56, frame ceiling stays 1240 and TOC 218 is kept. There is no reserved Agent column.

---

## 2. Color tokens

Base palette — cold neutrals (v2, shared by the frontmatter,
`specs/design-tokens.json`, and the global `--verto-*` declarations in
`app/redesign.css`):

| Role       | Hex       | CSS variable                | Use                                   |
| ---------- | --------- | --------------------------- | ------------------------------------- |
| canvas     | `#fcfcfd` | `--verto-canvas`            | Application canvas and compact rail   |
| surface    | `#FFFFFF` | `--verto-surface`           | Article and work surfaces             |
| subtle     | `#f8f9fb` | `--verto-surface-subtle`    | Inactive and hover-adjacent fill      |
| border     | `#e9eaee` | `--verto-border`            | Thin panel outlines                   |
| border-soft| `#f2f3f5` | `--verto-border-soft`       | Dividers and list rows                |
| text       | `#171715` | `--verto-text`              | Primary text                          |
| secondary  | `#42423E` | `--verto-text-secondary`    | Secondary text                        |
| muted      | `#6B6B67` | `--verto-muted`             | Metadata and tertiary labels          |
| hover      | `#f2f3f5` | `--verto-hover`             | Hover state                           |
| active     | `#e9eaee` | `--verto-active`            | Quiet selected state                  |
| focus      | `#2563EB` | `--verto-focus`             | Keyboard focus and text caret         |
| link       | `#2563EB` | `--verto-link`              | Text links and Agent citations        |
| success    | `#16A34A` | `--accent-green`            | Positive state, added diff            |
| warning    | `#D97706` | (`warning`)                 | Warning banner, cautions              |
| error      | `#DC2626` | (`error`)                   | Error state, removed diff             |

Dark palette — the same semantic roles, declared on `.dark`:

| Role | Hex | CSS variable |
| --- | --- | --- |
| canvas | `#0b0d10` | `--verto-canvas` |
| surface | `#111317` | `--verto-surface` |
| subtle | `#161a1f` | `--verto-surface-subtle` |
| border | `#262b31` | `--verto-border` |
| border-soft | `#1c2127` | `--verto-border-soft` |
| text | `#e6e7ea` | `--verto-text` |
| secondary | `#9ca3af` | `--verto-text-secondary` |
| muted | `#8b949e` | `--verto-muted` |
| hover | `#1e232a` | `--verto-hover` |
| active | `#262b31` | `--verto-active` |
| link | `#8ab4ff` | `--verto-link` |

Focus inherits the light focus token in dark. The global palette also reaches
Radix portals outside the shell, so filters, Agent context and history use the
same theme as their owning surface. Legacy `--vx-*` page colors alias these
semantic values; route modules consume `--verto-*` directly.

Rules:

- Light mode is the reference direction. Dark mode must preserve the same hierarchy and WCAG contrast, using the same-language cold ramp, and should not introduce a second visual language.
- Focus, links and interactive accent are separate tokens. Focus stays
  `#2563EB`; text links and Agent citations use `--verto-link`, which adjusts
  for dark backgrounds.
- Warning is `#D97706` everywhere in this document and in code. Do not use the older amber.
- The only non-token fill allowed is the workspace gradient-mark 23px (23px mark exception). No other decorative fills.

Mail adds a scoped state accent (`--mail-state-accent`: `#2563EB` in light,
`#8ab4ff` in dark) for Compose/Send, current folders and unread state. Selected
rows mix that accent at 8% into their surface. Sender initials use stable
identity tones (`--mail-avatar-blue: #365fa4`, `--mail-avatar-teal: #167268`,
`--mail-avatar-amber: #94651d`, `--mail-avatar-rose: #a34270`); their tinted
background and ink adapt to the current surface/text tokens. These colors
identify senders and message state; they do not change the shared Sidebar palette.

---

## 3. Typography

Two bundled local families, loaded via `next/font/local` in
[`app/layout.tsx`](app/layout.tsx):

- **Sans:** Inter (`--font-hanken`). Used for all UI and body text.
- **Mono:** JetBrains Mono (`--font-jbmono`). Used for code, diff, editor
  source, tabular numerics.

Type authority is Inter + JetBrains Mono kept. DM Sans is explicitly rejected. Rationale: bundled-local avoids a CDN dependency, preserves offline use, and avoids CJK breakage where a remote display face lacks glyph coverage. Keeping the two bundled families also keeps the existing antialiasing and metric behavior stable.

Type ramp used across boards:

| Role                | Size    | Weight  | Notes                            |
| ------------------- | ------- | ------- | -------------------------------- |
| Route H1            | 22px    | 650     | Shared header; 28px line-height, 20px at narrow width |
| Page subtitle       | 12–14px | 400/500 | Muted color                      |
| Card title (H2)     | 15–16px | 650–700 | Body cards, results              |
| Card body           | 12.5–13.5px | 400 | Muted default                    |
| Meta / timestamp    | 11.5–12px | 500    | `--text-light` or `--text-muted` |
| Reader H1           | ~32px   | 700     | Inside document reader           |
| Reader body         | ~15px   | 400     | 1.75 line-height                 |

Mail uses an intentional compact hierarchy inside the approved Inter world:
save status (10px), timestamps and recipient details (11px), labels, grouped
reply actions, previews and form fields (12px), senders and internal headings
(13px), reading and composing text (14px), message subject (17px), and route
title (20px). Primary Mail controls use 12px. At the smallest
container width, grouped reply actions use 10px and the explicitly labeled
Sample inbox badge alone uses 9px. These are Mail surface steps observed in
`MailWorkspace.module.css`; they do not replace the shared type roles.

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

**Radius scale** — extended v2, fully enumerated:

`0 · 2 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 12 · 14 · 18 · 24`.

Kept from v1: `0 · 2 · 4 · 6 · 8 · 12 · 18 · 24`. Added in v2: `5 · 7 · 9 · 10 · 14`. Pills use `999px` (fully rounded), never a large numeric radius. `22` is forbidden except as an explicitly rejected value, do not use it. The full allowed set is therefore `0, 2, 4, 5, 6, 7, 8, 9, 10, 12, 14, 18, 24, 999`.

**Elevation** — flat by design, three levels only:

- Card: none. A `1px var(--border)` outline is the elevation. Never combine card fill + card shadow + card border. Pick one.
- Menu / popover / dropdown: `0 12px 32px rgb(23 23 21/8%)` with `0 2px 6px rgb(23 23 21/5%)` as the secondary lift where the reference pack shows it.
- Modal / dialog: `0 20px 60px rgba(0,0,0,.18)` matches the reference pack.

Rules:

- accent/focus split applies to elevation as well: focus rings use `#2563EB` at `2px + 1px offset`, they are not shadows.
- The workspace gradient-mark 23px (23px mark exception) is the only allowed decorative fill, and it is confined to the 23px mark. No other surface uses a fill beyond the cold neutrals.

---

## 5. App shell anatomy

Canonical desktop shell and Reader geometry — v2:

| Region           | Width         | Notes                                    |
| ---------------- | ------------- | ---------------------------------------- |
| Primary nav      | 56+232 collapsible | Fixed 56 rail + 232 panel, collapsible to 56 alone |
| Native title bar | 44px          | Native runtime only; Web reserves 0px     |
| Top bar          | 56px          | Breadcrumbs and sparse page utilities (was 48) |
| Document tabs    | 40px          | Open local documents; Reader only        |
| Reader article   | ≤760px        | Primary visual object                    |
| Floating TOC     | 218px         | Visible from 1440px; compact below — kept |
| Agent            | Main surface  | Standalone `/agent`; no persistent right panel |
| Wide page frame  | ≤1240px       | Dense multi-column product surfaces — ceiling kept |
| Standard frame   | ≤1184px       | Sources, Settings, Tags, and Bookmarks   |
| Narrow frame     | ≤920px        | Onboarding and focused utility pages     |
| Home workspace   | ≤1184px       | One reading object, flat rows and compact RSS summary |
| Mobile rail      | Sheet         | 390px layouts use the same nav hierarchy |

Shell notes: `56+232` is the double-rail total (56 rail + 232 navigation panel). Collapsed state is 56 alone. Topbar is 56 (was 64+48 in earlier drafts). Frame ceiling stays 1240 and TOC stays 218. The main surface reaches the viewport's right edge. The 56+232 anatomy is the baseline approved after the fence interview. Web has no native title bar; the 44px native height is conditional on the desktop runtime.

Rules:

- The workspace rail offers Home, Search, Recent, Library, Mail, and Sources.
  Theme and Settings sit in the utility area. Mail opens a dedicated mailbox
  workspace for reading and plain-text composition, with optional send consent;
  the RSS Inbox remains a separate product surface.
- The expanded navigation panel keeps the Verto workspace identity, Search,
  and real Home/RSS Inbox/Mail/Recent and workspace destinations visible on
  every route. The current route's content tree follows below those links.
  Planned destinations stay visibly unavailable until they have a working page.
- Titlebar tabs represent workspaces or sources. Document identity belongs in
  the dedicated Document Tabs band and must not be repeated in the Titlebar.
- A page's own tabs live BELOW the top bar and ABOVE the two-column split (see
  `/search` layout). Never inline extra buttons into the search input row.
- Page identity, tabs, body, loading, and error states use the same
  `PageFrame` size. Route modules own vertical rhythm and responsive gutters;
  they must not introduce a second competing max-width.
- Workspace pages use one content sequence: page identity (title, short
  purpose, and at most one primary action), optional views and filters, inline
  status, then the task surface. The title and body align to a 32px desktop
  gutter inside the same frame. Route layouts respond to the available main
  content width. Agent mounts only on its own route, with no background source fetch on other pages.
- The shared route title is `22px / 650` with a `28px` line-height. Its
  subtitle is `13px / 20px`; desktop header padding is `24px 32px 20px`.
  Compact route actions, views and tools lead into flat rows or a reusable
  reading object. Context is disclosed where needed.
- Theme and product actions live in the shared top bar. Route headers show
  only actions that belong to that route; they do not repeat global utilities.
- Full workbenches such as Editor may keep a fluid frame. A focused route must
  choose `standard` or `narrow` explicitly rather than relying on the fluid
  `PageHeader` default.
- Editor owns the remaining Shell height and does not introduce a second page
  scroll. Its desktop gutter is `20px`, its narrow gutter is `16px`, and the
  source surface stops growing at `960px` so long lines remain writable.
- Editor keeps Source / Preview as document views. Edit with AI opens a review
  disclosure beneath the document; it starts closed and reserves no side column.
  Review remains mounted so instructions, proposal, approval and revision-safe
  undo survive disclosure changes.
- Home is a returning-reader launch surface. One Continue Reading or Start
  Reading object leads the page, followed by flat recent-document and library
  section rows, then a compact RSS summary. Recent documents and sections can
  sit beside each other when the center has room and stack with available
  width. Home's compact Agent entry and the Product actions menu open the
  standalone Agent workspace. Reader Ask carries the real source and passage
  into a persisted document conversation; the source stays in this browser tab.
- Home identity and content share the same `1184px` frame and `32px` desktop
  gutter. The reading object, rows and RSS summary participate in one vertical
  scroll flow.
- Home shows source status only while opening or recovering a source. A ready
  banner must not repeat document and section counts already present in the
  identity header.

### Web workspace surfaces

- **Library / Notes:** one view band, compact search and a Filter popover,
  then the document list or shelf. Source context is a footer after results,
  with real connection and recovery actions. It does not consume a permanent
  aside. Notes lists Markdown notes from the active source and exposes a real
  New note action to Editor; it does not claim a notes hierarchy or a Web
  EPUB/PDF import interface. Planned destinations such as Tasks remain
  visibly unavailable.
- **Search:** the query row contains the query input, clear action and
  shortcut hint. The following control band owns scope tabs, Ask Agent and
  Filters. Results occupy one column; Filters opens a drawer. Ask Agent keeps
  the query and scope in its handoff to the Agent route.
- **Mail:** folder navigation, loaded message rows and readable detail share
  the neutral row grammar. The compact account row and folder tabs lead into
  a 30% message list and broad reading pane with independent scrolling. Folder
  tabs, list and reader share one 12px outlined work surface with a thin divider
  between panes. The Mail topbar and identity band share a continuous surface
  and 20px desktop gutter. Search and reply tools align in a 65px control band.
  Compact 81px message rows retain sender, subject and preview, with stable
  colored initials avatars. Recognized service senders use local brand SVGs on
  white 40px/28px tiles, with 24px/18px marks and no change to the row rhythm.
  Personal addresses retain initials, including Gmail and Outlook users. Brand
  matching is a visual cue from the From address, never a verification badge;
  unavailable assets fall back to initials. The
  grouped reply actions align left; avatar and subject share the message header.
  The current address beside Mail opens one account switcher; management shows
  account-specific connection status, reconnect and disconnect actions. Multiple
  Gmail and Outlook mailboxes keep independent connections. All inboxes combines
  only incoming mail, names its account scope in the Sidebar, and replaces row
  preview copy with a compact owning-account label. Account folders remain scoped.
  Switching restores the account's filters, selected message, local draft and
  scroll position during the session. From is explicit in every draft; composing
  allows an intentional account change, while replies retain the receiving
  account. A draft's identity never follows a browsing switch implicitly.
  Expanded subjects, addresses, recipient details and long body URLs wrap within
  the reading pane. To/Cc/Bcc and Subject fields grow from one to three lines,
  then scroll locally. Long validation details are bounded by a local alert scroll
  area; Send remains visible in short desktop windows.
  Search
  filters loaded messages and combines with the Unread control; Load more and
  retry preserve provider paging. Unconfigured provider setup, configured but
  disconnected, connection error, loading, connected empty folder, no matches
  and no selected message retain distinct copy and recovery actions.
  Compose opens a dedicated draft in the pane; Reply, Reply all and Forward
  open a plain-text composer beneath the original message. While drafting,
  the original has its own bounded scroll area; fields scroll within the
  composer and its Send footer stays visible. To, optional Cc/Bcc,
  subject and body autosave in this browser for the current account. Local
  drafts is distinct from the provider's Drafts folder. Closing preserves a
  draft; discarding asks for inline confirmation. Browser storage failures and
  unreadable drafts show recovery copy instead of claiming a saved state.
  Connection starts with read access. Enable sending is a separate optional
  provider consent action; sending still requires the explicit Send mail action.
  Pending sends disable duplicate submission, and an interrupted or uncertain
  result keeps the draft and asks the user to check Sent before retrying. A
  confirmed send reads the latest account draft store and removes only the
  delivered draft; failed local cleanup remains visible. Original attachments
  can be downloaded when the connector supports them. Rich text and outgoing
  file attachments are outside this iteration. `/mail?demo=1` explicitly labels
  its two sample accounts and simulated send, makes no provider calls, and shares the
  same workbench with Design Labs.
- **RSS Inbox:** article processing is primary. Manage feeds is an explicit
  disclosure containing subscription actions; it is not a permanent peer
  column. Selecting an article opens an inline reading preview with source,
  metadata, body or honest summary fallback, reading-state actions and Open
  original. Back to inbox restores list focus. Escape closes the preview only
  when a nested menu or dialog has not already handled dismissal.
- **Studio:** a `260px` insight list sits beside a substantial readable detail
  at desktop width. Saved content keeps its source, evidence and exact
  citation attached. The list and detail respond to the available center
  width; an empty Studio gives a real next action.
- **Agent:** the standalone route owns the full main workspace,
  `56px` conversation header, flat message stream and composer. History and
  source context open in popovers. The multiline textarea grows to `160px`,
  uses Enter to send and Shift + Enter for a new line, and respects active IME
  composition. Readiness, grounded citations, preview/approval and reversible
  undo remain part of the same conversation flow.

---

## 6. Component primitives

shadcn/Radix supplies behavior and accessibility; Verto tokens and page
modules supply visual character. When a component is missing here, extend the
shared primitive before creating a route-specific interaction.

| Primitive | Runtime source | Anatomy |
| --- | --- | --- |
| Button | `components/ui/button.tsx` | Default, outline, ghost, destructive; icon + concise label |
| Tabs | `components/ui/tabs.tsx` | Radix keyboard model, one active panel |
| Dialog / Sheet | `components/ui/dialog.tsx`, `sheet.tsx` | Modal confirmation or narrow-screen panel, elevation `0 20px 60px rgba(0,0,0,.18)` |
| Popover / Dropdown | `components/ui/popover.tsx`, `dropdown-menu.tsx` | Anchored, dismissible transient action, elevation `0 12px 32px rgb(23 23 21/8%)` |
| Tooltip | `components/ui/tooltip.tsx` | Label for compact rail and icon-only controls |
| Page frame | `components/layout/PageFrame.tsx` | Shared wide (≤1240), standard, narrow, or fluid horizontal boundary |
| Page header | `components/layout/PageHeader.tsx`, `PageHeader.module.css` | Shared 22px/650 title, subtitle, sparse route tools, 32px desktop gutter |
| System state | `components/layout/SystemState.tsx` | Honest loading, empty, unavailable, and recovery copy |
| Document tabs | `components/layout/DocumentTabs.tsx` | Roving keyboard focus, Delete to close, local persistence |
| Agent workspace | `components/agent/AgentWorkspace.module.css` | Standalone conversation header, progressive history/context, messages and multiline composer |
| Mail workbench | `components/mail/MailWorkspace.module.css` | Folder tabs, independent message list/reading scroll, flat rows and plain-text inline or dedicated composer |
| Page modules | `components/*/*.module.css` | Thin border, neutral surface, route-specific information layout, card none |

Rules:

- Do not create a card simply to group adjacent content. Use spacing and a
  divider first; a border must communicate a reusable object or state. Cards are flat, no shadow (card none).
- Icon columns and preview panels are reserved for information that cannot be
  scanned from title, source, and metadata alone.
- Segmented "Grid/List" view toggles must correspond to real behavior. If
  the second view mode is not implemented, do not render the toggle.
- Interactive color, focus and links are separate concerns. Focus uses
  `--verto-focus`; links and Agent citations use `--verto-link`.
- The only allowed decorative fill is the workspace gradient-mark 23px (23px mark exception).

---

## 7. State inventory (per surface)

Every real product surface has these states unless otherwise noted:

- **default**  — populated with real data
- **empty**    — no content, actionable next step visible
- **loading**  — skeleton preserving layout
- **error**    — recoverable, with retry
- **read-only** / **archived** (for documents)

Product states are exercised through the real routes and local state stores.

---

## 8. Sample data policy

The bundled `content/demo.mdx` is an explicit included demo, not invented user
activity. Runtime routes otherwise derive content, reading state, collections,
and Agent context from the active source and local stores.
Mail additionally offers an explicitly selected Sample inbox at `/mail?demo=1`.
It uses example addresses and messages in the production workbench, also used
by Design Labs; Send preview simulates delivery and says that no email was sent.

Rules:

- Do not seed representative user activity, fake sync state, or fabricated
  source citations.
- Empty products render an honest empty state with a real next action.
- Tests may construct fixtures locally, but production components must not
  import test fixtures or design-reference data.

---

## 9. Maintained constraints and debt

- **CSS ownership:** `app/redesign.css` owns the global semantic palette and
  still-active cross-page compatibility layers. Agent's workspace, popovers,
  messages and composer are now module-owned; Search, RSS Inbox, Mail and
  Library also own their route layouts in CSS modules. Reader prose and
  runtime-generated document styles retain global layers.
- **Dark mode:** both themes keep the same cold neutral hierarchy. The Web
  finish review visually inspected Library and its filter disclosure in dark;
  full dark-route visual coverage remains outstanding.
- **Web finish acceptance:** the independent review's disposition is ship
  after the Search action-placement correction. Its captures cover light
  desktop at `1207 × 1244` and `1440 × 900`, plus the two dark Library states.
  They show the real included demo, empty Notes/RSS/Studio, Mail setup and
  disabled Agent pane/page with source disclosure. Populated Mail, RSS article
  detail, saved Studio insight detail, Agent messages/citations, long content,
  loading/error transitions, every dark route and mobile/native layouts were
  not visually approved by those captures. Separate behavior verification
  includes the Search handoff and nested RSS Escape dismissal; it does not
  expand visual acceptance.
- **Agent placement update:** the user subsequently removed the right panel.
  Home, Mail, Reader, Editor disclosure and standalone Agent were checked in
  the live Web preview at `1280 × 720`. Reader must fill the available main
  height; legacy shell grid rows must not clip its scroll viewport. Provider
  setup/unavailable states remain the visual truth for Agent. Mail's later
  workbench extension has the scoped coverage below.
- **Mail workbench extension:** an ordinary extension of the approved Sidebar
  world, with the same cold neutral palette, Inter and flat depth. Captures in
  `.impeccable/review/` cover the explicit Sample inbox: light and dark reading
  at `1280 × 720` (`mail-workbench-light.jpg`, `mail-workbench-dark.jpg`), light
  dedicated composition and inline reply at `1280 × 720`
  (`mail-workbench-compose.jpg`, `mail-workbench-reply.jpg`), dark reading at
  `1207 × 1244` (`mail-workbench-user-1207.jpg`), light reading at `900 × 600`
  (`mail-workbench-narrow.jpg`), and light mobile reading at `390 × 844`
  (`mail-workbench-mobile.jpg`). Source inspection confirms local drafts,
  separate send consent, pending/uncertain delivery handling, and retained
  connection, error, retry, paging and loaded-message search behavior; these
  captures do not approve every transition. Live OAuth account and provider
  delivery verification remains outstanding because provider configuration is
  absent. The independent finish review requested subject ellipses and this
  documentation correction; its final verdict scored both fixes resolved with
  disposition `ship`, scoped to those two corrections. This
  evidence is not a whole-product visual pass.

---

## 10. Verification protocol

### Mail local library extension

Saved-mail search keeps the approved list search field and adds a compact folder /
all-saved scope selector in the existing list header. The existing list footer
shows saved count, sync state and last-sync time. Per-account cache removal lives
in Manage accounts with an inline confirmation and keeps local drafts. These
controls reuse the existing cold neutral and blue active-state tokens, with no
new page framing or persistent side panel. Verification is scoped to Mail; live
OAuth account setup and real provider delivery remain outside the sample preview.
Light and dark search/reading captures are saved in
`.impeccable/review/mail-local-light.jpg`, `mail-local-dark.jpg`, and
`mail-local-final.jpg` at the browser's default `1280 × 720` viewport. The scoped
30-test browser regression covers persisted full bodies, offline search, account
isolation and clearing, secure offline reload, navigation without a service worker,
and retained Mail draft/account flows. This does not constitute a whole-product pass.

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
6. Visually confirm hierarchy, cold token use, CJK wrapping, focus states
   (accent/focus split with #2563EB), and that no new card layer competes with the document. Cards are flat (none), menus use `0 12px 32px rgb(23 23 21/8%)`, modals use `0 20px 60px rgba(0,0,0,.18)`.
7. Confirm shell is 56+232 collapsible with topbar 56, TOC stays 218 and frame ceiling stays 1240. No route reserves a right Agent column; standalone Agent owns its 56px conversation header.
8. Confirm radius uses only `0 · 2 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 12 · 14 · 18 · 24 · 999` and that 22 is rejected, and that the only decorative fill is the workspace gradient-mark 23px (23px mark exception).
9. Confirm warning is `#D97706` and that accent/focus split is applied.

---

Maintained by the redesign engineering pass. When you add a new token, size,
component, or accepted gap, update this file BEFORE the code.
