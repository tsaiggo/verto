// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDesktopAppStore } from "@/lib/state-store/desktop-app";

beforeEach(() => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    clear: () => values.clear(),
  };
  vi.stubGlobal("localStorage", storage);
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
});

describe("desktop managed annotations", () => {
  it("restores native annotations before applying a new note", async () => {
    let finish!: (value: unknown) => void;
    const read = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          finish = resolve;
        })
    );
    const write = vi.fn(async () => {});
    const state = createDesktopAppStore({ read, write });
    expect(state.read("annotations", null)).toBeNull();
    const update = state.update<{ annotations: string[] }>(
      "annotations",
      { annotations: [] },
      (current) => ({ annotations: [...current.annotations, "new"] })
    );
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce());
    finish({ annotations: ["saved"] });
    await expect(update).resolves.toEqual({ annotations: ["saved", "new"] });
    expect(write).toHaveBeenCalledWith({ annotations: ["saved", "new"] });
    expect(state.read("annotations", null)).toEqual({ annotations: ["saved", "new"] });
  });

  it("migrates legacy managed notes once, without importing another vault cache", async () => {
    localStorage.setItem("verto:annotations", JSON.stringify({ annotations: ["legacy"] }));
    const write = vi.fn(async () => {});
    await createDesktopAppStore({ read: async () => null, write }).hydrate?.("annotations");
    expect(write).toHaveBeenCalledWith({ annotations: ["legacy"] });
    localStorage.clear();
    localStorage.setItem("verto:annotations", JSON.stringify({ annotations: ["private-vault"] }));
    localStorage.setItem("verto:state-store-origin:annotations", "/other-vault");
    write.mockClear();
    await createDesktopAppStore({ read: async () => null, write }).hydrate?.("annotations");
    expect(write).toHaveBeenCalledWith({ annotations: [] });
  });

  it("serializes concurrent updates and does not acknowledge a failed native write", async () => {
    const write = vi.fn(async () => {});
    const state = createDesktopAppStore({ read: async () => ({ annotations: [] }), write });
    const add = (note: string) =>
      state.update<{ annotations: string[] }>("annotations", { annotations: [] }, (current) => ({
        annotations: [...current.annotations, note],
      }));
    await Promise.all([add("a"), add("b")]);
    expect(state.read("annotations", null)).toEqual({ annotations: ["a", "b"] });
    write.mockRejectedValueOnce(new Error("disk unavailable"));
    await expect(add("c")).rejects.toThrow("disk unavailable");
    expect(state.read("annotations", null)).toEqual({ annotations: ["a", "b"] });
    await add("d");
    expect(state.read("annotations", null)).toEqual({ annotations: ["a", "b", "d"] });
  });

  it("rejects malformed persisted data and allows hydration to retry", async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({ wrong: [] })
      .mockResolvedValueOnce({ annotations: ["recovered"] });
    const write = vi.fn(async () => {});
    const state = createDesktopAppStore({ read, write });
    await expect(state.hydrate?.("annotations")).rejects.toThrow("invalid");
    await state.hydrate?.("annotations");
    expect(state.read("annotations", null)).toEqual({ annotations: ["recovered"] });
    expect(write).not.toHaveBeenCalled();
  });
});
