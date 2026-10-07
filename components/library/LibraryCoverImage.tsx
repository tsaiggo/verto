"use client";

import { useState } from "react";

/** A missing cover leaves the document's text visible instead of a broken image. */
export default function LibraryCoverImage({ src, className }: { src: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // Covers belong to the source and can be remote or locally served.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} className={className} alt="" loading="lazy" onError={() => setFailed(true)} />
  );
}
