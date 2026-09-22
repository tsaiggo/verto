"use client";
import type { Book } from "./data";

type BookHeroProps = {
  books: Book[];
  eyebrow: string;
  title: string;
  description: string;
};

export function BookHero({
  books,
  eyebrow,
  title,
  description,
}: BookHeroProps) {
  return (
    <section className="book-hero" aria-labelledby="book-discovery-title">
      <div className="book-collage" aria-hidden="true">
        <div className="book-collage-grid">
          {books.map((book) => (
            <img key={book.id} src={book.cover} alt="" draggable={false} />
          ))}
        </div>
      </div>
      <div className="book-hero-copy">
        <p className="book-eyebrow">{eyebrow}</p>
        <h1 id="book-discovery-title">{title}</h1>
        <p className="book-description">{description}</p>
      </div>
    </section>
  );
}
