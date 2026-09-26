"use client";
import { BookOpen, Flame, ListFilter, Sparkles } from "lucide-react";
import type { CategoryId } from "./data";

const icons = {
  "for-you": Sparkles,
  popular: Flame,
  "top-picks": ListFilter,
  bestsellers: BookOpen,
};

export function CategoryTabs({
  categories,
  selected,
  onSelect,
}: {
  categories: { id: CategoryId; label: string }[];
  selected: CategoryId;
  onSelect: (id: CategoryId) => void;
}) {
  return (
    <div className="book-categories" role="group" aria-label="Book categories">
      {categories.map(({ id, label }) => {
        const Icon = icons[id];
        return (
          <button
            key={id}
            aria-pressed={selected === id}
            className={selected === id ? "is-selected" : ""}
            onClick={() => onSelect(id)}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
