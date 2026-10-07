"use client";

import { useState } from "react";

export default function HomeArticleCover({ src, className }: { src: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    // Covers come from the active content source and may be remote or local.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} loading="lazy" onError={() => setFailed(true)} />
  );
}
