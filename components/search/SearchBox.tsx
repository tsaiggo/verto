// Search input box: query field, clear button, ⌘K hint, and Ask-AI link.
import type { Dispatch, RefObject, SetStateAction } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { agentHrefForQuery } from "@/components/search/search-state";
import styles from "@/components/search/SearchView.module.css";

interface SearchBoxProps {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function SearchBox({ query, setQuery, inputRef }: SearchBoxProps) {
  const hasQuery = query.trim().length > 0;
  return (
    <div className={styles.searchBox}>
      <Search className={styles.searchIcon} aria-hidden />
      <input
        ref={inputRef}
        type="search"
        className={styles.searchInput}
        placeholder="Search your library…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search your library"
      />
      {hasQuery && (
        <button
          type="button"
          className={styles.searchClear}
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      )}
      <kbd className={styles.searchKbd}>⌘K</kbd>
      <Link href={agentHrefForQuery(query)} className={styles.askLink}>
        Ask
      </Link>
    </div>
  );
}
