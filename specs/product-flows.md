# Verto product flows

This document is the route and interaction contract for the implemented product.
The committed [Agent interaction state board](../docs/product/agent-interaction-states.png)
documents the idle, working, cited-answer, approval, applied, and error states
used across Reader and the global Agent workspace.

## Primary surfaces

| Surface | Route | Primary responsibility |
| --- | --- | --- |
| Home | `/` | Resume reading and see recent local work |
| Library | `/library` | Browse and filter readable Markdown / MDX files |
| Reader | `/read/[...path]` | Read a document with Outline and source-grounded Agent |
| Editor | `/editor?slug=<path>` | Edit the current document or create a local draft |
| Agent | `/agent` | Reopen workspace and document-scoped conversations |
| Inbox | `/inbox` | Triage subscription items before reading |
| Search | `/search` | Search titles, headings, code, tags, and active sources |
| Collections | `/collections` | Group local documents without moving their files |
| Knowledge Studio | `/studio` | Review saved insights with source evidence |
| Sources | `/integrations` | Connect local or OS-synchronized folders and RSS |
| Settings | `/settings/[section]` | Configure files, reading, editor, AI, privacy, and shortcuts |
| Onboarding | `/onboarding/[step]` | Choose a folder, index it, optionally configure AI, and enter the workspace |

Secondary routes are `/tags`, `/bookmarks`, `/recent`, `/runtime/local`, and
`/help`.

## Canonical reading loop

1. Home or Library opens a document in Reader.
2. Reader keeps the document central, places Outline immediately to its right,
   and gives Agent the rightmost persistent surface on wide screens.
3. An Agent answer carries source citations. Activating a citation returns to
   its anchored passage, or recovers the closest matching excerpt if the
   original anchor has moved.
4. Any Agent file mutation is shown as a preview and requires explicit
   approval. The resulting receipt exposes safe Undo.
5. `Edit <document>` opens `/editor?slug=<path>` with that document, preserving
   the reading-to-editing context.

## Editor loop

1. Typing `/` opens the MD/MDX-aware component menu at the caret; on narrow
   screens it becomes a non-modal bottom tray.
2. A user may ask Agent for one focused edit to the current draft.
3. Verto displays the exact removed and added lines before changing the draft.
4. Approve applies only to the in-memory draft; Reject leaves it untouched.
5. Undo is available only while the approved result is still the current
   revision. Later human edits are never overwritten.
6. Saving to disk in Tauri, or downloading in the web build, remains a separate
   explicit action.

## Local-first source loop

1. Onboarding or Sources asks the operating system for a folder.
2. Verto indexes the local copy of `.md` and `.mdx` files.
3. OneDrive, Dropbox, and similar tools continue to own cross-device
   synchronization; Verto does not create a cloud copy.
4. Permission loss keeps metadata and explains how to reconnect without
   implying that user files were deleted.

## Agent scope and authority

- Reader conversations persist with a document scope and can reopen their
  source page from the global Agent history.
- Workspace Agent is read-only. File creation or editing is routed to Reader or
  Editor, where the user can review the exact change.
- AI is optional. If no provider is included or no key is configured, reading,
  search, editing, collections, and local file access remain available.
