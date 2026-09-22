"use client";
import { useState } from "react";
import { BookOpen } from "lucide-react";
import type { Book } from "./data";

export function BookCard({
  book,
  onSelect,
}: {
  book: Book;
  onSelect: (book: Book) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <button
      className="book-card"
      onClick={() => onSelect(book)}
      aria-label={`View ${book.title} by ${book.author}`}
    >
      <span className="book-cover">
        {imageFailed ? (
          <span className="book-cover-fallback">
            <BookOpen />
            <span>{book.title}</span>
          </span>
        ) : (
          <img
            src={book.cover}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        )}
      </span>
      <span className="book-card-title">{book.title}</span>
      <span className="book-card-author">{book.author}</span>
    </button>
  );
}
