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

**Verto is to MDX what Obsidian is to Markdown** — a reader-first knowledge
workspace that treats a folder of files as a first-class library.

Drop any collection of `.mdx` (or `.md`) files into `content/` and Verto
turns the folder into a navigable, statically-rendered site: file-tree
sidebar, table of contents, breadcrumbs, prev/next, and a rich set of
MDX block components — all pre-rendered at build time.

Verto is not a CMS: there is no database, no required frontmatter, and no
content lock-in. Your files are the source of truth; the file system *is* the
schema. The browser experience is reader-first, while the desktop app can also
open and save Markdown and MDX files from a folder you explicitly select. If
you can write MDX in VS Code, Obsidian, Cursor, vim, or Verto itself, your
content remains portable.

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

### Optional local workspace tools
- ✍️ **Desktop editing** — open a selected local Markdown/MDX file in Source or Preview mode and save it back to that folder
- 🤖 **Grounded AI** — connect a GitHub Models key in Settings to ask questions against your library; credentials stay on the device
- 📡 **RSS inbox** — subscribe to feeds and triage discovered items alongside your library

---

## 🚀 Quick Start

### Prerequisites

- 📦 **Node.js** 20.9 or higher (the minimum required by Next.js 16)

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
| `npm run typecheck` | TypeScript validation |
| `npm test` | Vitest suite |
| `npm run test:ui` | Playwright end-to-end suite |
| `npm run build:tauri` | Build the desktop static export (no installer) |
| `npm run package:local` | Build a local unsigned installer and report its SHA-256 |
| `npm run package:local:report` | Report existing local installers without rebuilding |

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
    │   ├── frontmatter.ts     → Shared frontmatter coercion
    │   ├── metadata.ts        → Shared title / description fallbacks
    │   ├── local.ts           → Filesystem source (default)
    │   ├── onedrive.ts        → OneDrive source (Microsoft Graph)
    │   └── index.ts           → Source selector (VERTO_CONTENT_SOURCE)
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

Desktop libraries also keep library-owned state beside the content in the
hidden `.verto/` directory. Bookmarks, collections, reading progress,
annotations, saved summaries, and Agent threads are restored from these JSON
files when the library opens and mirrored after changes. Existing browser-only
state is copied into the first selected library when no portable file exists;
web builds continue to use localStorage only.

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
## Web Mail

The desktop-width web sidebar has a separate **Mail** workspace. It connects
multiple Gmail and Outlook accounts, with an account switcher and combined inbox, and provides a folder list, message
list, plain-text reading view, attachment downloads, and read/unread, star,
archive and trash actions. Compose, reply and forward use local drafts;
sending requires **Enable sending** and an explicit **Send** click. Set either
or both public OAuth client IDs before building the web app:

    NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID=...
    NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID=...

