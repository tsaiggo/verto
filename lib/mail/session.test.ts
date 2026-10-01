import { afterEach, describe, expect, it, vi } from "vitest";
import { getMailSession, setMailSession, subscribeMailSession } from "./session";

afterEach(() => {
  setMailSession({ status: "disconnected", connection: null });
});

describe("mail session shared between the workspace and sidebar", () => {
  it("notifies every mounted view when an account connects and stops notifying unmounted views", () => {
    const sidebar = vi.fn();
    const workspace = vi.fn();
    const stopSidebar = subscribeMailSession(sidebar);
    const stopWorkspace = subscribeMailSession(workspace);
    const connection = {
      account: {
        id: "google-account",
        address: "reader@example.com",
        displayName: "Reader",
        provider: "google" as const,
      },
      folders: [{ id: "INBOX", name: "Inbox", kind: "inbox" as const }],
    };

    setMailSession({ status: "connected", connection });
    expect(getMailSession()).toMatchObject({
      status: "connected",
      connection,
      activeAccountId: "google:google-account",
      accounts: [{ connection }],
    });
    expect(sidebar).toHaveBeenCalledOnce();
    expect(workspace).toHaveBeenCalledOnce();

    stopSidebar();
    setMailSession({ status: "disconnected", connection: null });
    expect(sidebar).toHaveBeenCalledOnce();
    expect(workspace).toHaveBeenCalledTimes(2);
    stopWorkspace();
  });
});
