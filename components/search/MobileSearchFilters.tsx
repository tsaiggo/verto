"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { SearchFilters, type SearchFiltersProps } from "@/components/search/SearchFilters";
import styles from "./Search.module.css";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileSearchFiltersProps extends Omit<SearchFiltersProps, "className"> {
  selectedFilterCount: number;
}

/** Progressive source and tag filters shared by every workspace width. */
export function MobileSearchFilters({ selectedFilterCount, ...filters }: MobileSearchFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="search-mobile-filter-row">
        <SheetTrigger asChild>
          <button type="button" className="search-mobile-filter-trigger" aria-label="Open filters">
            <SlidersHorizontal aria-hidden />
            Filters
            {selectedFilterCount > 0 && (
              <span className="search-mobile-filter-count">{selectedFilterCount}</span>
            )}
          </button>
        </SheetTrigger>
      </div>

      <SheetContent
        side="right"
        aria-label="Search filters"
        className={`search-mobile-filter-sheet ${styles.filterPanel}`}
        data-testid="search-mobile-filter-sheet"
      >
        <SheetHeader className="search-mobile-filter-header">
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription className="sr-only">
            Refine search results by source, content type, tag, and date.
          </SheetDescription>
        </SheetHeader>
        <SearchFilters className="search-filters--mobile" {...filters} />
      </SheetContent>
    </Sheet>
  );
}
