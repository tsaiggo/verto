"use client";

import { useSyncExternalStore } from "react";

function subscribePlatform(): () => void {
  return () => {};
}

function platformModifier(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘" : "Ctrl";
}

function serverModifier(): string {
  return "Ctrl";
}

export default function PlatformShortcut({
  command,
  className,
}: {
  command: string;
  className?: string;
}) {
  const modifier = useSyncExternalStore(subscribePlatform, platformModifier, serverModifier);
  const separator = modifier === "⌘" ? "" : " ";

  return (
    <kbd className={className} aria-hidden>
      {modifier}
      {separator}
      {command.toUpperCase()}
    </kbd>
  );
}
