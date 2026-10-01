import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraft, readDrafts, writeDrafts, type MailDraft } from "./drafts";
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

  afterEach(() => vi.unstubAllGlobals());

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
    const result = delivery.deliverMailDraft(
      connectorWith(() => task.promise),
      draft,
      outgoing
    );
    const marker = [...values.entries()].find(([key]) => key.startsWith("verto.mail.delivery.v1:"));
    expect(marker).toBeDefined();
    expect(JSON.parse(marker![1])).toMatchObject({ version: 1, accountKey, draftId: draft.id });
    expect(marker![1]).not.toContain(outgoing.subject);
    expect(marker![1]).not.toContain(outgoing.bodyText);
    expect(marker![1]).not.toContain(outgoing.to[0]);
    task.resolve();
    await result;
  });

  it("reports blocked storage after confirmed delivery without failing or automatically sending again", async () => {
    const delivery = await import("./delivery");
    const sendMessage = vi.fn(async () => {});
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("Storage blocked");
      },
    });
    await expect(
      delivery.deliverMailDraft(connectorWith(sendMessage), draftFor("blocked"), outgoing)
    ).resolves.toEqual({ storageSaved: false });
    expect(delivery.isDraftSending(accountKey, "blocked")).toBe(false);
    expect(delivery.draftDeliveryWarning(accountKey, "blocked")).toBeNull();
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("preserves corrupt draft storage and reports cleanup failure after a confirmed send", async () => {
    const delivery = await import("./delivery");
    values.set(draftStorageKey, "{damaged draft data");
    const sendMessage = vi.fn(async () => {});
    await expect(
      delivery.deliverMailDraft(connectorWith(sendMessage), draftFor("corrupt"), outgoing)
    ).resolves.toEqual({ storageSaved: false });
    expect(values.get(draftStorageKey)).toBe("{damaged draft data");
    expect(delivery.draftDeliveryWarning(accountKey, "corrupt")).toBeNull();
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("does not let a subscriber exception change the provider result", async () => {
    const delivery = await import("./delivery");
    const draft = draftFor("subscriber");
    writeDrafts(accountKey, [draft]);
    delivery.subscribeMailDelivery(() => {
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
  });
});
