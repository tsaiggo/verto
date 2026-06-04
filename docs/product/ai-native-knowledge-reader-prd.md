# Verto AI-Native Knowledge Reader PRD

## 1. Executive Summary

Verto 将从一个 MDX-first reader 演进为 **AI-native 的个人阅读与知识库工作台**：用户可以阅读和管理 MDX、Markdown、HTML、RSS、EPUB、读书笔记与知识库内容，并用 AI 做摘要、纪要、关联、复盘和知识重组。目标不是把 Verto 做成 CMS 或编辑器，而是打造一个“内容摄取 → 沉浸阅读 → 笔记摘录 → AI synthesis → 知识库沉淀”的本地优先阅读系统。

## 2. Positioning

### Geoffrey Moore Positioning

**For** heavy readers, builders, researchers, students, engineers, founders, and knowledge workers

**that need** a unified place to ingest articles, books, documentation, notes, and long-form knowledge without losing ownership of their files

**Verto**

**is an** AI-native personal knowledge reader

**that** turns MDX / Markdown / HTML / RSS / EPUB content into a searchable, readable, summarizable, and linkable personal knowledge library.

**Unlike** generic read-it-later apps, RSS readers, ebook apps, or note-taking tools,

**Verto provides** a file-first, local-friendly reader where original content, reading notes, AI summaries, and knowledge cards live together and remain portable.

### Product Promise

> Bring every serious thing you read into one AI-native library, then turn reading into reusable knowledge.

### Product Category

Primary category: **AI-native personal knowledge reader**

Adjacent categories:

- Read-it-later app
- RSS reader
- EPUB reader
- Markdown / MDX knowledge base reader
- AI research assistant
- Personal knowledge management workspace

## 3. Problem Statement

### Who has this problem?

Primary users are people who read to think and build:

- Engineers reading docs, RFCs, blog posts, specs, and code-adjacent knowledge
- Founders and product builders tracking market signals, essays, research, and user notes
- Researchers and students reading papers, books, newsletters, and web archives
- Writers and knowledge workers turning reading into notes, outlines, and reusable insights

### What is the problem?

Their reading inputs are fragmented across too many places:

- RSS apps for feeds
- Browser tabs and bookmarks for HTML articles
- Kindle / Apple Books / local files for EPUBs
- Obsidian or folders for Markdown notes
- GitHub repos or file systems for docs and MDX knowledge bases
- LLM chats for summaries that are detached from the source

As a result, reading and knowledge work become disconnected. Users can read, summarize, and take notes, but they struggle to keep original sources, highlights, summaries, and follow-up thinking in one durable library.

### Why is it painful?

- **Context loss:** AI summaries live in chat history, disconnected from the article/book/note they summarize.
- **Fragmented retrieval:** Users remember reading something but cannot find whether it was in an RSS feed, a saved HTML page, an EPUB, or a Markdown vault.
- **Weak synthesis:** Existing readers help consume content but rarely help connect one piece of reading to prior notes or knowledge bases.
- **Poor ownership:** Many tools store content in proprietary systems; Verto should keep the source files and generated notes portable.
- **No unified reading state:** Continue reading, unread/read status, notes, summaries, and collections are scattered.

## 4. Target Users & Personas

### Primary Persona: Knowledge Builder Kai

- **Role:** Engineer / founder / researcher who reads deeply and writes from what they read
- **Inputs:** Engineering docs, blog posts, RSS feeds, PDFs/EPUBs, Markdown notes, GitHub-hosted knowledge bases
- **Goals:** Build a long-term knowledge library; summarize quickly; connect new reading to old notes; retrieve insights later
- **Pain points:** Too many reading surfaces; AI output is not saved with sources; bookmarks are not knowledge
- **Current behavior:** Uses browser tabs, RSS, Obsidian, GitHub repos, ChatGPT/Claude, and local files separately

### Secondary Persona: Serious Reader Mira

- **Role:** Student, writer, analyst, or book-heavy reader
- **Inputs:** EPUB books, newsletters, long articles, personal notes
- **Goals:** Read books/articles, extract notes, create chapter summaries, generate book notes
- **Pain points:** Ebook highlights and AI summaries do not become part of a reusable note system

### Tertiary Persona: Team Knowledge Maintainer Ren

- **Role:** Maintains docs, internal knowledge bases, or research collections
- **Inputs:** GitHub docs, MDX sites, Markdown repos, RSS sources, meeting notes
- **Goals:** Keep a navigable knowledge base and generate summaries/digests for others
- **Pain points:** Knowledge bases become stale; hard to summarize what changed or what matters

## 5. Jobs To Be Done

