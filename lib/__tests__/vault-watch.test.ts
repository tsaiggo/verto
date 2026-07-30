import { describe, expect, it } from "vitest";
import type { VaultWatchBatch, VaultWatchSession, VaultWatchStatus } from "@/lib/tauri";
import {
  acceptVaultWatchBatch,
  acceptVaultWatchStatus,
  cursorFromSession,
  type VaultWatchCursor,
} from "@/lib/vault-watch";

const session: VaultWatchSession = {
  schemaVersion: 1,
  root: "C:/Vault",
  generation: 7,
  sequence: 0,
};

function batch(overrides: Partial<VaultWatchBatch> = {}): VaultWatchBatch {
  return {
    ...session,
    sequence: 1,
    rescan: false,
    changes: [],
    portableStateRescan: false,
    portableStateNames: [],
    ...overrides,
  };
}

describe("Vault watcher batch acceptance", () => {
  it("advances only a matching root and generation", () => {
    const accepted = acceptVaultWatchBatch(cursorFromSession(session), batch());

    expect(accepted?.cursor).toEqual({
      root: "C:/Vault",
      generation: 7,
      sequence: 1,
    });
  });

  it.each([
    ["stale root", batch({ root: "D:/Other", sequence: 4 })],
    ["stale generation", batch({ generation: 6, sequence: 4 })],
    ["future unowned generation", batch({ generation: 8, sequence: 4 })],
    ["replayed sequence", batch({ sequence: 3 })],
  ])("rejects a %s", (_label, value) => {
    const cursor: VaultWatchCursor = {
      root: "C:/Vault",
      generation: 7,
      sequence: 3,
    };

    expect(acceptVaultWatchBatch(cursor, value)).toBeNull();
  });

  it("rejects malformed batches before reading their changes", () => {
    expect(
      acceptVaultWatchBatch(cursorFromSession(session), {
        schemaVersion: 2,
        root: "C:/Vault",
        generation: 7,
        sequence: 1,
        rescan: false,
        changes: [],
        portableStateRescan: false,
        portableStateNames: [],
      })
    ).toBeNull();
  });

  it("turns a sequence gap into an authoritative rescan boundary", () => {
    const cursor: VaultWatchCursor = {
      root: "C:/Vault",
      generation: 7,
      sequence: 2,
    };
    const accepted = acceptVaultWatchBatch(
      cursor,
      batch({
        sequence: 5,
        changes: [{ kind: "remove", id: "C:/Vault/stale.md", path: ["stale.md"] }],
      })
    );

    expect(accepted).toEqual({
      cursor: {
        root: "C:/Vault",
        generation: 7,
        sequence: 5,
      },
      batch: expect.objectContaining({
        sequence: 5,
        rescan: true,
        changes: [],
        portableStateRescan: true,
        portableStateNames: [],
      }),
    });
  });

  it("keeps a consecutive portable-state-only batch targeted", () => {
    const accepted = acceptVaultWatchBatch(
      cursorFromSession(session),
      batch({
        portableStateNames: ["bookmarks", "reading-state"],
      })
    );

    expect(accepted?.batch).toEqual(
      expect.objectContaining({
        rescan: false,
        changes: [],
        portableStateRescan: false,
        portableStateNames: ["bookmarks", "reading-state"],
      })
    );
  });

  it("rejects malformed portable-state metadata", () => {
    const valid = batch();
    expect(
      acceptVaultWatchBatch(cursorFromSession(session), {
        ...valid,
        portableStateRescan: "false",
      })
    ).toBeNull();
    expect(
      acceptVaultWatchBatch(cursorFromSession(session), {
        ...valid,
        portableStateNames: ["bookmarks", 3],
      })
    ).toBeNull();
    expect(
      acceptVaultWatchBatch(cursorFromSession(session), {
        ...valid,
        portableStateNames: ["../bookmarks"],
      })
    ).toBeNull();
  });

  it("turns rename plus a recreated source path into an authoritative rescan", () => {
    const accepted = acceptVaultWatchBatch(
      cursorFromSession(session),
      batch({
        changes: [
          {
            kind: "upsert",
            entry: {
              id: "C:/Vault/a.md",
              path: ["a.md"],
              sha: "new-a",
              size: 5,
              mtime: 2,
            },
          },
          {
            kind: "rename",
            fromId: "C:/Vault/a.md",
            fromPath: ["a.md"],
            entry: {
              id: "C:/Vault/z.md",
              path: ["z.md"],
              sha: "old-a",
              size: 5,
              mtime: 1,
            },
          },
        ],
      })
    );

    expect(accepted?.batch).toEqual(
      expect.objectContaining({
        rescan: true,
        changes: [],
      })
    );
  });
});

describe("Vault watcher health acceptance", () => {
  const cursor = cursorFromSession(session);
  const available: VaultWatchStatus = {
    schemaVersion: 1,
    root: "C:/Vault",
    generation: 7,
    status: "available",
  };

  it("accepts only health events owned by the active root and generation", () => {
    expect(acceptVaultWatchStatus(cursor, available)).toEqual(available);
    expect(acceptVaultWatchStatus(cursor, { ...available, root: "D:/Other" })).toBeNull();
    expect(acceptVaultWatchStatus(cursor, { ...available, generation: 8 })).toBeNull();
  });

  it("rejects malformed degraded health events without an error", () => {
    expect(
      acceptVaultWatchStatus(cursor, {
        schemaVersion: 1,
        root: "C:/Vault",
        generation: 7,
        status: "degraded",
      })
    ).toBeNull();
  });
});
