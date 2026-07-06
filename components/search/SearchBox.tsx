// Search input box: query field, clear button, ⌘K hint, and Ask-AI link.
import type { Dispatch, RefObject, SetStateAction } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

interface SearchBoxProps {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function SearchBox({ query, setQuery, inputRef }: SearchBoxProps) {
  const hasQuery = query.trim().length > 0;
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
      <kbd className="search-box-kbd">⌘K</kbd>
      <Link href="/agent" className="search-ask-link">
        Ask
      </Link>
    </div>
  );
}
