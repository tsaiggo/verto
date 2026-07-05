import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  FolderClosed,
  GitBranch,
  Hash,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Tags,
} from "lucide-react";
import SpecBoardHeader from "@/components/spec-board/SpecBoardHeader";
import SpecBoardSearchPrompt from "@/components/spec-board/SpecBoardSearchPrompt";

export const metadata = { title: "Library" };

const nav = ["Home", "Library", "Search", "Graph", "Knowledge Studio"];

const keyBehaviors = [
  [
    "Global Search",
    "Search across your entire library including content, notes, tags, collections, and sources.",
  ],
  [
    "Ask Your Library",
    "Ask questions about what you've read. Answers are grounded in your library.",
  ],
  [
    "Save to Collection",
    "Save any document, note, or card to a collection. Organize with one click.",
  ],
  [
    "Open Source Passage",
    "Jump to the exact passage in the original source for verification and context.",
  ],
  [
    "Graph Filters",
    "Refine the knowledge graph by source, tag, date, or collection to reveal patterns.",
  ],
  [
    "Related Knowledge",
    "Discover related summaries, cards, notes, and sources connected to this item.",
  ],
  ["Back to Source", "Every summary or card links back to the original document and passage."],
] as const;

const legendItems = ["Document", "Note", "Card / Summary", "Collection", "Source", "Tag"];

const continueCards = [
  ["The Design of Everyday...", "42%", "#bbf7d0"],
  ["Atomic Habits", "68%", "#fde68a"],
  ["Deep Work", "21%", "#bfdbfe"],
];

const recentRows = [
  ["Designing Data-Intensive Applications", "PDF", "20 min ago"],
  ["Building a Second Brain", "Note", "2 hr ago"],
  ["Hooked", "PDF", "Yesterday"],
  ["Influence", "PDF", "Yesterday"],
  ["The Pragmatic Programmer", "PDF", "2 days ago"],
];

const browseRows: {
  title: string;
  type: string;
  source: string;
  tags: string[];
  collection: string;
  updated: string;
}[] = [
  {
    title: "Designing Data-Intensive Applications",
    type: "PDF",
    source: "O'Reilly",
    tags: ["systems", "distributed"],
    collection: "Engineering",
    updated: "36 min ago",
  },
  {
    title: "Building a Second Brain",
    type: "Note",
    source: "Author",
    tags: ["productivity", "knowledge"],
    collection: "Personal",
    updated: "2 hr ago",
  },
  {
    title: "Atomic Habits",
    type: "PDF",
    source: "Penguin",
    tags: ["habits", "behavior"],
    collection: "Personal",
    updated: "5 hr ago",
  },
  {
    title: "Design Systems Handbook",
    type: "PDF",
    source: "Smashing",
    tags: ["design", "systems"],
    collection: "Design",
    updated: "Yesterday",
  },
  {
    title: "The Pragmatic Programmer",
    type: "PDF",
    source: "Addison-Wesley",
    tags: ["engineering", "best-practice"],
    collection: "Engineering",
    updated: "2 days ago",
  },
  {
    title: "Hooked",
    type: "PDF",
    source: "Portfolio",
    tags: ["behavior", "psychology"],
    collection: "Product",
    updated: "2 days ago",
  },
  {
    title: "Superforecasting",
    type: "PDF",
    source: "Crown",
    tags: ["forecasting", "decision"],
    collection: "Research",
    updated: "3 days ago",
  },
  {
    title: "Influence",
    type: "PDF",
    source: "HarperCollins",
    tags: ["psychology", "persuasion"],
    collection: "Research",
    updated: "3 days ago",
  },
  {
    title: "Lean UX",
    type: "PDF",
    source: "O'Reilly",
    tags: ["ux", "lean"],
    collection: "Design",
    updated: "4 days ago",
  },
  {
    title: "Range",
    type: "PDF",
    source: "Riverhead",
    tags: ["learning", "skills"],
    collection: "Personal",
    updated: "5 days ago",
  },
];

const studioCards = [
  ["Principles of Scalable Design Systems", "Design Systems"],
  ["Token Strategy for Production", "Design Systems"],
  ["Governance That Enables Teams", "Frontend Engineering"],
];

const tagRows = [
  ["design", 42],
  ["system", 36],
  ["research", 24],
  ["productivity", 22],
  ["ux", 18],
  ["engineering", 16],
  ["strategy", 12],
];

