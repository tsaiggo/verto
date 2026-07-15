import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANNOTATIONS_KEY,
  annotationNote,
  annotationsForDoc,
  deleteAnnotation,
  loadAnnotations,
  removeAnnotation,
  saveAnnotation,
  saveAnnotations,
  setAnnotationColor,
  setAnnotationNote,
  updateAnnotationColor,
  updateAnnotationNote,
  upsertAnnotation,
  type Annotation,
  type AnnotationsState,
  type Turn,
} from "@/lib/annotations";

const anchor = { quote: "hello world", prefix: "before ", suffix: " after", start: 7 };

const base: Annotation = {
  id: "a1",
  docSlug: "help/intro",
  quote: "hello world",
  anchor,
  color: "yellow",
  turns: [],
  createdAt: "2026-06-05T00:00:00.000Z",
  updatedAt: "2026-06-05T00:00:00.000Z",
};

function annotation(overrides: Partial<Annotation>): Annotation {
  return { ...base, ...overrides };
}

function humanTurn(body: string, id = "t1"): Turn {
  return { id, author: "human", body, createdAt: "2026-06-05T00:00:00.000Z" };
}

describe("annotationNote", () => {
  it("returns the first human turn's body", () => {
    expect(annotationNote(annotation({ turns: [humanTurn("a note")] }))).toBe("a note");
  });

  it("returns an empty string for a pure highlight (no turns)", () => {
    expect(annotationNote(base)).toBe("");
  });

  it("ignores AI turns when reading the note", () => {
    const turns: Turn[] = [{ id: "t2", author: "ai", body: "ai reply", createdAt: base.createdAt }];
    expect(annotationNote(annotation({ turns }))).toBe("");
  });
});

describe("upsertAnnotation", () => {
  it("adds a new annotation to the front", () => {
    const prev = annotation({ id: "a0" });
    expect(upsertAnnotation([prev], base).map((a) => a.id)).toEqual(["a1", "a0"]);
  });

  it("replaces an annotation with the same id instead of duplicating it", () => {
    const result = upsertAnnotation(
      [annotation({ turns: [humanTurn("old")] })],
      annotation({ turns: [humanTurn("new")] })
    );
    expect(result).toHaveLength(1);
    expect(annotationNote(result[0])).toBe("new");
  });
});

describe("updateAnnotationNote", () => {
  it("edits the note of the matching annotation and leaves others untouched", () => {
    const a = annotation({ id: "a1", turns: [humanTurn("first")] });
    const other = annotation({ id: "a2", turns: [humanTurn("keep")] });
    const result = updateAnnotationNote([a, other], "a1", "edited", "2026-06-06T00:00:00.000Z");
    expect(annotationNote(result[0])).toBe("edited");
    expect(result[0].updatedAt).toBe("2026-06-06T00:00:00.000Z");
    expect(annotationNote(result[1])).toBe("keep");
  });

  it("adds a human turn when the annotation had none", () => {
    const result = updateAnnotationNote([base], "a1", "new note", "2026-06-06T00:00:00.000Z");
    expect(annotationNote(result[0])).toBe("new note");
    expect(result[0].turns).toHaveLength(1);
  });
});

describe("updateAnnotationColor", () => {
  it("recolors the matching annotation and bumps updatedAt", () => {
    const other = annotation({ id: "a2", color: "green" });
    const result = updateAnnotationColor([base, other], "a1", "blue", "2026-06-06T00:00:00.000Z");
    expect(result[0].color).toBe("blue");
    expect(result[0].updatedAt).toBe("2026-06-06T00:00:00.000Z");
    expect(result[1].color).toBe("green");
  });
});

describe("removeAnnotation", () => {
  it("removes the annotation with the given id", () => {
    const other = annotation({ id: "a2" });
    expect(removeAnnotation([base, other], "a1").map((a) => a.id)).toEqual(["a2"]);
  });
});

describe("annotationsForDoc", () => {
  it("returns only the annotations for the document, in order", () => {
    const list = [
      annotation({ id: "a1", docSlug: "doc/a" }),
      annotation({ id: "a2", docSlug: "doc/b" }),
      annotation({ id: "a3", docSlug: "doc/a" }),
    ];
    expect(annotationsForDoc(list, "doc/a").map((a) => a.id)).toEqual(["a1", "a3"]);
  });
});

describe("annotations persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
      dispatchEvent: () => true,
      addEventListener: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips annotations through localStorage", async () => {
    const state: AnnotationsState = { annotations: [annotation({ turns: [humanTurn("note")] })] };
    await saveAnnotations(state);
    expect(loadAnnotations()).toEqual(state);
  });

  it("returns an empty state when nothing is stored", () => {
    expect(loadAnnotations()).toEqual({ annotations: [] });
  });

  it("ignores malformed stored JSON", () => {
    window.localStorage.setItem(ANNOTATIONS_KEY, "{not json");
    expect(loadAnnotations()).toEqual({ annotations: [] });
  });

  it("drops entries missing a quote or a valid anchor", () => {
    window.localStorage.setItem(
      ANNOTATIONS_KEY,
      JSON.stringify({ annotations: [null, { id: "x", quote: "" }, { id: "y", quote: "q" }, base] })
    );
    expect(loadAnnotations().annotations.map((a) => a.id)).toEqual(["a1"]);
  });

  it("migrates a legacy { note } record into a human turn", () => {
    const legacy = {
      id: "old1",
      docSlug: "help/intro",
      quote: "hello world",
      note: "legacy note",
      anchor,
      color: "blue",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    window.localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ annotations: [legacy] }));
    const loaded = loadAnnotations().annotations[0];
    expect(annotationNote(loaded)).toBe("legacy note");
    expect(loaded.turns).toHaveLength(1);
    expect(loaded.turns[0].author).toBe("human");
    expect(loaded.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("migrates a legacy highlight (empty note) into zero turns", () => {
    const legacy = {
      id: "old2",
      docSlug: "help/intro",
      quote: "hello world",
      note: "",
      anchor,
      color: "yellow",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    window.localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ annotations: [legacy] }));
    expect(loadAnnotations().annotations[0].turns).toEqual([]);
  });

  it("loads legacy records deterministically (stable turn ids across reloads)", () => {
    const legacy = {
      id: "old1",
      docSlug: "help/intro",
      quote: "hello world",
      note: "legacy note",
      anchor,
      color: "blue",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    window.localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify({ annotations: [legacy] }));
    expect(loadAnnotations()).toEqual(loadAnnotations());
  });

  it("saveAnnotation persists and dedupes by id", async () => {
    await saveAnnotation(base);
    await saveAnnotation(annotation({ turns: [humanTurn("updated")] }));
    const loaded = loadAnnotations();
    expect(loaded.annotations).toHaveLength(1);
    expect(annotationNote(loaded.annotations[0])).toBe("updated");
  });

  it("deleteAnnotation removes a stored annotation", async () => {
    await saveAnnotation(base);
    await saveAnnotation(annotation({ id: "a2" }));
    await deleteAnnotation("a1");
    expect(loadAnnotations().annotations.map((a) => a.id)).toEqual(["a2"]);
  });

  it("setAnnotationNote edits a stored annotation's note", async () => {
    await saveAnnotation(base);
    await setAnnotationNote("a1", "edited note");
    expect(annotationNote(loadAnnotations().annotations[0])).toBe("edited note");
  });

  it("setAnnotationColor recolors a stored annotation", async () => {
    await saveAnnotation(base);
    await setAnnotationColor("a1", "pink");
    expect(loadAnnotations().annotations[0].color).toBe("pink");
  });
});
