import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDraft,
  mailAccountKey,
  moveMailDraft,
  readDrafts,
  readDraftsWithStatus,
  removeMailDraft,
  saveMailDraft,
  subscribeDraftChanges,
  writeDrafts,
  type MailDraft,
} from "./drafts";
import type { MailAccount, MailMessage } from "./model";

const account: MailAccount = {
  id: "account-a",
  provider: "google",
  address: "Alex@example.com",
  displayName: "Alex Morgan",
};
const accountKey = "google:alex@example.com";
const storageKey = `verto.mail.drafts.v1:${encodeURIComponent(accountKey)}`;

const message: MailMessage = {
  id: "message-1",
  from: '"Chen, Maya" <maya@example.com>',
  to: ["Alex <ALEX@example.com>", "Noah <noah@example.com>"],
  cc: ["maya@example.com", "Priya <priya@example.com>", "alex@example.com"],
  replyTo: ["Design Team <design@example.com>"],
  internetMessageId: "<message-1@example.com>",
  subject: "Design review",
  bodyText: "Hi Alex,\n\nHere are the notes.\nMaya",
  receivedAt: "2026-10-01T09:00:00.000Z",
  preview: "Here are the notes.",
  isRead: false,
  hasAttachments: false,
};

describe("local mail drafts", () => {
  let values: Map<string, string>;
  let storage: Pick<Storage, "getItem" | "setItem">;

  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    values = new Map();
    storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("isolates drafts by normalized provider and address", () => {
    const draft = createDraft("compose", undefined, account);
    draft.subject = "Local note";
    expect(mailAccountKey(account)).toBe(accountKey);
    expect(writeDrafts(accountKey, [draft])).toBe(true);
    expect(readDrafts("google:ALEX@example.com")).toEqual([draft]);
    expect(readDrafts("microsoft:alex@example.com")).toEqual([]);
    expect(readDrafts("google:someone@example.com")).toEqual([]);
    expect(writeDrafts("google:someone@example.com", [draft])).toBe(false);
    expect(readDrafts(accountKey)).toEqual([draft]);
    expect(writeDrafts(accountKey, [])).toBe(true);
    expect(readDrafts(accountKey)).toEqual([]);
  });

  it("saves incomplete recipients and only whitelisted draft fields", () => {
    const draft = {
      ...createDraft("compose", undefined, account),
      to: "maya@",
      accessToken: "secret",
    };
    expect(writeDrafts(accountKey, [draft])).toBe(true);
    expect(readDrafts(accountKey)[0].to).toBe("maya@");
    expect(values.get(storageKey)).not.toContain("secret");
    expect(values.get(storageKey)).not.toContain("accessToken");
  });

  it.each([
    "{broken json",
    "null",
    JSON.stringify({ version: 2, accountKey, drafts: [] }),
    JSON.stringify({ version: 1, accountKey: "google:other@example.com", drafts: [] }),
    JSON.stringify({ version: 1, accountKey, drafts: {} }),
  ])("recovers from malformed storage without throwing", (raw) => {
    values.set(storageKey, raw);
    expect(readDraftsWithStatus(accountKey)).toEqual({ drafts: [], status: "corrupt" });
    expect(values.get(storageKey)).toBe(raw);
  });

  it("retains valid drafts when another stored row is damaged", () => {
    const draft = createDraft("compose", undefined, account);
    values.set(
      storageKey,
      JSON.stringify({
        version: 1,
        accountKey,
        drafts: [draft, { ...draft, id: "bad", updatedAt: "yesterday" }],
      })
    );
    expect(readDraftsWithStatus(accountKey)).toEqual({ drafts: [draft], status: "corrupt" });
    expect(writeDrafts(accountKey, [{ ...draft, mode: "invalid" } as unknown as MailDraft])).toBe(
      false
    );
    expect(writeDrafts(accountKey, [draft, draft])).toBe(false);
  });

  it("reports blocked storage and quota failures", () => {
    const draft = createDraft("compose", undefined, account);
    vi.mocked(storage.getItem).mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });
    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
    expect(readDraftsWithStatus(accountKey)).toEqual({ drafts: [], status: "unavailable" });
    expect(writeDrafts(accountKey, [draft])).toBe(false);
    vi.stubGlobal("window", undefined);
    expect(readDrafts(accountKey)).toEqual([]);
    expect(writeDrafts(accountKey, [draft])).toBe(false);
  });

  it("handles a localStorage getter that throws", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("Browser policy");
      },
    });
    expect(readDraftsWithStatus(accountKey).status).toBe("unavailable");
    expect(writeDrafts(accountKey, [])).toBe(false);
  });

  it("merges edits from independent tabs without dropping new drafts or restoring removals", async () => {
    const first = { ...createDraft("compose", undefined, account), id: "first" };
    const second = { ...createDraft("compose", undefined, account), id: "second" };
    writeDrafts(accountKey, [first]);
    vi.resetModules();
    const otherTab = await import("./drafts");
    await expect(otherTab.saveMailDraft(second, true)).resolves.toBe(true);
    await expect(saveMailDraft({ ...first, bodyText: "Edited in the original tab" })).resolves.toBe(
      true
    );
    expect(
      readDrafts(accountKey)
        .map((draft) => draft.id)
        .sort()
    ).toEqual(["first", "second"]);
    await expect(otherTab.removeMailDraft(accountKey, first.id)).resolves.toBe(true);
    await expect(
      saveMailDraft({ ...first, bodyText: "A stale editor still has this draft" })
    ).resolves.toBe(false);
    expect(readDrafts(accountKey)).toEqual([second]);
  });

  it("serializes concurrent creations, edits and deletions across separate module contexts", async () => {
    const first = { ...createDraft("compose", undefined, account), id: "first" };
    const kept = { ...first, id: "kept" };
    writeDrafts(accountKey, [first, kept]);
    vi.resetModules();
    const otherTab = await import("./drafts");
    const added = { ...first, id: "added" };
    const edited = { ...kept, bodyText: "The latest retained draft" };
    expect(
      await Promise.all([
        saveMailDraft(added, true),
        otherTab.saveMailDraft(edited),
        removeMailDraft(accountKey, first.id),
      ])
    ).toEqual([true, true, true]);
    expect(
      readDrafts(accountKey)
        .map((draft) => draft.id)
        .sort()
    ).toEqual(["added", "kept"]);
    expect(readDrafts(accountKey).find((draft) => draft.id === kept.id)).toEqual(edited);
  });

  it("moves only the captured draft and preserves concurrent source and target edits", async () => {
    const moving = { ...createDraft("compose", undefined, account), id: "moving" };
    const sourceKept = { ...moving, id: "source-kept" };
    const targetKey = "microsoft:alex@example.com";
    const targetKept = { ...moving, id: "target-kept", accountKey: targetKey };
    writeDrafts(accountKey, [moving, sourceKept]);
    writeDrafts(targetKey, [targetKept]);
    const added = { ...targetKept, id: "target-new" };
    expect(
      await Promise.all([
        saveMailDraft(added, true),
        moveMailDraft({ ...moving, accountKey: targetKey }, accountKey),
        saveMailDraft({ ...sourceKept, subject: "Source edit kept" }),
      ])
    ).toEqual([true, true, true]);
    expect(readDrafts(accountKey)).toEqual([{ ...sourceKept, subject: "Source edit kept" }]);
    expect(
      readDrafts(targetKey)
        .map((draft) => draft.id)
        .sort()
    ).toEqual(["moving", "target-kept", "target-new"]);
  });

  it("preserves damaged storage and in-memory drafts when shared coordination is unavailable", async () => {
    const draft = createDraft("compose", undefined, account);
    values.set(storageKey, "{damaged");
    await expect(saveMailDraft(draft, true)).resolves.toBe(false);
    expect(values.get(storageKey)).toBe("{damaged");
    values.delete(storageKey);
    vi.stubGlobal("indexedDB", undefined);
    await expect(saveMailDraft(draft, true)).resolves.toBe(false);
    expect(readDrafts(accountKey)).toEqual([]);
    expect(draft.bodyText).toBe("");
  });

  it("commits a move in one storage write even when legacy cleanup cannot run", async () => {
    const moving = { ...createDraft("compose", undefined, account), id: "atomic-move" };
    const targetKey = "microsoft:alex@example.com";
    const kept = { ...moving, accountKey: targetKey, id: "kept" };
    writeDrafts(accountKey, [moving]);
    writeDrafts(targetKey, [kept]);
    vi.mocked(storage.setItem).mockClear();
    vi.stubGlobal("window", {
      localStorage: {
        ...storage,
        removeItem: () => {
          throw new Error("Cleanup unavailable");
        },
      },
    });
    const moved = { ...moving, accountKey: targetKey };
    await expect(moveMailDraft(moved, accountKey)).resolves.toBe(true);
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(values.has(storageKey)).toBe(true);
    vi.resetModules();
    const reopened = await import("./drafts");
    expect(reopened.readDrafts(accountKey)).toEqual([]);
    expect(reopened.readDrafts(targetKey)).toEqual([moved, kept]);
    await expect(reopened.saveMailDraft(moving)).resolves.toBe(false);
    await expect(
      reopened.saveMailDraft({ ...moved, bodyText: "Edited after moving" })
    ).resolves.toBe(true);
    expect(readDrafts(targetKey).find((draft) => draft.id === moving.id)?.bodyText).toBe(
      "Edited after moving"
    );
    await expect(reopened.removeMailDraft(targetKey, moving.id)).resolves.toBe(true);
    expect(readDrafts(accountKey)).toEqual([]);
    expect(readDrafts(targetKey)).toEqual([kept]);
  });

  it("leaves both accounts unchanged when the single move commit exceeds storage quota", async () => {
    const moving = { ...createDraft("compose", undefined, account), id: "quota-move" };
    const targetKey = "microsoft:alex@example.com";
    const kept = { ...moving, accountKey: targetKey, id: "kept" };
    writeDrafts(accountKey, [moving]);
    writeDrafts(targetKey, [kept]);
    const before = new Map(values);
    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    });
    await expect(moveMailDraft({ ...moving, accountKey: targetKey }, accountKey)).resolves.toBe(
      false
    );
    expect(values).toEqual(before);
    expect(readDrafts(accountKey)).toEqual([moving]);
    expect(readDrafts(targetKey)).toEqual([kept]);
  });

  it("notifies local subscribers and listens only to draft storage changes from other tabs", async () => {
    const handlers = new Map<string, (event: StorageEvent) => void>();
    vi.stubGlobal("window", {
      localStorage: storage,
      addEventListener: (name: string, listener: (event: StorageEvent) => void) =>
        handlers.set(name, listener),
      removeEventListener: (name: string) => handlers.delete(name),
    });
    const changed = vi.fn();
    const unsubscribe = subscribeDraftChanges(changed);
    await saveMailDraft(createDraft("compose", undefined, account), true);
    expect(changed).toHaveBeenCalledOnce();
    handlers.get("storage")!({ key: "theme" } as StorageEvent);
    expect(changed).toHaveBeenCalledOnce();
    handlers.get("storage")!({ key: storageKey } as StorageEvent);
    expect(changed).toHaveBeenCalledTimes(2);
    handlers.get("storage")!({ key: "verto.mail.drafts.v2" } as StorageEvent);
    expect(changed).toHaveBeenCalledTimes(3);
    unsubscribe();
    expect(handlers.has("storage")).toBe(false);
  });
});