const recentActivity: [string, string][] = [
  ["You highlighted a passage in Designing Data-Intensive Applications", "2 min ago"],
  ["You added a note to Building a Second Brain", "1 hr ago"],
  ["You saved 3 items to Product Research", "3 hr ago"],
  ["You created a card from Atomic Habits", "Yesterday"],
  ["You tagged 2 documents with design", "Yesterday"],
];

const digestContinue: [string, string][] = [
  ["Designing Data-Intensive Applications", "64% complete"],
  ["Atomic Habits", "28% complete"],
];

const digestActivity: [string, string][] = [
  ["You highlighted 4 passages", "2 min ago"],
  ["You created a note", "1 hr ago"],
  ["You saved 1 card", "3 hr ago"],
];

const cardSources: [string, string][] = [
  ["Designing Effective Design Systems", "Kristina Halvorson · Apr 19, 2024"],
  ["Design Systems That Scale", "Nathan Curtis · Jun 12, 2024"],
  ["Figma Design System Best Practices", "Figma · Mar 26, 2024"],
];

const cardRelated = [
  "Token Strategy for Flexibility",
  "Governance That Enables Teams",
  "Component API Principles",
];

const collectionItems: [string, string][] = [
  ["Designing Effective Design Systems", "Kristina Halvorson · Apr 19, 2024"],
  ["Design Systems That Scale", "Nathan Curtis · Jun 12, 2024"],
  ["Figma Design System Best Practices", "Figma · Mar 26, 2024"],
  ["Component Library Audit", "Personal Note · May 5, 2024"],
];

const embeddedSearchResults = [
  [
    "Design Systems That Scale",
    "Nathan Curtis · Smashing Magazine",
    "A comprehensive guide to building design systems that grow with your organization.",
    "Jun 12, 2024 · Article · 12 min read",
    "star",
  ],
  [
    "Design Systems in the Wild",
    "The best design systems share common traits",
    "Clear foundations, consistent components, and strong documentation.",
    "May 8, 2024 · Note · 6 min read",
    "doc",
  ],
  [
    "Designing Effective Design Systems",
    "Kristina Halvorson · Smashing Magazine",
    "Practical advice for creating design systems teams love to use.",
    "Apr 19, 2024 · Article · 12 min read",
    "warn",
  ],
  [
    "Figma Design System Best Practices",
    "Figma",
    "How to structure your design system in Figma for maximum reuse.",
    "Mar 26, 2024 · Guide · 10 min read",
    "tag",
  ],
] as const;

const calloutItems = [
  ["Global Search", "Always available at top. Searches everything in your library."],
  ["Ask Your Library", "Ask questions and get answers grounded in your sources."],
  ["Save to Collection", "Save any item to a collection. Create new or add to existing."],
  ["Open Source Passage", "Jump to the exact location in the original source."],
  ["Graph Filters", "Filter the graph to reveal connections that matter."],
  ["Related Knowledge", "Discover connected cards, notes, and collections."],
  ["Back to Source", "Every summary and card links back to the original document."],
] as const;