These `NEXT_PUBLIC_` values are embedded at build time; changing them requires
a rebuild and redeployment. Use a fixed HTTPS origin for daily use, such as
`https://mail.your-domain.example`, or localhost during development. Google
requires HTTPS and rejects non-loopback raw IP origins; Microsoft permits plain
HTTP redirects only for localhost. A URL such as `http://192.168.1.20:3000`
is useful for previews but cannot serve as this OAuth deployment.
See [Google origin rules](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#javascript-origin-validation-rules)
and [Microsoft redirect rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url).

For Gmail, create a Google OAuth **Web application** client, enable the Gmail
API and register the exact authorized JavaScript origin, without `/mail`, a
query or a fragment. For localhost testing, register `http://localhost` and the
actual origin with its port, for example `http://localhost:3000`, as described
in [Google client setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid).
Configure the consent screen with `https://www.googleapis.com/auth/gmail.readonly`,
`https://www.googleapis.com/auth/gmail.modify` and, for sending,
`https://www.googleapis.com/auth/gmail.send`. Connect requests read access;
the first message action requests modify access for that same account;
**Enable sending** requests send access separately. Gmail's modify scope also
allows sending at the provider, but Verto keeps its explicit send gate.
Add allowed test users while the OAuth app is in Testing. Readonly and modify
are restricted scopes; public use may require [OAuth verification](https://developers.google.com/workspace/gmail/api/auth/scopes).

To enable Outlook, register a Microsoft Entra application that accepts both
organizational and personal Microsoft accounts. Add a **Single-page application**
redirect URI for each deployment, for example `http://localhost:3000/mail` and
`https://your-domain.example/mail`. Grant delegated Microsoft Graph `Mail.Read`
and `User.Read` permissions for connection, `Mail.ReadWrite` for message actions,
and `Mail.Send` for sending. ReadWrite and Send are requested separately, for
the connected account, when needed. The redirect is exactly `${window.location.origin}/mail`,
with no query or fragment; register it as SPA, not Web. Use the application's
client ID; do not add a client secret to the web build. Organizational policies
may require administrator consent.

Message changes appear after the provider confirms the action and Verto rereads
the full message and folder membership. A failed request leaves saved state
intact; if a confirmed change cannot be saved locally, sync again. Trash moves
to Gmail Trash or Outlook Deleted Items and can be recovered in the provider's
web app while its retention policy permits. There is no permanent-delete action.
Gmail Archive is a virtual view of messages without `INBOX`, `TRASH`, `SPAM` or
`DRAFT` labels, including eligible Sent messages; archiving removes `INBOX` and
retains custom labels. Outlook Archive is the mailbox's Archive folder.
An IndexedDB lease prevents two windows from updating the same message at once;
different messages can be updated independently. Abandoned leases expire. After
an interrupted action or lost confirmation, sync before trying the action again.

Mail is fetched directly from Gmail or Microsoft Graph in the browser. No mail
backend or client secret is required for this browser OAuth flow. Mailbox identities,
folders, plain-text bodies, attachment metadata and sync checkpoints are saved in
IndexedDB, independently for each account. Opening a folder shows saved mail first
and starts a background sync; **Sync messages** requests another round. Saved-mail
search covers full bodies, subjects and participants, within the current folder or
all saved folders of the selected account (or the selected combined inbox).

Initial folder sync saves all pages; later rounds use
[Gmail history](https://developers.google.com/workspace/gmail/api/guides/sync) and
[Microsoft Graph folder delta](https://learn.microsoft.com/en-us/graph/delta-query-messages).
New and updated messages are saved, and deleted/moved messages leave that folder's
local membership. Interrupted rounds resume from the last stored page. Expired
provider checkpoints trigger a new snapshot; previously saved membership remains
readable until that replacement completes. Folder counts and last-sync time show
what is saved, not a promise that the entire remote mailbox is available offline.
Only folders that have been opened and synced are searchable offline.

Saved bodies remain readable and searchable after disconnect or token expiry.
Attachment bytes are downloaded on demand and require a connection. **Manage
accounts → Clear saved mail** removes that account's mail cache, keeping local
drafts and OAuth authorization; the next explicit sync can download it again.
Storage belongs to the current browser profile and exact origin, not every device.
Clearing browser site data also deletes saved mail, local drafts and local sign-in state. Cache failures are shown in the
workbench. OAuth credentials are excluded from the local mail database.

The Mail shell is cached by a dedicated service worker for fresh offline reloads
on HTTPS or localhost. Plain HTTP LAN previews support reading/searching saved mail
while the page is open, but do not support service-worker offline reloads. The
worker caches the public Mail document and Next static assets only; it does not
cache provider requests, authentication callbacks or send requests. Sync runs
while the app is open and online; this is not a background server sync service.

Local compose, reply and forward drafts are saved separately in `localStorage`
for each account; quoted original text can be included. An IndexedDB transaction
coordinates edits and send leases across windows. Sending starts only after
its local reservation is saved; blocked or unavailable storage prevents an
unreserved send. Copy an unsaved draft before leaving the page.
Draft account moves commit both account lists in one write. A draft deleted or
moved in another window cannot be sent by its stale editor. Existing v1 draft
records remain readable; moved accounts use the `verto.mail.drafts.v2` envelope.

Gmail keeps its short-lived access token in memory. Reload or expiry requires
an explicit **Reconnect** click; startup never opens consent automatically.
This follows [Google's user-driven token renewal model](https://developers.google.com/identity/oauth2/web/guides/use-token-model#token_expiration).
Outlook uses MSAL session storage and silent token acquisition. A temporary
network failure offers a retry; an authentication error that requires interaction
asks for **Reconnect**. Cancelling extra action/send consent retains existing
read access and previously enabled permissions.
Disconnect clears the local Outlook token cache or revokes the current Google
grant while retaining the local mail cache. The feature is scoped to the web app; desktop Tauri mail support is not
configured by these browser OAuth settings.

The send connectors use Gmail's [MIME send API](https://developers.google.com/workspace/gmail/api/guides/sending)
and Microsoft Graph's [sendMail and reply APIs](https://learn.microsoft.com/en-us/graph/api/user-sendmail).
Replies preserve the original conversation where the provider supports it.
Attachment downloads use the existing read permission and exclude inline images.
Forwarding includes the original message text; attaching new files and forwarding original attachments
are not supported. A successful send response means the provider accepted the
request; delivery remains subject to the provider's mail service.

The explicit `/mail?demo=1` sample inbox uses the same workbench and requires
no provider setup. Preview sends are simulated and never call Gmail or Outlook.
Use `/mail?demo=1&local=1` to exercise local persistence and full-body search with
sample mail. Demo cache scopes are isolated from real accounts and are never
restored as real mailbox identities.
Local drafts are separate from the provider's Drafts folder. Pending sends lock
that account's draft across windows with a renewable lease; confirmed acceptance
removes the local copy even after navigation. An interrupted send, expired lease
or lost response does not prove failure: check Sent and the recipient before an
explicit retry. Verto never automatically resends. If local cleanup fails after
acceptance, it reports the retained draft as already sent.

Real OAuth and mailbox validation remains pending until client IDs, a fixed
origin and authorized test accounts are available. Run and record the
[Gmail and Outlook acceptance checklist](docs/mail-live-acceptance.md) before
calling the deployment ready for daily use. Demo and mocked tests do not validate
provider consent policies, live token expiry or actual delivery.

---
## AI Assistant

Verto can show an Ask AI panel for the document you are reading. The current
provider uses GitHub Models, an OpenAI-compatible inference endpoint. Verto
does not include GitHub sign-in: add a GitHub Models token manually in
Settings > AI & Agent.

Source builds leave the capability off by default. Official nightly and stable
desktop builds enable the GitHub Models capability, but requests remain blocked
until the user adds their own token in Settings. For a local or self-hosted
build, enable it with:

    NEXT_PUBLIC_VERTO_ASSISTANT=github
    NEXT_PUBLIC_VERTO_ASSISTANT_MODEL=openai/gpt-4o-mini

### Credentials and privacy

The assistant access key is stored only in the current device localStorage and
is sent only to the configured inference endpoint. The desktop app uses the
Tauri HTTP plugin for the request; it does not persist a GitHub identity or
OAuth token.

The Reader discloses whether it attached the full current page or only the
first 24,000 normalized characters. The workspace Agent likewise reports when
a static build attached only part of the available source library, so it does
not imply that unattached material was searched.

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

On macOS, local desktop builds need Apple's Command Line Tools. The desktop
build has been verified with that smaller toolchain; full Xcode is only needed
when you also develop an iOS target or use Xcode-specific release tooling:

```bash
xcode-select --install
```

### Build a local smoke-test installer

```bash
npm run package:local
```

The build generates its platform icon set automatically from the tracked
root `icon.png`. To regenerate it manually, run `npm run generate:tauri-icons`.
This command intentionally disables in-app updates and does not sign or
notarize the installer. It is for local QA only; macOS will flag it as
unverified, so do not send it to customers. Use the signed GitHub Actions
release workflow below for any externally distributed build.

Installers are written below `src-tauri/target/release/bundle/`. When the
build succeeds, the command prints every installer path, file size, and SHA-256
created or updated by that build and writes the same hashes to
`bundle/SHA256SUMS.txt`. Each invocation produces the bundle formats supported
by the current host operating system; native packages for another OS still
require that OS or the GitHub Actions release workflow. To inspect all existing
installers without recompiling Rust, run:

```bash
npm run package:local:report
```

`npm run tauri:build:unsigned` remains available as a compatibility alias.

### Releases & auto-update

Installers are hosted on **GitHub Releases** and the in-app updater
fetches its manifest from a release asset URL.

During development the checked-in updater configuration points at the rolling
`nightly` prerelease so builds from the development channel are immediately
testable:

```
https://github.com/tsaiggo/verto/releases/download/nightly/latest.json
```

The stable release workflow automatically overlays the updater endpoint with
GitHub's `latest` channel, so stable installers never inherit the rolling
nightly feed. GitHub's `/releases/latest/` path only resolves to a published,
non-prerelease release:

```
https://github.com/tsaiggo/verto/releases/latest/download/latest.json
```

`.github/workflows/release.yml` runs on every pushed `v*` tag, builds
on a macOS + Windows matrix using
[`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action),
signs and notarizes the macOS artifacts, uploads them to a draft Release,
and auto-generates `latest.json`. The matrix is deliberately serialized so
each platform is the sole writer to the draft Release at a time. Cut a release
with:

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

#### macOS distribution signing and notarization

Stable macOS downloads are signed with a **Developer ID Application**
certificate and notarized through App Store Connect. This is required for a
downloaded app to open without macOS treating it as unverified. A paid Apple
Developer membership is required for notarization; an Apple Development or
Apple Distribution certificate is not the direct-download certificate.

Create the Developer ID Application certificate in Apple Developer, export it
from Keychain Access as a password-protected `.p12`, and base64-encode that
file. Create an App Store Connect API key with Developer access, then save its
downloaded `.p8` key securely — Apple allows the private key to be downloaded
only once. The [official Tauri macOS signing guide](https://v2.tauri.app/distribute/sign/macos/)
has the step-by-step Apple-side setup.

Add these repository secrets under **Settings → Secrets and variables →
Actions**:

| Secret | Value |
|--------|-------|
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID Application `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | Password chosen when exporting the `.p12` |
| `KEYCHAIN_PASSWORD` | A new strong password used only for the ephemeral CI keychain |
| `APPLE_API_ISSUER` | App Store Connect issuer ID |
| `APPLE_API_KEY` | App Store Connect API key ID |
| `APPLE_API_KEY_CONTENT` | The complete contents of the downloaded `.p8` key |

The workflow imports the certificate into a temporary runner keychain, writes
the `.p8` key to a temporary file for notarization, and removes both after the
build. It derives the signing identity from the certificate, so no identity
string is stored as a secret. A stable release stops before bundling if any of
these secrets are missing; never put the `.p12`, `.p8`, updater private key,
or their passwords in Git, issues, or chat.

For an on-demand stable build, use **Run workflow** and enter the same `v*`
tag you intend to publish. The release is still created as a draft for manual
review and publication.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/tsaiggo">tsaiggo</a>
</p>
