"use client";
import { useId } from "react";
import { ChevronRight } from "lucide-react";
import { BookCard } from "./BookCard";
import type { Book } from "./data";

export function BookShelf({
  title,
  books,
  onSelect,
  onViewAll,
  expanded,
}: {
  title: string;
  books: Book[];
  onSelect: (book: Book) => void;
  onViewAll?: () => void;
  expanded?: boolean;
}) {
  const headingId = useId();
  return (
    <section className="book-shelf" aria-labelledby={headingId}>
      <header>
        <h2 id={headingId}>{title}</h2>
        {onViewAll && (
          <button
            aria-label={`${expanded ? "Show fewer" : "View all"} ${title.toLowerCase()}`}
            onClick={onViewAll}
            aria-expanded={expanded}
          >
            <ChevronRight size={17} className={expanded ? "is-expanded" : ""} />
          </button>
        )}
      </header>
      <div className="book-shelf-grid">
        {books.map((book) => (
          <BookCard key={book.id} book={book} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
