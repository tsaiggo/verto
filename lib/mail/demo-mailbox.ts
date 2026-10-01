import type { MailConnection, MailConnector, MailMessage } from "./model";

let version = 0;
const listeners = new Set<() => void>();
export function getDemoMailboxVersion() {
  return version;
}
export function subscribeDemoMailboxes(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Mutations are local sample data, never a provider request. */
export function createDemoMailbox(
  connection: MailConnection,
  source: MailMessage[],
  getAttachment?: MailConnector["getAttachment"]
): MailConnector {
  const records = new Map(source.map((message) => [message.id, structuredClone(message)]));
  const inbox = connection.folders.find((folder) => folder.kind === "inbox")!.id;
  const memberships = new Map(source.map((message) => [message.id, [inbox]]));
  const storageKey = `verto.mail.demo-actions.v1:${connection.account.provider}:${connection.account.id}`;
  let lastSaved: string | null | undefined;
  function restoreActions() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === lastSaved) return;
      lastSaved = raw;
      const saved = JSON.parse(raw ?? "[]");
      if (!Array.isArray(saved)) return;
      for (const item of saved) {
        const message = records.get(item?.id);
        if (!message || !Array.isArray(item.folders)) continue;
        const folders = item.folders.filter((id: unknown) =>
          connection.folders.some((folder) => folder.id === id)
        );
        if (!folders.length) continue;
        memberships.set(message.id, folders);
        if (typeof item.isRead === "boolean") message.isRead = item.isRead;
        if (typeof item.isStarred === "boolean") message.isStarred = item.isStarred;
      }
    } catch {
      // A sample mailbox remains usable if browser storage is unavailable.
    }
    refreshCounts();
  }
  function refreshCounts() {
    for (const folder of connection.folders)
      if (folder.unreadCount !== undefined)
        folder.unreadCount = [...records.values()].filter(
          (message) => !message.isRead && memberships.get(message.id)?.includes(folder.id)
        ).length;
  }
  function detail(id: string) {
    restoreActions();
    const message = records.get(id);
    if (!message) throw new Error("This example message is unavailable.");
    return structuredClone(message);
  }
  return {
    id: connection.account.provider,
    label: `${connection.account.provider === "google" ? "Gmail" : "Outlook"} example mailbox`,
    isConfigured: () => true,
    connect: async () => {},
    disconnect: async () => {},
    restore: async () => {
      restoreActions();
      return connection;
    },
    listMessages: async (folderId) => {
      restoreActions();
      return {
        messages: [...records.values()]
          .filter((message) => memberships.get(message.id)?.includes(folderId))
          .map((message) => ({
            id: message.id,
            subject: message.subject,
            from: message.from,
            receivedAt: message.receivedAt,
            preview: message.preview,
            isRead: message.isRead,
            isStarred: Boolean(message.isStarred),
            hasAttachments: message.hasAttachments,
          })),
      };
    },
    getMessage: async (id) => detail(id),
    ...(getAttachment ? { getAttachment } : {}),
    enableUpdating: async () => {},
    mutateMessage: async (id, action) => {
      restoreActions();
      const message = records.get(id);
      if (!message) throw new Error("This example message is unavailable.");
      if (action.type === "read") message.isRead = action.value;
      else if (action.type === "star") message.isStarred = action.value;
      else {
        const destination = connection.folders.find(
          (folder) => folder.kind === (action.type === "trash" ? "trash" : "archive")
        );
        if (!destination) throw new Error("This example folder is unavailable.");
        memberships.set(id, [destination.id]);
      }
      refreshCounts();
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify(
            [...records.values()].map((item) => ({
              id: item.id,
              isRead: item.isRead,
              isStarred: Boolean(item.isStarred),
              folders: memberships.get(item.id),
            }))
          )
        );
      } catch {
        // Sample actions can still be reviewed for the current page lifetime.
      }
      version += 1;
      for (const listener of listeners) listener();
      return { message: detail(id), folderIds: [...(memberships.get(id) ?? [])] };
    },
  };
}
