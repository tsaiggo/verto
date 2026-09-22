"use client";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Check, Search, X } from "lucide-react";
import { BookHero } from "./BookHero";
import { BookSearch } from "./BookSearch";
import { CategoryTabs } from "./CategoryTabs";
import { BookShelf } from "./BookShelf";
import {
  books,
  categories,
  heroBooks,
  type Book,
  type CategoryId,
} from "./data";

export function BookDiscoveryPreview() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId>("for-you");
  const [expanded, setExpanded] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const detail = useRef<HTMLDialogElement>(null);
  const signIn = useRef<HTMLDialogElement>(null);
  const lastBookTrigger = useRef<HTMLElement | null>(null);
  const signInButton = useRef<HTMLButtonElement>(null);
  const term = query.trim().toLowerCase();
  const filtered = books.filter(
    (book) =>
      book.categories.includes(category) &&
      `${book.title} ${book.author}`.toLowerCase().includes(term),
  );
  const isDiscovery = category === "for-you" && !term;
  const selectBook = (book: Book) => {
    lastBookTrigger.current = document.activeElement as HTMLElement;
    setSelectedBook(book);
  };
  useEffect(() => {
    if (selectedBook) detail.current?.showModal();
    else if (detail.current?.open) detail.current.close();
  }, [selectedBook]);

  return (
    <div className="book-experiment">
      <div className="book-stage">
        <main className="book-screen">
          <header className="book-topbar">
            <span className="book-wordmark">memrbl</span>
            <button
              ref={signInButton}
              onClick={() => signIn.current?.showModal()}
            >
              Sign in
            </button>
          </header>
          <BookHero
            books={heroBooks}
            eyebrow="Read less, remember more"
            title="Which book is on your mind?"
            description="Turn the best ideas from great books into lessons you can actually use."
          />
          <div className="book-discovery-controls">
            <BookSearch value={query} onChange={setQuery} />
            <CategoryTabs
              categories={categories}
              selected={category}
              onSelect={(id) => {
                setCategory(id);
                setExpanded(false);
              }}
            />
          </div>
          <div className="book-results">
            <span className="book-sr-only" role="status">
              {filtered.length} books found{term ? ` for ${query}` : ""}
            </span>
            {filtered.length ? (
              <>
                <BookShelf
                  title={
                    isDiscovery
                      ? "Recommended for you"
                      : term
                        ? "Search results"
                        : categories.find((item) => item.id === category)!.label
                  }
                  books={
                    isDiscovery && !expanded ? filtered.slice(0, 3) : filtered
                  }
                  onSelect={selectBook}
                  onViewAll={
                    isDiscovery
                      ? () => setExpanded((value) => !value)
                      : undefined
                  }
                  expanded={expanded}
                />
                {isDiscovery && !expanded && (
                  <BookShelf
                    title="Top picks"
                    books={books.slice(3)}
                    onSelect={selectBook}
                    onViewAll={() => setCategory("top-picks")}
                  />
                )}
              </>
            ) : (
              <div className="book-empty">
                <Search size={26} />
                <h2>No books found</h2>
                <p>Try another title, author, or category.</p>
                <button
                  onClick={() => {
                    setQuery("");
                    setCategory("for-you");
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
          <footer className="book-bottom-note">
            A little reading. A lasting idea.
          </footer>
          <dialog
            ref={detail}
            className="book-dialog"
            aria-labelledby="book-detail-title"
            onCancel={() => setSelectedBook(null)}
            onClose={() => {
              setSelectedBook(null);
              lastBookTrigger.current?.focus();
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelectedBook(null);
            }}
          >
            {selectedBook && (
              <>
                <button
                  className="book-dialog-close"
                  aria-label="Close book details"
                  onClick={() => setSelectedBook(null)}
                >
                  <X size={19} />
                </button>
                <img
                  className="book-detail-cover"
                  src={selectedBook.cover}
                  alt={`${selectedBook.title} cover`}
                />
                <p className="book-detail-topic">{selectedBook.topic}</p>
                <h2 id="book-detail-title">{selectedBook.title}</h2>
                <p className="book-detail-author">{selectedBook.author}</p>
                <p className="book-detail-description">
                  {selectedBook.description}
                </p>
                <button
                  className="book-save"
                  aria-pressed={saved.includes(selectedBook.id)}
                  onClick={() =>
                    setSaved((current) =>
                      current.includes(selectedBook.id)
                        ? current.filter((id) => id !== selectedBook.id)
                        : [...current, selectedBook.id],
                    )
                  }
                >
                  {saved.includes(selectedBook.id) ? (
                    <Check size={17} />
                  ) : (
                    <Bookmark size={17} />
                  )}{" "}
                  {saved.includes(selectedBook.id)
                    ? "Saved to your reading list"
                    : "Save for later"}
                </button>
                <small>Preview only · Saved until you reload</small>
              </>
            )}
          </dialog>
          <dialog
            ref={signIn}
            className="book-dialog book-signin-dialog"
            aria-labelledby="book-signin-title"
            onClose={() => signInButton.current?.focus()}
            onClick={(event) => {
              if (event.target === event.currentTarget) signIn.current?.close();
            }}
          >
            <button
              className="book-dialog-close"
              aria-label="Close sign in"
              onClick={() => signIn.current?.close()}
            >
              <X size={19} />
            </button>
            <span className="book-wordmark">memrbl</span>
            <h2 id="book-signin-title">Make room for a good book.</h2>
            <p className="book-detail-description">
              This is a design preview. You can explore books and save a reading
              list without an account.
            </p>
            <button
              className="book-save"
              onClick={() => signIn.current?.close()}
            >
              Continue exploring
            </button>
          </dialog>
        </main>
      </div>
    </div>
  );
}
