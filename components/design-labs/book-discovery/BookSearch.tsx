"use client";
import { Search, X } from "lucide-react";

export function BookSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="book-search" role="search">
      <Search size={21} aria-hidden="true" />
      <input
        type="search"
        aria-label="Search books or authors"
        placeholder="Search books or authors"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
      />
      {value && (
        <button aria-label="Clear book search" onClick={() => onChange("")}>
          <X size={17} />
        </button>
      )}
    </div>
  );
}
