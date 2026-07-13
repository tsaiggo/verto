# Reading companion — next delivery slice

## Product outcome

Make the reading companion feel like part of a document, not a separate chat:
the reader can select a passage, get a grounded response, return to its source,
and deliberately keep the useful result as a note.

## Current baseline

- Selection dispatches `verto:ask-ai`, opens the companion, and pre-fills a
  question with the quote.
- The companion reads the visible document and can search it, create a
  highlight note, and save a summary after confirmation.
- The full Agent workspace already has durable threads, but reader-companion
  turns are local React state and disappear on refresh.
- Responses are instructed to stay grounded, but they do not expose a
  clickable passage citation in the reader UI.

## Prioritized work

### P0 — one selected passage, one grounded answer

1. Extend the selection event with the document reference and a stable range
   anchor (`quote`, prefix, suffix, and offsets), rather than passing only a
   clipped string.
2. Make **Ask AI about this** open the companion with a visible quoted-passage
   card and send the focused question immediately. The composer remains
   available to refine a follow-up.
3. Return an answer citation that resolves to that passage or to a detected
   document section. Selecting the citation scrolls to and briefly focuses the
   source range.

**Acceptance:** a reader can select text, press Ask AI once, reload neither
the context nor the document, and see an answer tied to the exact selected
passage without an invented quote.

### P1 — keep useful conversations and notes

1. Store companion threads by document href/slug using the existing
   `agent-threads` store, keeping them distinct from broad workspace chats.
2. Restore the latest document thread when the companion opens; offer a clear
   **New conversation** action instead of silently mixing documents.
3. Add **Save answer to note**. It creates or appends an annotation with the
   selected quote as the anchor and the agent response as an `agent` turn.
   It must use the same explicit confirmation path as other writes.

**Acceptance:** after a refresh, the reader returns to the same document's
conversation; accepting a save produces one anchored annotation, while
declining produces no write.

### P2 — make the companion legible during long reading sessions

1. Show the source chip above every response that depends on a selection and
   a compact "Reading this document" state for document-wide questions.
2. Preserve scroll position and the selection reference when the desktop dock
   is collapsed and reopened.
3. Surface clear in-progress, missing-key, failed-request, and write-approved
   states without blocking the article.

**Acceptance:** readers can distinguish a response about a selected passage
from a document-wide response, and can recover from a failed run without
losing their draft question.

## Implementation seams

- `lib/ai/ask-event.ts` — carry the selection reference, not just `quote`.
- `components/reader/SelectionToolbar.tsx` and `AnnotationsLayer.tsx` — create
  a stable document anchor from the selected range.
- `components/reader/ChatColumn.tsx` and `components/assistant/AssistantPanel.tsx`
  — open, send, persist, restore, and render source chips.
- `lib/ai/context.ts` — provide section-aware context and citation metadata.
- `lib/agent-threads.ts` and `lib/annotations.ts` — document-scoped thread
  metadata and agent-authored annotation turns.

## Verification plan

- Unit-test selection anchors against repeated quotes and changed surrounding
  text.
- Exercise mock provider flows: answer, cited answer, accept save, reject save,
  reload restore, and new-document isolation.
- Desktop E2E at 1024, 1280, and 1440px: keyboard selection/Ask AI entry,
  citation return-to-source, dock resize/collapse, and no horizontal overflow.
