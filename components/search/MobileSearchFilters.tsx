"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { SearchFilters, type SearchFiltersProps } from "@/components/search/SearchFilters";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileSearchFiltersProps extends Omit<SearchFiltersProps, "className"> {
  selectedFilterCount: number;
}

/** Mobile counterpart to the desktop filters rail. It shares the exact filter
 * controls and state, while keeping the result list unobstructed until needed. */
export function MobileSearchFilters({ selectedFilterCount, ...filters }: MobileSearchFiltersProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="search-mobile-filter-row">
        <button
          type="button"
          className="search-mobile-filter-trigger"
          aria-label="Open filters"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal aria-hidden />
          Filters
          {selectedFilterCount > 0 && (
            <span className="search-mobile-filter-count">{selectedFilterCount}</span>
          )}
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          aria-label="Search filters"
          className="search-mobile-filter-sheet max-h-[85dvh] rounded-t-[20px] p-0"
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
    </>
  );
}
