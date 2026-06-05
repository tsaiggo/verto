const WORDS_PER_MINUTE = 225;

function stripNonReadableBlocks(source: string): string {
  return source
    .replace(/^---[\s\S]*?---\s*/u, "")
    .replace(/```[\s\S]*?```/gu, "")
    .replace(/`[^`]*`/gu, "");
}

function countWords(source: string): number {
  const text = stripNonReadableBlocks(source)
    .replace(/<[^>]+>/gu, " ")
    .replace(/[#>*_~\-[\](){}|:;,.!?/\\]/gu, " ");
  return text.split(/\s+/u).filter(Boolean).length;
}

export function estimateReadingTime(source: string): number {
  const words = countWords(source);
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

export function formatReadingTime(minutes: number): string {
  const safeMinutes = Math.max(1, Math.round(minutes));
  return `${safeMinutes} min read`;
}
