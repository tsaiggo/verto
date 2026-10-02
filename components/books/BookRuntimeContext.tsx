"use client";

import { createContext, useContext } from "react";

export interface BookRuntimeValue {
  image: (source: string) => string | undefined;
  link: (href: string) => string | undefined;
  preview: boolean;
}

export const BookRuntimeContext = createContext<BookRuntimeValue | null>(null);
export function useBookRuntime() {
  return useContext(BookRuntimeContext);
}