1. **When I discover useful content**, I want to save or subscribe to it, so I can read it later without losing the source.
2. **When I open Verto**, I want to continue where I left off, so reading feels continuous across sessions.
3. **When I read a long article or book**, I want AI to produce a useful summary and chapter-level notes, so I can understand and revisit it faster.
4. **When I highlight or write a note**, I want it attached to the source and also usable as a standalone knowledge artifact.
5. **When I ask a question**, I want answers grounded in my library, with citations back to the original content.
6. **When I review my reading**, I want daily/weekly digests and related-note suggestions, so I can synthesize across sources.

## 6. Solution Overview

Verto becomes a personal reading library with five connected surfaces:

### 6.1 Inbox

All newly imported or subscribed content arrives here before it is organized.

Supported future inputs:

- Local MD / MDX folders
- GitHub-hosted Markdown / MDX repositories
- HTML upload or web clipping
- RSS subscriptions
- EPUB upload
- OneDrive or other remote vaults

Inbox jobs:

- Review new items
- Mark read/unread
- Save to collection
- Generate AI summary
- Archive or delete

### 6.2 Library

The durable place for organized content and knowledge.

Library objects:

- Articles
- Books
- Documents
- Notes
- Knowledge cards
- Collections
- Feeds
- Sources

Library jobs:

- Browse by source, type, collection, tag, author, status
- Search original content, summaries, and notes
- Continue reading
- Manage reading state

### 6.3 Reader

The main reading experience.

Reader jobs:

- Render MDX / Markdown / HTML / EPUB chapters cleanly
- Show table of contents, breadcrumbs, prev/next
- Track reading progress and resume position
- Support focus mode, typography settings, and theme presets
- Create highlights, excerpts, and notes

### 6.4 AI Side Panel

AI should be grounded in the open content and eventually the whole library.

AI jobs:

- Summarize this document
- Summarize this section or chapter
- Extract key claims, questions, action items, quotes, and concepts
- Generate book notes or article notes
- Explain unfamiliar terms
- Find related notes/documents in my library
- Produce daily/weekly RSS digest

### 6.5 Knowledge Studio

The synthesis layer where reading becomes reusable knowledge.

Knowledge Studio jobs:

- Convert highlights into notes
- Convert article/book summaries into knowledge cards
- Merge multiple summaries into a theme brief
- Build reading lists and collections
- Review “related to what I already know” suggestions

## 7. Core Object Model

This is a product-level model, not final implementation detail.

