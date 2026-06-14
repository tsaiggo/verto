import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "@/lib/with-timeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the wrapped value when it settles before the timeout", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
  });

  it("rejects with the original error when the wrapped promise rejects in time", async () => {
    const boom = new Error("boom");
    await expect(withTimeout(Promise.reject(boom), 1000)).rejects.toBe(boom);
  });

  it("rejects with a TimeoutError when the wrapped promise never settles", async () => {
    const pending = new Promise<never>(() => {});
    const guarded = withTimeout(pending, 1000, "Excalidraw render");
    const assertion = expect(guarded).rejects.toThrowError(
      /Excalidraw render timed out after 1000ms/
    );
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("uses the default label when none is provided", async () => {
    const pending = new Promise<never>(() => {});
    const guarded = withTimeout(pending, 500);
    const assertion = expect(guarded).rejects.toThrowError(/Operation timed out after 500ms/);
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it("does not fire the timeout once the wrapped promise has resolved", async () => {
    await expect(withTimeout(Promise.resolve("done"), 1000)).resolves.toBe("done");
    await vi.advanceTimersByTimeAsync(5000);
  });

  it("exposes TimeoutError as an Error subclass with a stable name", () => {
    const err = new TimeoutError("x");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("TimeoutError");
  });
});
