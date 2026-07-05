import {
  Bookmark,
  Circle,
  FileText,
  Hash,
  MoreHorizontal,
  Plus,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import SpecBoardSearchPrompt from "@/components/spec-board/SpecBoardSearchPrompt";

export const metadata = {
  title: "Search Results",
  description: "Search across your library, notes, tags, collections, and sources.",
};

const filters = {
  Type: [
    ["Document", 72],
    ["Note", 18],
    ["Card / Summary", 12],
    ["Collection", 6],
    ["Source", 14],
  ],
  Source: [
    ["Smashing Magazine", 12],
    ["A List Apart", 9],
    ["NN/g", 7],
    ["O'Reilly", 6],
    ["Figma", 5],
  ],
  Tag: [
    ["design", 42],
    ["systems", 28],
    ["ai", 18],
    ["ux", 16],
    ["component", 14],
  ],
};

const results = [
  {
    title: "Design Systems That Scale",
    source: "Nathan Curtis - Smashing Magazine",
    kind: "System",
    snippet:
      "A comprehensive guide to building design systems that grow with your organization, including governance, tooling, and adoption strategies.",
    date: "Jun 12, 2024",
    meta: "Article - 12 min read",
  },
  {
    title: "Design Systems in the Wild",
    source:
      "The best design systems share common traits: clear foundations, consistent components, and strong documentation.",
    kind: "Preview",
    snippet:
      "Many teams use examples from mature systems to evaluate component coverage and workflow gaps.",
    date: "May 8, 2024",
    meta: "Note - 6 min read",
  },
  {
    title: "Designing Effective Design Systems",
    source: "Kristina Halvorson - Smashing Magazine",
    kind: "Warning",
    snippet:
      "Practical advice for creating design systems that teams love to use and that deliver real business outcomes.",
    date: "Apr 19, 2024",
    meta: "Article - 12 min read",
  },
  {
    title: "Figma Design System Best Practices",
    source: "Figma",
    kind: "Source",
    snippet:
      "How to structure your design system in Figma for maximum reuse, maintainability, and team collaboration.",
    date: "Mar 26, 2024",
    meta: "Guide - 10 min read",
  },
];

export default function SearchPage() {
  return (
    <section className="uhd05-search" aria-label="Search results">
      <aside className="uhd05-search-filters" aria-label="Filters">
        <div className="uhd05-search-filter-head">
          <strong>Filters</strong>
          <button type="button">Clear all</button>
        </div>
        {Object.entries(filters).map(([group, rows]) => (
          <section key={group} className="uhd05-filter-block">
            <h2>{group}</h2>
            {rows.map(([label, count]) => (
              <label key={label} className="uhd05-filter-check">
                <input type="checkbox" />
                <span>{label}</span>
                <em>{count}</em>
              </label>
            ))}
          </section>
        ))}
        <section className="uhd05-filter-block">
          <h2>Updated</h2>
          {["Any time", "Today", "Past 7 days", "Past 30 days", "Custom range"].map((label) => (
            <label key={label} className="uhd05-filter-check">
              <input type="radio" name="updated" defaultChecked={label === "Any time"} />
              <span>{label}</span>
            </label>
          ))}
        </section>
      </aside>

      <main className="uhd05-search-main">
        <header className="uhd05-search-head">
          <SpecBoardSearchPrompt
            className="uhd05-search-box"
            label="design systems"
            shortcut="⌘K"
          />
          <button type="button" className="uhd05-primary-button">
            <Plus aria-hidden />
            Ask your library
          </button>
          <button type="button" className="uhd05-icon-button" aria-label="Settings">
            <SlidersHorizontal aria-hidden />
          </button>
          <button type="button" className="uhd05-icon-button" aria-label="More">
            <MoreHorizontal aria-hidden />
          </button>
        </header>

        <div className="uhd05-search-tabs">
          {["All 124", "Documents 72", "Notes 18", "Tags 12", "Collections 6", "Sources 16"].map(
            (tab, index) => (
              <button key={tab} type="button" className={index === 0 ? "is-active" : ""}>
                {tab}
              </button>
            )
          )}
          <button type="button" className="uhd05-save-search">
            <Bookmark aria-hidden />
            Save search
          </button>
        </div>

        <div className="uhd05-result-list">
          {results.map((result, index) => (
            <article key={result.title} className="uhd05-result">
              <div className={`uhd05-result-mark tone-${index}`}>
                {index === 0 ? (
                  <Star aria-hidden />
                ) : index === 1 ? (
                  <FileText aria-hidden />
                ) : index === 2 ? (
                  <Circle aria-hidden />
                ) : (
                  <Hash aria-hidden />
                )}
              </div>
              <div className="uhd05-result-body">
                <h2>{result.title}</h2>
                <span>{result.source}</span>
                <p>{result.snippet}</p>
                <small>
                  {result.date} - {result.meta}
                </small>
              </div>
              <div className="uhd05-result-preview">
                <span />
                <span />
                <span />
                <button type="button">Save</button>
              </div>
            </article>
          ))}
        </div>

        <footer className="uhd05-search-foot">
          <span>1-20 of 124 results</span>
          <div>
            {[1, 2, 3, 4, "...", 7].map((page) => (
              <button key={page} type="button" className={page === 1 ? "is-active" : ""}>
                {page}
              </button>
            ))}
          </div>
        </footer>
      </main>
    </section>
  );
}
