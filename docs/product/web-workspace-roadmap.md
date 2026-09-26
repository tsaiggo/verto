# Web knowledge workspace: delivery map

This is the web-first implementation path for Mail, RSS, EPUB/PDF reading,
notes, a personal knowledge library, tasks, and a persistent Agent. It extends
the existing [AI-native reader PRD](ai-native-knowledge-reader-prd.md). Mobile
layout is outside this sequence.

## Current baseline

| Area | Today | Next gap |
| --- | --- | --- |
| Mail | Gmail and Outlook read-only work is in draft PR #207 | Finish OAuth validation, then search, compose, and explicit save-to-library actions |
| RSS | Feed subscription, refresh, Inbox, and article reading exist | Make RSS a clear navigation destination and allow saving articles as library items |
| EPUB | Command-line conversion to MDX chapters exists | Browser import, book/chapter navigation, and persistent reading progress |
| PDF | No reader or import flow | Browser import, page navigation, text selection, and citations tied to page numbers |
| Notes | MDX editor, highlights, annotations, and saved summaries exist | A dedicated notes index, creation flow, backlinks, and source-linked notes |
| Knowledge library | Markdown/MDX, tags, collections, bookmarks, and search exist | One item model and search across documents, books, PDFs, RSS saves, and notes |
| Tasks | Checkable MDX list blocks exist | A standalone task list with status, due date, and optional source link |
| Agent | Full `/agent` workspace plus a document reader assistant exist | One persistent web pane across workspace navigation |

## Navigation and interaction

The left workspace rail should expose **Library**, **Mail**, **RSS**, **Notes**,
and **Tasks** as distinct destinations. Library is the common place for files,
saved articles, books, and documents. The right Agent pane stays mounted during
normal navigation; the `/agent` route expands that same conversation. Reading
and editing surfaces keep their specialized assistants until their document
actions can be integrated into the shared pane without losing context or write
review.

The Agent should only use sources the user deliberately attaches or opens.
Connecting Mail must not silently put private messages into the knowledge
index or Agent context. A user can explicitly save a message or excerpt as a
library item in a later Mail slice. Source links and citations must lead back
to the exact message, article, book chapter, or PDF page.

## Delivery slices

1. **Persistent Agent shell.** Keep one workspace conversation mounted while
   navigating Home, Library, Mail, RSS, Notes, and Tasks. Load source bodies only
   when the Agent becomes visible. Preserve the separate reader/editor actions
   for now. This is the first slice.
2. **Browser PDF and EPUB import.** Import local files without a server upload,
   store the binary in IndexedDB, and create library metadata. Render PDF pages
   and EPUB chapters, with TOC, progress, and a stable source reference for
   notes and citations. Keep the original file available for reopening.
3. **Notes and knowledge links.** Add Markdown-first notes with title, body,
   tags, backlinks, and links to source passages. Reuse existing annotations
   and summaries; show them together on an item's detail view. Extend search
   across notes and saved items.
4. **RSS to library.** Give subscriptions a dedicated rail destination, keep
   Inbox for unread feed items, and let users save an article as a durable
   library item with its feed and original URL retained.
5. **Tasks.** Add an independent task store and list with open/done state,
   optional due date, and a link to a note, mail message, or library item.
   Creating a task from selected content must keep the source reference.
6. **Mail actions.** After PR #207's read-only Gmail/Outlook connections are
   validated, add search and explicit save-to-library first. Compose, send,
   archive, and delete require separate reviewable interactions and OAuth
   scopes; they should not be bundled with reading.

## Shared object boundaries

Each imported or saved item needs a stable ID, type, title, origin, timestamps,
and a content reference. Notes and tasks keep their own IDs and optional source
references so changing a title does not break links. Browser storage should
hold large binary files separately from the small settings currently kept in
localStorage. Agent context should use the same stable references and record
which items were available for a given answer.

Each slice can ship independently behind its own route and data migration. The
shared item model comes before cross-format search or automatic knowledge
synthesis, so the later features can refer to sources reliably.
