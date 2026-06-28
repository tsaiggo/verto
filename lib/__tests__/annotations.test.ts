import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANNOTATIONS_KEY,
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
} from "@/lib/annotations";

const base: Annotation = {
  id: "a1",
  docSlug: "help/intro",
  quote: "hello world",
  note: "",
  anchor: { quote: "hello world", prefix: "before ", suffix: " after", start: 7 },
  color: "yellow",
  createdAt: "2026-06-05T00:00:00.000Z",
};

function annotation(overrides: Partial<Annotation>): Annotation {
  return { ...base, ...overrides };
}

describe("upsertAnnotation", () => {
  it("adds a new annotation to the front", () => {
    const prev = annotation({ id: "a0" });
    expect(upsertAnnotation([prev], base).map((a) => a.id)).toEqual(["a1", "a0"]);
  });

  it("replaces an annotation with the same id instead of duplicating it", () => {
    const result = upsertAnnotation([annotation({ note: "old" })], annotation({ note: "new" }));
    expect(result).toHaveLength(1);
    expect(result[0].note).toBe("new");
  });
});

describe("updateAnnotationNote", () => {
  it("edits the note of the matching annotation and leaves others untouched", () => {
    const other = annotation({ id: "a2", note: "keep" });
    const result = updateAnnotationNote([base, other], "a1", "edited");
    expect(result[0].note).toBe("edited");
    expect(result[1].note).toBe("keep");
  });
});

describe("updateAnnotationColor", () => {
  it("recolors the matching annotation and leaves others untouched", () => {
    const other = annotation({ id: "a2", color: "green" });
    const result = updateAnnotationColor([base, other], "a1", "blue");
    expect(result[0].color).toBe("blue");
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

  it("round-trips annotations through localStorage", () => {
    const state: AnnotationsState = { annotations: [base] };
    saveAnnotations(state);
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

  it("saveAnnotation persists and dedupes by id", () => {
    saveAnnotation(base);
    saveAnnotation(annotation({ note: "updated" }));
    const loaded = loadAnnotations();
    expect(loaded.annotations).toHaveLength(1);
    expect(loaded.annotations[0].note).toBe("updated");
  });

  it("deleteAnnotation removes a stored annotation", () => {
    saveAnnotation(base);
    saveAnnotation(annotation({ id: "a2" }));
    deleteAnnotation("a1");
    expect(loadAnnotations().annotations.map((a) => a.id)).toEqual(["a2"]);
  });

  it("setAnnotationNote edits a stored annotation's note", () => {
    saveAnnotation(base);
    setAnnotationNote("a1", "edited note");
    expect(loadAnnotations().annotations[0].note).toBe("edited note");
  });

  it("setAnnotationColor recolors a stored annotation", () => {
    saveAnnotation(base);
    setAnnotationColor("a1", "pink");
    expect(loadAnnotations().annotations[0].color).toBe("pink");
  });
});