describe("draft recipients and quotes", () => {
  it("prefers Reply-To and carries reply metadata", () => {
    expect(createDraft("reply", message, account)).toMatchObject({
      accountKey,
      to: "design@example.com",
      cc: "",
      bcc: "",
      subject: "Re: Design review",
      replyToMessageId: "message-1",
      internetMessageId: "<message-1@example.com>",
    });
    expect(createDraft("reply", message, account).bodyText).toContain(
      'On Thu, 01 Oct 2026 09:00:00 GMT, "Chen, Maya" <maya@example.com> wrote:\n> Hi Alex,'
    );
  });

  it("deduplicates reply-all recipients and excludes the current account", () => {
    expect(createDraft("replyAll", message, account)).toMatchObject({
      to: "design@example.com, noah@example.com",
      cc: "maya@example.com, priya@example.com",
      bcc: "",
    });
    expect(createDraft("replyAll", { ...message, replyTo: undefined }, account)).toMatchObject({
      to: "maya@example.com, noah@example.com",
      cc: "priya@example.com",
    });
  });

  it("falls back from malformed Reply-To and handles quoted Unicode senders", () => {
    expect(
      createDraft(
        "reply",
        { ...message, replyTo: ["invalid"], from: '"李 明" <li@example.com>' },
        account
      )
    ).toMatchObject({ to: "li@example.com" });
  });

  it("forwards sender, date, subject, recipients and body without reply metadata", () => {
    const draft = createDraft("forward", message, account);
    expect(draft.to).toBe("");
    expect(draft.subject).toBe("Fwd: Design review");
    expect(draft.replyToMessageId).toBeUndefined();
    expect(draft.internetMessageId).toBeUndefined();
    expect(draft.bodyText).toContain('From: "Chen, Maya" <maya@example.com>');
    expect(draft.bodyText).toContain("Date: Thu, 01 Oct 2026 09:00:00 GMT");
    expect(draft.bodyText).toContain("Subject: Design review");
    expect(draft.bodyText).toContain("To: Alex <ALEX@example.com>, Noah <noah@example.com>");
    expect(draft.bodyText).toContain(message.bodyText);
  });

  it("does not double existing reply or forward prefixes", () => {
    expect(
      createDraft("reply", { ...message, subject: "RE: Design review" }, account).subject
    ).toBe("RE: Design review");
    expect(
      createDraft("forward", { ...message, subject: "Fw: Design review" }, account).subject
    ).toBe("Fw: Design review");
    expect(createDraft("compose", undefined, account)).toMatchObject({
      to: "",
      subject: "",
      bodyText: "",
    });
  });
});