```ts
interface ContentItem {
  id: string;
  title: string;
  sourceType: "mdx" | "markdown" | "html" | "rss" | "epub";
  sourceId: string;
  sourceName: string;
  author?: string;
  url?: string;
  path?: string;
  status: "unread" | "reading" | "read" | "archived";
  summary?: string;
  createdAt: string;
  updatedAt: string;
  lastReadAt?: string;
  readingProgress?: number;
  resumeLocation?: {
    kind: "scroll" | "heading" | "chapter" | "text-location";
    value: string;
  };
  tags: string[];
  collectionIds: string[];
}

interface Source {
  id: string;
  kind: "local" | "github" | "onedrive" | "rss" | "epub" | "html-upload";
  name: string;
  config: Record<string, unknown>;
  connected: boolean;
  lastSyncedAt?: string;
}

interface Note {
  id: string;
  contentItemId?: string;
  title?: string;
  body: string;
  kind: "highlight" | "reading-note" | "summary" | "knowledge-card" | "daily-digest";
  anchors?: Array<{
    contentItemId: string;
    quote?: string;
    location?: string;
  }>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

## 8. Story Map

### Activity 1: Capture / Ingest

- Connect local folder
- Connect GitHub repo
- Subscribe to RSS feed
- Upload EPUB
- Upload HTML or clip web page
- Normalize content into readable item

### Activity 2: Triage / Organize

- See new items in Inbox
- Mark unread / reading / read
- Assign tags and collections
- Archive irrelevant items
- Prioritize what to read next

### Activity 3: Read / Annotate

- Open content in reader
- Resume where left off
- Highlight passages
- Write reading notes
- Navigate chapters / headings
- Adjust reading mode

### Activity 4: AI Assist / Summarize

- Generate document summary
- Generate section/chapter summary
- Extract key ideas and quotes
- Ask questions grounded in source
- Generate daily RSS digest
- Generate book notes

### Activity 5: Synthesize / Reuse

- Convert highlights to notes
- Create knowledge cards
- Link related items
- Search across source + notes + summaries
- Export or reuse notes in writing/projects

## 9. MVP Proposal

### Near-Term MVP Goal

Validate Verto as a stateful AI-native reader, not just a static MDX site, by making the current MDX / Markdown library feel like a persistent reading workspace.

### Near-Term MVP Scope

1. **Library Home Refresh**
   - Add Continue Reading
   - Add a lightweight Inbox placeholder for newly discovered or recently added items
   - Add source/type/status filters

2. **Reading State**
   - Track recently opened document
   - Track read/unread/reading status
   - Persist locally in browser/desktop storage

3. **ContentItem abstraction for existing content**
   - Wrap current local/GitHub/OneDrive MD/MDX files as content items
   - Preserve static-first rendering for existing docs

4. **AI Summaries Attached to Content v0**
   - Save AI summary for current document
   - Show summary in AI side panel or metadata panel
   - Keep generated summary attached to the content item

### Next Expansion Candidates

These are intentionally sequenced after the reading-state foundation is in place.

1. **RSS v1**
   - Add RSS feed subscription model
   - Fetch feed items
   - Render RSS article as HTML/Markdown-like content
   - Mark items read/unread

2. **EPUB v1**
   - Upload EPUB file
   - Extract metadata and chapters
   - Render clean chapter content
   - Track book/chapter progress

### MVP Non-Goals

- Full EPUB parser with perfect book layout
- Full web clipper browser extension
- Collaborative/team features
- Sync service or cloud account system
- General-purpose note editor competing with Obsidian
- Fully automatic knowledge graph

## 10. Release Slices

### Release 0: Product Foundation

- Product direction PRD
- Define object model
- Define navigation model: Inbox / Library / Reader / AI
- Decide persistence approach for reading state and generated notes

### Release 1: Continue Reading + Library Status

- Recently read items
- Reading progress
- Read/unread/reading statuses
- Library home cards
- Local persistence

### Release 2: AI Summaries Attached to Content

- Generate summary for current item
- Save summary
- Regenerate summary
- Show summary history or latest summary
- Cite source sections where possible

### Release 3: RSS Inbox

- Add RSS source type
- Subscribe/unsubscribe feeds
- Fetch and normalize RSS items
- Inbox view for new feed entries
- Basic article reader for RSS item content

### Release 4: EPUB Import

- Upload EPUB
- Extract metadata and chapters
- Render chapters in reader
- Track book/chapter progress
- Generate chapter summaries

### Release 5: Knowledge Notes and Synthesis

- Highlights and reading notes
- Convert highlight to note
- Create knowledge card from source or summary
- Related items suggestions
- Digest generation

## 11. Key Feature Requirements

### 11.1 Inbox

User story:

> As a reader, I want all new articles/books/feed items to arrive in one Inbox, so I can decide what is worth reading and organizing.

Acceptance criteria:

- Shows items from RSS, uploads, and connected sources that are new/unread
- Allows mark as read/unread/archive
- Allows save to collection
- Shows source type and source name
- Supports sorting by newest, source, and unread

### 11.2 Continue Reading

User story:

> As a returning reader, I want Verto to show what I was reading last, so I can resume immediately.

Acceptance criteria:

- Tracks last opened item
- Tracks approximate progress
- Shows Continue Reading on home
- Opens item at last known location when possible
- Works for current MD/MDX docs first, then RSS/EPUB later

### 11.3 RSS Subscription

User story:

> As a knowledge worker, I want to subscribe to RSS feeds, so useful articles enter my reading workflow automatically.

Acceptance criteria:

- Add feed URL
- Validate feed
- Store source name and feed URL
- Fetch item title, link, author, published date, summary/content where available
- Show new items in Inbox
- Handle fetch errors gracefully

### 11.4 EPUB Upload

User story:

> As a serious reader, I want to upload an EPUB, so I can read books and generate chapter notes inside Verto.

Acceptance criteria:

- Upload EPUB file
- Extract title, author, cover if available
- Extract chapter list
- Render chapter content
- Track chapter progress
- Support book-level and chapter-level AI summary

### 11.5 AI Summaries and Notes

User story:

> As a reader, I want AI summaries saved with the source, so I can revisit what mattered without searching chat history.

Acceptance criteria:

- Generate summary for current content item
- Save summary as a Note linked to content item
- Display summary near reader or in AI panel
- Include generated timestamp and model/provider metadata when available
- Allow copy/export summary
- Do not overwrite user notes without confirmation

## 12. Success Metrics

### Primary Metric

**Weekly active reading sessions**

Reason: Verto should become a recurring reading workspace, not a one-off static site generator.

### Secondary Metrics

- Time-to-first-readable-source after install
- % users who resume via Continue Reading
- RSS feeds added per active user
- EPUBs uploaded per active user
- AI summaries generated per active user
- % summaries revisited or copied/exported
- Read/unread status usage

Measurement should respect the local-first promise: prefer opt-in telemetry, local-only analytics during dogfooding, or qualitative validation over mandatory cloud tracking.

### Guardrails

- Build/export should remain reliable
- Local-first / file ownership promise should not regress
- AI features should not require uploading entire private libraries by default
- Reader performance should stay fast for existing MDX docs

## 13. Technical Principles

1. **Local-first where possible**
   - Reading state and notes should work without a hosted backend in the desktop app.

2. **Source ownership**
   - Verto should not lock original content into a proprietary format.

3. **AI output is attached knowledge**
   - Summaries and digests should be saved as first-class notes, not transient chat.

4. **Static-first compatibility**
   - Existing MDX site generation should keep working.

5. **Runtime-mutable features are additive**
   - Reading state, saved notes, RSS refresh, and EPUB upload introduce mutable runtime behavior. These should land first in the desktop/Tauri experience or local browser storage while the static web build remains a reliable read-only subset.

6. **Provider abstraction**
   - Content ingestion should extend the existing ContentSource direction instead of creating one-off readers for every format.

7. **Clear privacy boundaries**
   - UI must explain what content is sent to AI providers and when.

## 14. Risks and Mitigations

### Risk: Product becomes too broad

Mitigation: Sequence through release slices. Do not build RSS, EPUB, notes, and full-library AI all at once.

### Risk: AI summaries are low quality

Mitigation: Start with structured outputs: TL;DR, key ideas, quotes, questions, action items. Let users regenerate and edit later.

### Risk: EPUB rendering complexity expands scope

Mitigation: Start with basic chapter extraction and clean text rendering; postpone perfect pagination and DRM-related concerns.

### Risk: RSS content is inconsistent

Mitigation: Normalize best-effort fields, preserve original link, and support partial content gracefully.

### Risk: Privacy concerns around AI

Mitigation: Make AI opt-in per item; show provider/model; avoid silently sending entire library context.

### Risk: Existing MDX reader gets neglected

Mitigation: Treat existing MDX/Markdown reader as the first supported content type in the new ContentItem model.

## 15. Open Questions

1. Should reading state and AI notes be stored in localStorage, Tauri app data, sidecar files, or a future database?
2. Should generated notes be exportable as Markdown files into the user's vault?
3. Should RSS fetching happen at build time, runtime desktop, or both?
4. Should EPUB upload be desktop-only first, or work in the browser build too?
5. Which AI providers should be supported beyond GitHub Models?
6. How should Verto cite AI answers: by heading, paragraph, text quote, or content location?
7. Should there be a separate Notes section, or should notes live inside Library item detail pages first?
8. Should HTML upload support arbitrary raw HTML, sanitized HTML, or conversion to Markdown?
9. Should Verto eventually support sync across devices, or stay local-first only?
10. Should product success be measured through opt-in telemetry, local dogfooding metrics, interviews, or another privacy-preserving approach?

## 16. Recommended Next Build

### Recommendation

Build **Continue Reading + Reading State v1** before RSS or EPUB.

Why:

- It upgrades the daily reader experience immediately.
- It creates the persistence layer needed for later Inbox, notes, and summaries.
- It is smaller than RSS/EPUB but foundational for both.
- It pairs naturally with the new first-run setup UI.

### Suggested User Story

> As a returning Verto user, I want the home screen to show the documents I recently read and where I left off, so I can resume reading without navigating the file tree.

### Suggested Acceptance Criteria

- Track opened document slug/path and timestamp
- Show “Continue Reading” on home for latest item
- Show “Recently Read” list for the last N items
- Persist locally
- Do not break static build
- Add tests for reading-state helpers

## 17. Working Backwards Press Release Draft

**Headline:** Verto introduces an AI-native reader for turning articles, books, docs, and notes into a personal knowledge library

**Dateline:** Taipei, Taiwan — Future date

Today, Verto announced a new direction for its MDX reader: an AI-native personal knowledge reader that helps people collect, read, summarize, and reuse long-form knowledge across Markdown, MDX, HTML, RSS, and EPUB content.

Serious readers today split their knowledge across RSS apps, ebook readers, browser tabs, Markdown folders, and AI chat history. Verto brings these workflows together in a local-friendly reader where original sources, reading progress, notes, AI summaries, and knowledge cards remain connected.

With Verto, users can subscribe to feeds, import books, read local knowledge bases, generate grounded summaries, and turn highlights into reusable notes. Instead of treating AI as a separate chat box, Verto attaches AI output directly to the content being read.

“Reading is not just consumption. For builders, researchers, and writers, reading is how knowledge compounds,” said the Verto maintainer. “Verto’s goal is to make every article, book, and note easier to revisit, connect, and turn into something useful.”

The first releases will focus on continue-reading workflows, saved AI summaries, RSS inbox, and EPUB import, while preserving Verto’s existing file-first MDX reading experience.

## 18. Decision Log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-06-05 | Position Verto as an AI-native personal knowledge reader | Expands from MDX reader toward content ingestion, reading state, notes, and AI synthesis |
| 2026-06-05 | Keep file-first / local-friendly principle | Preserves current Verto differentiation and user trust |
| 2026-06-05 | Start implementation with Continue Reading v1 | Foundational, user-visible, smaller than RSS/EPUB, enables later stateful features |