export default function LibraryPage() {
  return (
    <section className="uhd05-library" aria-label="Library, Search and Knowledge Studio">
      <aside className="uhd05-spec-rail" aria-label="Board 05 key behaviors">
        <Link href="/" className="uhd05-spec-brand">
          <strong>V</strong>
          <span>Verto</span>
        </Link>
        <h1>05 — Library, Search &amp; Knowledge Studio</h1>
        <p>Your knowledge, organized, connected, and ready to use.</p>
        <div className="uhd05-spec-behaviors">
          <h2>Key behaviors</h2>
          {keyBehaviors.map(([title, description], index) => (
            <article key={title}>
              <span>{index + 1}</span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="uhd05-spec-legend">
          <h2>Legend</h2>
          {legendItems.map((item, index) => (
            <p key={item}>
              <span className={`tone-${index}`} />
              {item}
            </p>
          ))}
        </div>
      </aside>

      <header className="uhd05-spec-header">
        <span>Product design specification</span>
        <strong>Page 05 / 12</strong>
      </header>

      <aside className="uhd05-local-nav" aria-label="Library navigation">
        <div className="uhd05-local-brand">
          <strong>V</strong>
          <span>Library</span>
        </div>
        <nav>
          {nav.map((item) => (
            <Link
              key={item}
              href={
                item === "Search" ? "/search" : item === "Knowledge Studio" ? "/studio" : "/library"
              }
              className={item === "Home" ? "is-active" : ""}
            >
              {item === "Search" ? (
                <Search aria-hidden />
              ) : item === "Graph" ? (
                <GitBranch aria-hidden />
              ) : item === "Knowledge Studio" ? (
                <Sparkles aria-hidden />
              ) : (
                <FileText aria-hidden />
              )}
              {item}
            </Link>
          ))}
        </nav>
        <div className="uhd05-collections">
          <span>Collections</span>
          {["Product Research", "AI & ML", "Design Inspiration", "Personal"].map((item) => (
            <Link key={item} href="/collections">
              <FolderClosed aria-hidden />
              {item}
            </Link>
          ))}
          <button type="button" className="uhd05-nav-add">
            <Plus aria-hidden />
            Add collection
          </button>
        </div>
        <div className="uhd05-collections">
          <span>Tags</span>
          {["design", "research", "ai", "growth", "strategy"].map((item) => (
            <Link key={item} href="/search">
              <Hash aria-hidden />
              {item}
            </Link>
          ))}
          <button type="button" className="uhd05-nav-add">
            <Plus aria-hidden />
            Add tag
          </button>
        </div>
        <div className="uhd05-local-account">
          <span>A</span>
          <div>
            <strong>Alex Morgan</strong>
            <small>Free · 4.2 GB used</small>
          </div>
        </div>
      </aside>

      <main className="uhd05-library-main">
        <SpecBoardHeader
          className="uhd05-board-head"
          eyebrow="Home / Library Dashboard"
          eyebrowClassName="uhd05-kicker"
          title="Welcome back, Alex"
          description="Here's what's happening in your library."
          descriptionClassName="uhd05-board-sub"
        >
          <SpecBoardSearchPrompt className="uhd05-board-search" label="Search your library..." />
          <button type="button" className="uhd05-primary-button">
            <Plus aria-hidden />
            Ask your library
          </button>
          <button type="button" className="uhd05-icon-button" aria-label="More">
            <MoreHorizontal aria-hidden />
          </button>
        </SpecBoardHeader>

        <div className="uhd05-dashboard-grid">
          <section className="uhd05-card uhd05-continue">
            <div className="uhd05-card-head">
              <h2>Continue reading</h2>
              <Link href="/read">View all</Link>
            </div>
            <div className="uhd05-book-row">
              {continueCards.map(([title, progress, color]) => (
                <Link
                  key={title}
                  href="/read"
                  className="uhd05-book-card"
                  style={{ ["--book" as string]: color }}
                >
                  <span className="uhd05-book-cover" />
                  <div className="uhd05-book-meta">
                    <strong>{title}</strong>
                    <div className="uhd05-book-bar">
                      <span style={{ width: progress }} />
                    </div>
                    <span>{progress}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="uhd05-card uhd05-synthesis">
            <div className="uhd05-card-head">
              <div className="uhd05-synth-title">
                <h2>Today&apos;s synthesis</h2>
                <span className="uhd05-synth-badge">
                  <Sparkles aria-hidden />
                  Synthesis
                </span>
              </div>
            </div>
            <strong>Design Systems Create Compound Value</strong>
            <p>
              Across 8 sources, a clear pattern emerges: teams that invest in design systems
              compound consistency, speed, and shared vocabulary.
            </p>
            <small className="uhd05-synth-meta">Based on 8 documents · 13 key insights</small>
            <button type="button">Open in Knowledge Studio</button>
          </section>

          <section className="uhd05-card uhd05-recent">
            <div className="uhd05-card-head">
              <h2>Recent reading</h2>
              <Link href="/library">View all</Link>
            </div>
            {recentRows.map(([title, type, time]) => (
              <Link key={title} href="/read" className="uhd05-list-row">
                <FileText aria-hidden />
                <span>{title}</span>
                <em>{type}</em>
                <small>{time}</small>
              </Link>
            ))}
          </section>

          <section className="uhd05-card uhd05-quick">
            <div className="uhd05-card-head">
              <h2>Quick actions</h2>
            </div>
            {[
              "Add document",
              "Create note",
              "New collection",
              "Import from source",
              "Ask your library",
            ].map((item) => (
              <button key={item} type="button">
                <Plus aria-hidden />
                {item}
              </button>
            ))}
          </section>

          <section className="uhd05-card uhd05-activity">
            <div className="uhd05-card-head">
              <h2>Recent activity</h2>
              <Link href="/library">View all activity</Link>
            </div>
            {recentActivity.map(([text, time]) => (
              <div key={text} className="uhd05-activity-row">
                <Check className="uhd05-activity-check" aria-hidden />
                <span>{text}</span>
                <small>{time}</small>
              </div>
            ))}
          </section>

          <section className="uhd05-card uhd05-browse">
            <div className="uhd05-card-head uhd05-browse-title">
              <div className="uhd05-browse-titlewrap">
                <span className="uhd05-kicker">Library Browse</span>
                <h2>Library</h2>
              </div>
              <div className="uhd05-browse-controls">
                <div className="uhd05-filter-row">
                  {["Source", "Type", "Tag", "Status", "Collection", "Updated"].map((filter) => (
                    <button key={filter} type="button">
                      {filter} <ChevronDown aria-hidden />
                    </button>
                  ))}
                </div>
                <button type="button" className="uhd05-browse-clear">
                  Clear
                </button>
                <button type="button" className="uhd05-browse-saved">
                  Saved views <ChevronDown aria-hidden />
                </button>
                <div className="uhd05-view-toggle">
                  <button type="button" className="is-active" aria-label="Grid view">
                    <LayoutGrid aria-hidden />
                  </button>
                  <button type="button" aria-label="List view">
                    <List aria-hidden />
                  </button>
                </div>
              </div>
            </div>
            <div className="uhd05-table">
              <div className="uhd05-table-head">
                <span>Title</span>
                <span>Type</span>
                <span>Source</span>
                <span>Tags</span>
                <span>Collection</span>
                <span>Updated</span>
              </div>
              {browseRows.map((row) => (
                <Link key={row.title} href="/read" className="uhd05-table-row">
                  <span>
                    <span className="uhd05-row-thumb" aria-hidden />
                    {row.title}
                  </span>
                  <em>{row.type}</em>
                  <em>{row.source}</em>
                  <div className="uhd05-row-tags">
                    {row.tags.map((tag) => (
                      <em key={tag}>{tag}</em>
                    ))}
                  </div>
                  <em>{row.collection}</em>
                  <small>{row.updated}</small>
                </Link>
              ))}
            </div>
            <footer className="uhd05-browse-foot">
              <span>1-10 of 248 items</span>
              <div>
                {[1, 2, 3, 4, "...", 25].map((page) => (
                  <button key={page} type="button" className={page === 1 ? "is-active" : ""}>
                    {page}
                  </button>
                ))}
              </div>
            </footer>
          </section>

          <section className="uhd05-card uhd05-search-panel" aria-label="Search results panel">
            <div className="uhd05-card-head uhd05-search-panel-head">
              <SpecBoardSearchPrompt
                className="uhd05-search-box"
                label="design systems"
                shortcut="⌘K"
              />
              <button type="button" className="uhd05-primary-button">
                <Plus aria-hidden />
                Ask your library
              </button>
            </div>
            <div className="uhd05-search-panel-tabs">
              {[
                "All 124",
                "Documents 72",
                "Notes 18",
                "Tags 12",
                "Collections 6",
                "Sources 16",
              ].map((tab, index) => (
                <button key={tab} type="button" className={index === 0 ? "is-active" : ""}>
                  {tab}
                </button>
              ))}
              <button type="button" className="uhd05-save-search">
                Save search
              </button>
            </div>
            <div className="uhd05-search-panel-body">
              <aside>
                <strong>Filters</strong>
                {["Type", "Source", "Tag", "Updated"].map((group) => (
                  <section key={group}>
                    <h3>{group}</h3>
                    {["Document", "Note", "Source"].map((item, index) => (
                      <p key={`${group}-${item}`}>
                        <span />
                        {item}
                        <em>{[72, 18, 14][index]}</em>
                      </p>
                    ))}
                  </section>
                ))}
              </aside>
              <div className="uhd05-search-panel-results">
                {embeddedSearchResults.map(([title, source, snippet, meta, tone]) => (
                  <article key={title}>
                    <span className={`tone-${tone}`} />
                    <div>
                      <h3>{title}</h3>
                      <strong>{source}</strong>
                      <p>{snippet}</p>
                      <small>{meta}</small>
                    </div>
                    <div className="uhd05-result-thumb">
                      <i />
                      <i />
                      <button type="button">Save</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <footer className="uhd05-search-panel-foot">
              <span>1-20 of 124 results</span>
              <div>
                {[1, 2, 3, 4, "...", 7].map((page) => (
                  <button key={page} type="button" className={page === 1 ? "is-active" : ""}>
                    {page}
                  </button>
                ))}
              </div>
            </footer>
          </section>

          <section className="uhd05-card uhd05-mini uhd05-bookmarks">
            <div className="uhd05-card-head">
              <h2>Bookmarks</h2>
              <Bookmark aria-hidden />
            </div>
            {[
              "Design Systems That Scale",
              "Prompt patterns are not just about...",
              "Component API principles",
            ].map((item) => (
              <Link key={item} href="/bookmarks">
                {item}
                <small>Apr 2025</small>
              </Link>
            ))}
          </section>

          <section className="uhd05-card uhd05-mini uhd05-tags">
            <div className="uhd05-card-head">
              <h2>Tags</h2>
              <Tags aria-hidden />
            </div>
            {tagRows.map(([tag, count]) => (
              <Link key={tag} href="/tags" className="uhd05-tag-row">
                <span>{tag}</span>
                <strong>{count}</strong>
              </Link>
            ))}
          </section>

          <section className="uhd05-card uhd05-mini uhd05-graph">
            <div className="uhd05-card-head">
              <h2>Graph view</h2>
              <GitBranch aria-hidden />
            </div>
            <div className="uhd05-graph-canvas" aria-hidden>
              {[
                "Components",
                "Design Tokens",
                "Design Systems",
                "Consistency",
                "Governance",
                "Team Velocity",
              ].map((node, index) => (
                <span key={node} className={`node-${index}`}>
                  {node}
                </span>
              ))}
            </div>
          </section>

          <section className="uhd05-card uhd05-studio-panel">
            <div className="uhd05-card-head">
              <div>
                <span className="uhd05-kicker">Knowledge Studio</span>
                <h2>Synthesis</h2>
              </div>
              <Link href="/studio">Open studio</Link>
            </div>
            <div className="uhd05-studio-grid">
              <article>
                <strong>Design Systems Create Compound Value</strong>
                <p>
                  Across 8 sources, design systems compound consistency, improve team velocity,
                  reduce rework, and create reusable product vocabulary.
                </p>
                <h4 className="uhd05-studio-insights-title">Key insights</h4>
                <ul className="uhd05-studio-insights">
                  <li>Strong foundations enable faster feature development</li>
                  <li>Component consistency improves UX and accessibility</li>
                  <li>Documentation and governance drive adoption</li>
                  <li>Design tokens create flexibility and maintainability</li>
                </ul>
                <div className="uhd05-studio-foot">
                  <small>8 sources · 12 insights · Generated May 12, 2025</small>
                  <button type="button">Regenerate</button>
                </div>
              </article>
              <div>
                <h3>Top cards</h3>
                {studioCards.map(([title, source]) => (
                  <Link key={title} href="/studio">
                    <Star aria-hidden />
                    <span>{title}</span>
                    <small>From {source}</small>
                  </Link>
                ))}
              </div>
              <div>
                <h3>Related collections</h3>
                {["Design Systems", "Frontend Engineering", "Product Research"].map((item) => (
                  <Link key={item} href="/collections">
                    <FolderClosed aria-hidden />
                    {item}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="uhd05-card uhd05-card-detail">
            <div className="uhd05-card-head">
              <button type="button" className="uhd05-back">
                <ArrowLeft aria-hidden />
                Back to card
              </button>
            </div>
            <div className="uhd05-detail-body">
              <h3 className="uhd05-detail-title">Principles of Scalable Design Systems</h3>
              <span className="uhd05-detail-meta">From 3 sources · Created May 12, 2025</span>
              <div className="uhd05-detail-grid">
                <div>
                  <h4>Summary</h4>
                  <p>
                    Scalable design systems are built on clear principles: consistency, modularity,
                    accessibility, and adaptability. These principles help teams ship faster and
                    maintain higher quality.
                  </p>
                  <h4>Sources</h4>
                  {cardSources.map(([title, meta], index) => (
                    <div key={title} className="uhd05-detail-source">
                      <span className="uhd05-detail-num">{index + 1}</span>
                      <div>
                        <strong>{title}</strong>
                        <small>{meta}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="uhd05-detail-related">
                  <h4>Related</h4>
                  {cardRelated.map((item) => (
                    <Link key={item} href="/studio" className="uhd05-detail-related-row">
                      <FileText aria-hidden />
                      <span>{item}</span>
                    </Link>
                  ))}
                  <button type="button" className="uhd05-detail-add">
                    <FolderClosed aria-hidden />
                    Add to collection
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="uhd05-card uhd05-collection-detail">
            <div className="uhd05-card-head uhd05-collection-head">
              <div>
                <h2 className="uhd05-detail-title">Design Systems</h2>
                <span className="uhd05-detail-meta">24 items · Updated 2 hr ago</span>
              </div>
              <button type="button" className="uhd05-share">
                <Share2 aria-hidden />
                Share
              </button>
            </div>
            <div className="uhd05-detail-body">
              <p className="uhd05-collection-desc">
                Research, articles, and notes on building and scaling design systems.
              </p>
              <div className="uhd05-collection-tabs">
                {["Items", "Cards", "Notes", "Highlights"].map((tab, index) => (
                  <button key={tab} type="button" className={index === 0 ? "is-active" : ""}>
                    {tab}
                  </button>
                ))}
              </div>
              {collectionItems.map(([title, meta]) => (
                <Link key={title} href="/read" className="uhd05-collection-item">
                  <FileText aria-hidden />
                  <div>
                    <strong>{title}</strong>
                    <small>{meta}</small>
                  </div>
                </Link>
              ))}
              <Link href="/collections" className="uhd05-collection-viewall">
                View all items
              </Link>
            </div>
          </section>

          <section className="uhd05-card uhd05-digest">
            <div className="uhd05-card-head">
              <h2>Daily / weekly digest example</h2>
              <Clock3 aria-hidden />
            </div>
            <div className="uhd05-digest-tabs">
              <button type="button" className="is-active">
                Daily digest
              </button>
              <button type="button">Weekly digest</button>
            </div>
            <div className="uhd05-digest-grid">
              <div className="uhd05-digest-main">
                <strong>Your daily digest</strong>
                <span className="uhd05-digest-date">May 12, 2025</span>
                <p>You read 3 items, created 2 notes, and saved 1 card.</p>
                <h3>Top insight</h3>
                <div className="uhd05-digest-insight">
                  <p>Design systems succeed when teams invest in foundations and iterate.</p>
                  <small>From: Design Systems That Scale</small>
                </div>
                <h3>Continue reading</h3>
                {digestContinue.map(([title, pct]) => (
                  <div key={title} className="uhd05-digest-continue">
                    <FileText aria-hidden />
                    <span>{title}</span>
                    <small>{pct}</small>
                  </div>
                ))}
              </div>
              <div className="uhd05-digest-side">
                <h3>Activity</h3>
                {digestActivity.map(([text, time]) => (
                  <div key={text} className="uhd05-activity-row">
                    <Check className="uhd05-activity-check" aria-hidden />
                    <span>{text}</span>
                    <small>{time}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="uhd05-card uhd05-empty">
            <div className="uhd05-card-head">
              <h2>Search empty & no results</h2>
            </div>
            <div className="uhd05-empty-grid">
              <div>
                <Search aria-hidden />
                <strong>Start your search</strong>
                <span>Search across docs, notes, tags, collections, and sources.</span>
              </div>
              <div>
                <span className="uhd05-empty-x">x</span>
                <strong>No results</strong>
                <span>Try different keywords, broader filters, or clear filters.</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      <aside className="uhd05-callouts" aria-label="Call-out anatomy and behaviors">
        <div className="uhd05-callout-title">
          <span>3</span>
          <strong>Call-out anatomy &amp; behaviors</strong>
        </div>
        {calloutItems.map(([title, description], index) => (
          <article key={title}>
            <span>{index + 1}</span>
            <div>
              <strong>{title}</strong>
              <p>{description}</p>
            </div>
          </article>
        ))}
      </aside>

      <footer className="uhd05-spec-footer">
        <span>Verto Design System v1.0</span>
        <span>Last updated: May 12, 2025</span>
        <span>Built for local-first knowledge work.</span>
        <button type="button">Light</button>
        <button type="button">Print</button>
      </footer>
    </section>
  );
}
