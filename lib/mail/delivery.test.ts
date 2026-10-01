import { IDBFactory, IDBObjectStore as FakeObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDraft,
  draftClaimKey,
  draftStorageRequest,
  mailDraftVersion,
  moveMailDraft,
  readDrafts,
  removeMailDraft,
  saveMailDraft,
  saveMailDraftWithStatus,
  withDraftStorage,
  writeDrafts,
  type MailDraft,
} from "./drafts";
import type { MailConnector, MailOutgoing } from "./model";

const account = { provider: "google" as const, address: "alice@example.com" };
const accountKey = "google:alice@example.com";
const draftStorageKey = `verto.mail.drafts.v1:${encodeURIComponent(accountKey)}`;
const outgoing: MailOutgoing = {
  to: ["bob@example.com"],
  cc: [],
  bcc: [],
  subject: "A private subject",
  bodyText: "A private message body",
};

function draftFor(id: string, address = account.address): MailDraft {
  return {
    ...createDraft("compose", undefined, { ...account, address }),
    id,
    ...outgoing,
    to: outgoing.to.join(", "),
    cc: "",
    bcc: "",
  };
}

function connectorWith(sendMessage: MailConnector["sendMessage"]): MailConnector {
  return {
    id: "google",
    label: "Mock mailbox",
    isConfigured: () => true,
    connect: async () => {},
    restore: async () => null,
    disconnect: async () => {},
    listMessages: async () => ({ messages: [] }),
    getMessage: async () => {
      throw new Error("Unused");
    },
    sendMessage,
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("account-scoped mail delivery", () => {
  let values: Map<string, string>;
  let storage: Pick<Storage, "getItem" | "setItem" | "removeItem">;

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("indexedDB", new IDBFactory());
    values = new Map();
    storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
    };
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("claims a draft before yielding and rejects a second send while subscribers observe settlement", async () => {
    const delivery = await import("./delivery");
    const task = deferred();
    const sendMessage = vi.fn(() => task.promise);
    const connector = connectorWith(sendMessage);
    const draft = draftFor("draft-1");
    writeDrafts(accountKey, [draft]);
    const changed = vi.fn();
    const unsubscribe = delivery.subscribeMailDelivery(changed);
    const result = delivery.deliverMailDraft(connector, draft, outgoing);

    expect(delivery.isDraftSending(accountKey, draft.id)).toBe(true);
    expect(delivery.isDraftSending(" GOOGLE:ALICE@EXAMPLE.COM ", draft.id)).toBe(true);
    expect(delivery.draftDeliveryWarning(accountKey, draft.id)).toBeNull();
    await expect(delivery.deliverMailDraft(connector, draft, outgoing)).rejects.toThrow(
      "already being sent"
    );
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledTimes(1);
    task.resolve();
    await expect(result).resolves.toEqual({ storageSaved: true });
    expect(delivery.isDraftSending(accountKey, draft.id)).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("cleans only the captured draft after subscribers leave and preserves newer drafts and other accounts", async () => {
    const delivery = await import("./delivery");
    const task = deferred();
    const draft = draftFor("sent-draft");
    const kept = draftFor("kept-draft");
    const anotherAccount = draftFor("sent-draft", "other@example.com");
    writeDrafts(accountKey, [draft, kept]);
    writeDrafts(anotherAccount.accountKey, [anotherAccount]);
    const changed = vi.fn();
    const unsubscribe = delivery.subscribeMailDelivery(changed);
    const result = delivery.deliverMailDraft(
      connectorWith(() => task.promise),
      draft,
      outgoing
    );
    unsubscribe();
    const newer = draftFor("newer-draft");
    const edited = { ...kept, bodyText: "Edited during the send" };
    writeDrafts(accountKey, [draft, edited, newer]);

    task.resolve();
    await expect(result).resolves.toEqual({ storageSaved: true });
    expect(
      readDrafts(accountKey)
        .map((item) => item.id)
        .sort()
    ).toEqual(["kept-draft", "newer-draft"]);
    expect(readDrafts(accountKey).find((item) => item.id === kept.id)?.bodyText).toBe(
      edited.bodyText
    );
    expect(readDrafts(anotherAccount.accountKey)).toEqual([anotherAccount]);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(delivery.draftDeliveryWarning(accountKey, draft.id)).toBeNull();
  });

  it("keeps a failed draft and its advisory through module reload, then retries only on another explicit send", async () => {
    let delivery = await import("./delivery");
    const task = deferred();
    const draft = draftFor("retry-draft");
    const sendMessage = vi.fn(() => task.promise);
    writeDrafts(accountKey, [draft]);
    const result = delivery.deliverMailDraft(connectorWith(sendMessage), draft, outgoing);
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());
    task.reject(new Error("Provider response lost"));
    await expect(result).rejects.toThrow("Provider response lost");

    expect(delivery.isDraftSending(accountKey, draft.id)).toBe(false);
    expect(readDrafts(accountKey)).toEqual([draft]);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    vi.resetModules();
    delivery = await import("./delivery");
    expect(delivery.draftDeliveryWarning(accountKey, draft.id)).toBe(
      "Previous send could not be confirmed. Check Sent before retrying."
    );
    const retry = vi.fn(async () => {});
    await expect(delivery.deliverMailDraft(connectorWith(retry), draft, outgoing)).resolves.toEqual(
      { storageSaved: true }
    );
    expect(retry).toHaveBeenCalledTimes(1);
    expect(readDrafts(accountKey)).toEqual([]);
    expect(delivery.draftDeliveryWarning(accountKey, draft.id)).toBeNull();
  });

  it("writes only identity and time to the interrupted-send marker", async () => {
    const delivery = await import("./delivery");
    const task = deferred();
    const draft = draftFor("private-draft");
    writeDrafts(accountKey, [draft]);
    const sendMessage = vi.fn(() => task.promise);
    const result = delivery.deliverMailDraft(connectorWith(sendMessage), draft, outgoing);
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());
    const marker = [...values.entries()].find(([key]) => key.startsWith("verto.mail.delivery.v1:"));
    expect(marker).toBeDefined();
    expect(JSON.parse(marker![1])).toMatchObject({ version: 1, accountKey, draftId: draft.id });
    expect(marker![1]).not.toContain(outgoing.subject);
    expect(marker![1]).not.toContain(outgoing.bodyText);
    expect(marker![1]).not.toContain(outgoing.to[0]);
    task.resolve();
    await result;
  });

  it("rejects blocked storage before calling the provider", async () => {
    const delivery = await import("./delivery");
    const sendMessage = vi.fn(async () => {});
    writeDrafts(accountKey, [draftFor("blocked")]);
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("Storage blocked");
      },
    });
    await expect(
      delivery.deliverMailDraft(connectorWith(sendMessage), draftFor("blocked"), outgoing)
    ).rejects.toThrow("Browser storage is unavailable");
    expect(delivery.isDraftSending(accountKey, "blocked")).toBe(false);
    expect(delivery.draftDeliveryWarning(accountKey, "blocked")).toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("preserves corrupt draft storage and reports cleanup failure after a confirmed send", async () => {
    const delivery = await import("./delivery");
    const draft = draftFor("corrupt");
    writeDrafts(accountKey, [draft]);
    const task = deferred();
    const sendMessage = vi.fn(() => task.promise);
    const result = delivery.deliverMailDraft(connectorWith(sendMessage), draft, outgoing);
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());
    values.set(draftStorageKey, "{damaged draft data");
    task.resolve();
    await expect(result).resolves.toEqual({ storageSaved: false });
    expect(values.get(draftStorageKey)).toBe("{damaged draft data");
    expect(delivery.draftDeliveryWarning(accountKey, "corrupt")).toContain("This message was sent");
    expect(sendMessage).toHaveBeenCalledTimes(1);
    await expect(
      delivery.deliverMailDraft(connectorWith(sendMessage), draftFor("corrupt"), outgoing)
    ).rejects.toThrow("already sent");
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("rejects corrupt draft storage before reserving or calling the provider", async () => {
    const delivery = await import("./delivery");
    const draft = draftFor("damaged-before-send");
    writeDrafts(accountKey, [draft]);
    values.set(draftStorageKey, "{damaged draft data");
    const sendMessage = vi.fn(async () => {});
    await expect(
      delivery.deliverMailDraft(connectorWith(sendMessage), draft, outgoing)
    ).rejects.toThrow();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(values.get(draftStorageKey)).toBe("{damaged draft data");
    expect([...values.keys()].some((key) => key.startsWith("verto.mail.delivery.v1:"))).toBe(false);
  });

  it.each(["removed", "moved"])(
    "rejects a stale captured draft after it was %s without calling the provider",
    async (operation) => {
      const delivery = await import("./delivery");
      const draft = draftFor(`stale-${operation}`);
      writeDrafts(accountKey, [draft]);
      if (operation === "removed")
        await expect(removeMailDraft(accountKey, draft.id)).resolves.toBe(true);
      else
        await expect(
          moveMailDraft({ ...draft, accountKey: "google:other@example.com" }, accountKey)
        ).resolves.toBe(true);
      expect(readDrafts(accountKey)).toEqual([]);
      const sendMessage = vi.fn(async () => {});
      await expect(
        delivery.deliverMailDraft(connectorWith(sendMessage), draft, outgoing)
      ).rejects.toThrow();
      expect(sendMessage).not.toHaveBeenCalled();
      expect([...values.keys()].some((key) => key.startsWith("verto.mail.delivery.v1:"))).toBe(
        false
      );
      if (operation === "moved")
        expect(readDrafts("google:other@example.com")).toEqual([
          { ...draft, accountKey: "google:other@example.com", revision: 1 },
        ]);
    }
  );

  it("rejects a captured send after another editor saves a new version, without deleting its words or claiming delivery", async () => {
    const delivery = await import("./delivery");
    const captured = draftFor("changed-before-reservation");
    writeDrafts(accountKey, [captured]);
    const otherEditor = readDrafts(accountKey)[0];
    await expect(
      saveMailDraftWithStatus(
        { ...otherEditor, bodyText: "Newer words from the other window" },
        {
          expectedVersion: mailDraftVersion(otherEditor),
        }
      )
    ).resolves.toMatchObject({ status: "saved" });
    const sendMessage = vi.fn(async () => {});
    await expect(
      delivery.deliverMailDraft(connectorWith(sendMessage), captured, outgoing)
    ).rejects.toThrow("updated in another mail window");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(readDrafts(accountKey)[0].bodyText).toBe("Newer words from the other window");
    expect(delivery.isDraftSending(accountKey, captured.id)).toBe(false);
    expect(delivery.draftDeliveryWarning(accountKey, captured.id)).toBeNull();
    await withDraftStorage(async (claims) => {
      expect(
        await draftStorageRequest(claims.get(draftClaimKey(accountKey, captured.id)))
      ).toBeUndefined();
    });
    const loaded = readDrafts(accountKey)[0];
    await expect(
      delivery.deliverMailDraft(connectorWith(sendMessage), loaded, {
        ...outgoing,
        bodyText: loaded.bodyText,
      })
    ).resolves.toEqual({ storageSaved: true });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ bodyText: loaded.bodyText })
    );
    expect(readDrafts(accountKey)).toEqual([]);
  });

  it("guards a newer save queued after preparation but before the delivery reservation commits", async () => {
    const delivery = await import("./delivery");
    const prepared = draftFor("prepared-before-other-save");
    writeDrafts(accountKey, [prepared]);
    let otherSave: ReturnType<typeof saveMailDraftWithStatus> | undefined;
    const unsubscribe = delivery.subscribeMailDelivery(() => {
      // Delivery announces its in-memory claim before opening the shared transaction.
      // Another window can already have an edit queued when reservation starts.
      if (!otherSave)
        otherSave = saveMailDraftWithStatus(
          { ...prepared, bodyText: "Saved after send preparation" },
          { expectedVersion: mailDraftVersion(prepared) }
        );
    });
    const sendMessage = vi.fn(async () => {});
    try {
      const result = delivery
        .deliverMailDraft(connectorWith(sendMessage), prepared, outgoing)
        .catch((error: unknown) => error);
      expect(otherSave).toBeDefined();
      expect(await otherSave).toMatchObject({ status: "saved" });
      expect(await result).toMatchObject({
        message: expect.stringContaining("updated in another mail window"),
      });
      expect(sendMessage).not.toHaveBeenCalled();
      expect(readDrafts(accountKey)[0].bodyText).toBe("Saved after send preparation");
      expect(delivery.draftDeliveryWarning(accountKey, prepared.id)).toBeNull();
    } finally {
      unsubscribe();
    }
  });

  it("keeps the draft and interrupted marker if the confirmed receipt transaction aborts before commit", async () => {
    const delivery = await import("./delivery");
    const draft = draftFor("receipt-aborted");
    writeDrafts(accountKey, [draft]);
    const task = deferred();
    const sendMessage = vi.fn(() => task.promise);
    const result = delivery.deliverMailDraft(connectorWith(sendMessage), draft, outgoing);
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());
    const markerKey = `verto.mail.delivery.v1:${encodeURIComponent(draftClaimKey(accountKey, draft.id))}`;
    expect(values.has(markerKey)).toBe(true);
    const originalPut = FakeObjectStore.prototype.put;
    const put = vi.spyOn(FakeObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      const request = originalPut.call(this, value, key);
      if (this.name === "claims" && value.state === "confirmed") {
        request.addEventListener("success", () => this.transaction.abort(), { once: true });
      }
      return request;
    });
    task.resolve();
    await expect(result).resolves.toEqual({ storageSaved: false });
    put.mockRestore();
    expect(readDrafts(accountKey)).toEqual([draft]);
    expect(values.has(markerKey)).toBe(true);
    expect(storage.removeItem).not.toHaveBeenCalled();
    const claim = await withDraftStorage(async (claims) =>
      draftStorageRequest<{ state: string; leaseUntil: number }>(
        claims.get(draftClaimKey(accountKey, draft.id))
      )
    );
    expect(claim.state).toBe("pending");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(claim.leaseUntil + 1);
    vi.resetModules();
    const reloaded = await import("./delivery");
    expect(reloaded.isDraftSending(accountKey, draft.id)).toBe(false);
    expect(reloaded.draftDeliveryWarning(accountKey, draft.id)).toContain(
      "Check Sent before retrying"
    );
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it("does not let a subscriber exception change the provider result", async () => {
    const delivery = await import("./delivery");
    const draft = draftFor("subscriber");
    writeDrafts(accountKey, [draft]);
    const unsubscribe = delivery.subscribeMailDelivery(() => {
      throw new Error("UI already gone");
    });
    await expect(
      delivery.deliverMailDraft(
        connectorWith(async () => {}),
        draft,
        outgoing
      )
    ).resolves.toEqual({ storageSaved: true });
    expect(readDrafts(accountKey)).toEqual([]);
    unsubscribe();
  });

  it("atomically rejects the same send across separate tab contexts without clearing the owner's claim", async () => {
    const firstTab = await import("./delivery");
    vi.resetModules();
    const secondTab = await import("./delivery");
    const task = deferred();
    const draft = draftFor("shared-draft");
    writeDrafts(accountKey, [draft]);
    const firstSend = vi.fn(() => task.promise);
    const secondSend = vi.fn(async () => {});
    const first = firstTab.deliverMailDraft(connectorWith(firstSend), draft, outgoing);
    const second = secondTab
      .deliverMailDraft(connectorWith(secondSend), draft, outgoing)
      .catch((error: unknown) => error);
    await vi.waitFor(() => expect(firstSend).toHaveBeenCalledOnce());
    expect(await second).toBeInstanceOf(Error);
    expect(secondSend).not.toHaveBeenCalled();
    expect(secondTab.isDraftSending(accountKey, draft.id)).toBe(true);
    await expect(saveMailDraft({ ...draft, bodyText: "An edit during delivery" })).resolves.toBe(
      false
    );
    await expect(removeMailDraft(accountKey, draft.id)).resolves.toBe(false);
    await expect(
      moveMailDraft({ ...draft, accountKey: "google:other@example.com" }, accountKey)
    ).resolves.toBe(false);
    expect(readDrafts(accountKey)).toEqual([draft]);
    task.resolve();
    await expect(first).resolves.toEqual({ storageSaved: true });
    expect(secondTab.isDraftSending(accountKey, draft.id)).toBe(false);
    await expect(
      secondTab.deliverMailDraft(connectorWith(secondSend), draft, outgoing)
    ).rejects.toThrow("already sent");
    expect(secondSend).not.toHaveBeenCalled();
    await expect(saveMailDraft(draft, true)).resolves.toBe(false);
    expect(readDrafts(accountKey)).toEqual([]);
  });

  it("allows different accounts with the same draft ID to send concurrently", async () => {
    const delivery = await import("./delivery");
    const task = deferred();
    const first = draftFor("same-id");
    const second = draftFor("same-id", "other@example.com");
    writeDrafts(first.accountKey, [first]);
    writeDrafts(second.accountKey, [second]);
    const firstSend = vi.fn(() => task.promise);
    const firstResult = delivery.deliverMailDraft(connectorWith(firstSend), first, outgoing);
    const secondSend = vi.fn(async () => {});
    await expect(
      delivery.deliverMailDraft(connectorWith(secondSend), second, outgoing)
    ).resolves.toEqual({ storageSaved: true });
    expect(secondSend).toHaveBeenCalledOnce();
    expect(readDrafts(first.accountKey)).toEqual([first]);
    task.resolve();
    await firstResult;
  });

  it("requires an explicit retry after a crashed window's lease expires", async () => {
    const delivery = await import("./delivery");
    const draft = draftFor("crashed");
    writeDrafts(accountKey, [draft]);
    const leaseUntil = Date.now() - 1;
    await withDraftStorage(async (claims) => {
      await draftStorageRequest(
        claims.put(
          { owner: "closed-window", state: "pending", leaseUntil },
          draftClaimKey(accountKey, draft.id)
        )
      );
    });
    const markerKey = `verto.mail.delivery.v1:${encodeURIComponent(draftClaimKey(accountKey, draft.id))}`;
    values.set(
      markerKey,
      JSON.stringify({ version: 1, owner: "closed-window", state: "pending", leaseUntil })
    );
    const sendMessage = vi.fn(async () => {});
    expect(delivery.isDraftSending(accountKey, draft.id)).toBe(false);
    expect(delivery.draftDeliveryWarning(accountKey, draft.id)).toContain(
      "Check Sent before retrying"
    );
    expect(sendMessage).not.toHaveBeenCalled();
    await expect(
      delivery.deliverMailDraft(connectorWith(sendMessage), draft, outgoing)
    ).resolves.toEqual({ storageSaved: true });
    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it("wakes subscribed composers when a crashed sender's lease expires without a storage event", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    const delivery = await import("./delivery");
    const id = "expired-composer";
    const markerKey = `verto.mail.delivery.v1:${encodeURIComponent(draftClaimKey(accountKey, id))}`;
    values.set(
      markerKey,
      JSON.stringify({
        version: 1,
        owner: "closed-window",
        state: "pending",
        leaseUntil: Date.now() + 5000,
      })
    );
    const changed = vi.fn(() => delivery.isDraftSending(accountKey, id));
    const unsubscribe = delivery.subscribeMailDelivery(changed);
    expect(delivery.isDraftSending(accountKey, id)).toBe(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(changed).toHaveReturnedWith(false);
    expect(delivery.draftDeliveryWarning(accountKey, id)).toContain("Check Sent before retrying");
    unsubscribe();
  });

  it("never calls the provider if IndexedDB cannot reserve shared delivery ownership", async () => {
    const delivery = await import("./delivery");
    const draft = draftFor("no-indexeddb");
    writeDrafts(accountKey, [draft]);
    vi.stubGlobal("indexedDB", undefined);
    const sendMessage = vi.fn(async () => {});
    await expect(
      delivery.deliverMailDraft(connectorWith(sendMessage), draft, outgoing)
    ).rejects.toThrow("Shared draft storage is unavailable");
    expect(sendMessage).not.toHaveBeenCalled();
    expect(readDrafts(accountKey)).toEqual([draft]);
  });
});
