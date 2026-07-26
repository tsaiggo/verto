// Search input box: query field, clear button, ⌘K hint, and Ask-AI link.
import type { Dispatch, RefObject, SetStateAction } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import PlatformShortcut from "@/components/layout/PlatformShortcut";
import type { SearchScope } from "@/lib/search";

interface SearchBoxProps {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  inputRef: RefObject<HTMLInputElement | null>;
  scope: SearchScope;
}

const SCOPE_PROMPT_LABEL: Record<SearchScope, string> = {
  all: "my active sources",
  page: "pages",
  heading: "headings",
  code: "code blocks",
  folder: "folders",
};

export function SearchBox({ query, setQuery, inputRef, scope }: SearchBoxProps) {
  const hasQuery = query.trim().length > 0;
  const agentPrompt =
    scope === "all"
      ? query.trim()
      : `Search ${SCOPE_PROMPT_LABEL[scope]} for "${query.trim()}" and cite the matching sources.`;
  return (
    <div className="search-box">
      <Search className="search-box-icon" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        className="search-box-input"
        placeholder="Search your library…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search your library"
      />
      {hasQuery && (
        <button
          type="button"
          className="search-box-clear"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
      <PlatformShortcut className="search-box-kbd" command="K" />
      <Link
        href={hasQuery ? `/agent?prompt=${encodeURIComponent(agentPrompt)}` : "/agent"}
        className="search-ask-link"
      >
        Ask Agent
      </Link>
    </div>
  );
}
