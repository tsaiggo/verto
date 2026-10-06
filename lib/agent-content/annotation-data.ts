import type { ContentAnnotation } from "./types";

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

export function contentAnnotations(value: unknown, slug: string): ContentAnnotation[] {
  if (!record(value) || !Array.isArray(value.annotations)) return [];
  return value.annotations
    .filter(record)
    .filter(
      (item) =>
        item.docSlug === slug && typeof item.id === "string" && typeof item.quote === "string"
    )
    .slice(0, 2000)
    .map((item) => {
      const turns = Array.isArray(item.turns)
        ? item.turns
            .filter(record)
            .filter((turn) => typeof turn.body === "string")
            .map((turn) => ({
              author: turn.author === "ai" ? ("ai" as const) : ("human" as const),
              body: String(turn.body).slice(0, 1200),
            }))
        : typeof item.note === "string"
          ? [{ author: "human" as const, body: item.note.slice(0, 1200) }]
          : [];
      return {
        id: String(item.id),
        quote: String(item.quote).slice(0, 2000),
        note: turns.find((turn) => turn.author === "human")?.body ?? "",
        turns: turns.slice(0, 3),
        truncated:
          turns.length > 3 ||
          String(item.quote).length > 2000 ||
          (Array.isArray(item.turns) &&
            item.turns
              .filter(record)
              .some((turn) => typeof turn.body === "string" && turn.body.length > 1200)),
        createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
      };
    });
}
