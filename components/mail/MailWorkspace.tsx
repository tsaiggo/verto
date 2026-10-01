"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import MailConnectionStatus from "@/components/mail/MailConnectionStatus";
import MailWorkbench from "@/components/mail/MailWorkbench";
import MailAccountSwitcher, { type MailAccountOption } from "./MailAccountSwitcher";
import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import { Button } from "@/components/ui/button";
import { getMailConnectors } from "@/lib/mail/connectors";
import type { MailProviderId } from "@/lib/mail/model";
import { demoMailAccounts } from "@/lib/mail/demo";
import {
  connectMailAccount,
  disconnectMailAccount,
  getMailSession,
  restoreMailAccounts,
  selectMailAccount,
  useMailSession,
} from "@/lib/mail/session";
import {
  createUnifiedMailConnector,
  unifiedMailConnection,
  type MailAccountBinding,
} from "@/lib/mail/unified";
import { mailHref, readMailView } from "@/lib/mail/view-state";
import styles from "./MailWorkspace.module.css";

export default function MailWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const demo = searchParams?.get("demo") === "1";
  const connectors = useMemo(() => getMailConnectors(), []);
  const available = connectors.filter((connector) => connector.isConfigured());
  const session = useMailSession();
  const accounts: MailAccountBinding[] = demo ? demoMailAccounts : session.accounts;
  const requestedAccount = searchParams?.get("account");
  const [implicitScope, setImplicitScope] = useState<string | null>(() =>
    demo ? demoMailAccounts[0].id : session.activeAccountId
  );
  // Pin a legacy URL's mailbox when the registry first becomes available.
  if (!implicitScope && accounts.length)
    setImplicitScope(session.activeAccountId ?? accounts[0].id);
  const preferredScope = requestedAccount ?? implicitScope ?? session.activeAccountId;
  const scopeId =
    preferredScope === "all" && accounts.length > 1
      ? "all"
      : (accounts.find((account) => account.id === preferredScope)?.id ?? accounts[0]?.id);
  const missingAccount = Boolean(
    requestedAccount &&
    requestedAccount !== "all" &&
    accounts.length &&
    !accounts.some((account) => account.id === requestedAccount)
  );
  const selected = accounts.find((account) => account.id === scopeId) ?? accounts[0];
  const aggregate = useMemo(() => createUnifiedMailConnector(accounts), [accounts]);
  const aggregateConnection = useMemo(() => unifiedMailConnection(accounts), [accounts]);
  useEffect(() => {
    if (demo) return;
    if (!getMailSession().accounts.length) void restoreMailAccounts();
  }, [demo]);
  useEffect(() => {
    if (
      !demo &&
      requestedAccount &&
      requestedAccount === scopeId &&
      getMailSession().activeAccountId !== requestedAccount
    )
      selectMailAccount(requestedAccount);
  }, [demo, requestedAccount, scopeId]);
  useEffect(() => {
    if (!demo && !requestedAccount && scopeId)
      router.replace(
        mailHref({
          accountId: scopeId,
          folder: searchParams?.get("folder") ?? undefined,
          message: searchParams?.get("message") ?? undefined,
        })
      );
  }, [demo, requestedAccount, scopeId, router, searchParams]);

  const accountHref = useCallback(
    (id: string) => {
      const saved = readMailView(`${demo ? "demo:" : ""}${id}`);
      const folders =
        id === "all"
          ? aggregateConnection.folders
          : accounts.find((entry) => entry.id === id)?.connection.folders;
      return mailHref({
        demo,
        accountId: id,
        folder: saved?.folder ?? folders?.find((folder) => folder.kind === "inbox")?.id,
        message: saved?.message,
      });
    },
    [demo, accounts, aggregateConnection]
  );
  const chooseAccount = useCallback(
    (id: string) => router.push(accountHref(id)),
    [accountHref, router]
  );
  const connect = useCallback(
    async (provider: MailProviderId, address?: string) => {
      const account = await connectMailAccount(provider, address);
      if (account) router.push(mailHref({ accountId: account.id }));
      else if (getMailSession().message) throw new Error(getMailSession().message);
    },
    [router]
  );
  const disconnect = useCallback(
    async (id: string) => {
      await disconnectMailAccount(id);
      const remaining = getMailSession().accounts.find((entry) => entry.id === id);
      if (remaining)
        throw new Error(remaining.message ?? "This account could not be disconnected. Try again.");
      if (requestedAccount === id || (!requestedAccount && scopeId === id)) {
        const next = getMailSession().accounts[0];
        router.replace(mailHref({ accountId: next?.id }));
      }
    },
    [router, requestedAccount, scopeId]
  );
  const reconnect = useCallback(
    async (id: string) => {
      const entry = getMailSession().accounts.find((account) => account.id === id);
      if (entry) await connect(entry.connection.account.provider, entry.connection.account.address);
    },
    [connect]
  );
  const accountOptions: MailAccountOption[] = accounts.map((entry) => ({
    ...entry.connection.account,
    id: entry.id,
    unreadCount: entry.connection.folders.find((folder) => folder.kind === "inbox")?.unreadCount,
    status: entry.status === "error" ? "reauth-required" : "connected",
    message: entry.message,
  }));
  const accountControl = scopeId && (
    <MailAccountSwitcher
      accounts={accountOptions}
      selectedId={scopeId}
      onSelect={chooseAccount}
      accountHref={accountHref}
      onAdd={connect}
      onDisconnect={demo ? undefined : disconnect}
      onReconnect={demo ? undefined : reconnect}
      demo={demo}
      availableProviders={available.map((item) => item.id)}
      addingProvider={session.connectingProvider}
      allInboxes={
        accounts.length > 1
          ? { unreadCount: aggregateConnection.folders[0].unreadCount }
          : undefined
      }
    />
  );

  if (selected) {
    const all = scopeId === "all";
    if (missingAccount)
      return (
        <div className={`${styles.page} ${styles.workbenchPage}`}>
          <header className={styles.workbenchHeader}>
            <div className={styles.workbenchIdentity}>
              <h1>Mail</h1>
              {accountControl}
            </div>
          </header>
          <div className={styles.frame}>
            <section className={styles.connectPanel}>
              <div className={styles.connectBody}>
                <h2>This account is unavailable</h2>
                <p>Choose a connected account to continue reading.</p>
              </div>
            </section>
          </div>
        </div>
      );
    if (!all && selected.status === "error")
      return (
        <div className={`${styles.page} ${styles.workbenchPage}`}>
          <header className={styles.workbenchHeader}>
            <div className={styles.workbenchIdentity}>
              <h1>Mail</h1>
              {accountControl}
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={Boolean(session.connectingProvider)}
              onClick={() => void reconnect(selected.id).catch(() => {})}
            >
              Reconnect {selected.connector.id === "google" ? "Gmail" : "Outlook"}
            </button>
          </header>
          <div className={styles.frame}>
            <section className={styles.connectPanel}>
              <Mail className={styles.connectIcon} aria-hidden />
              <div className={styles.connectBody}>
                <h2>Sign in to continue</h2>
                <p role="alert">
                  {session.message ??
                    selected.message ??
                    "Reconnect this mailbox to read its messages."}
                </p>
                <p>Your local drafts are kept on this browser.</p>
              </div>
            </section>
          </div>
        </div>
      );
    return (
      <MailWorkbench
        key={`${demo ? "demo:" : ""}${scopeId}`}
        connector={all ? aggregate : selected.connector}
        connection={all ? aggregateConnection : selected.connection}
        accounts={accounts}
        scopeId={scopeId}
        accountParam={requestedAccount ?? undefined}
        accountControl={accountControl}
        demo={demo}
        connectionNotice={!demo ? (session.message ?? selected.message) : undefined}
      />
    );
  }

  return (
    <div className={`${styles.page} ${styles.setupPage}`}>
      <PageHeader title="Mail" subtitle="Read your mail alongside your library." frame="wide" />
      <PageFrame size="wide" className={styles.frame}>
        <section className={styles.connectPanel} id="connect" aria-labelledby="connect-title">
          <span className={styles.connectIcon} aria-hidden="true">
            <Mail />
          </span>
          <div className={styles.connectBody}>
            <MailConnectionStatus session={session} configured={available.length > 0} />
            {available.length > 0 && (
              <p>
                Connect with read-only access first. Sending asks for separate permission when you
                enable it.
              </p>
            )}
            {available.length > 0 ? (
              <div className={styles.connectActions}>
                {available.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    disabled={session.status === "connecting" || session.status === "restoring"}
                    onClick={() => void connect(item.id).catch(() => {})}
                  >
                    {session.status === "restoring"
                      ? "Preparing…"
                      : session.status === "connecting"
                        ? "Connecting…"
                        : `Connect ${item.label}`}
                  </Button>
                ))}
              </div>
            ) : null}
            <div className={styles.connectActions}>
              <Link href="/mail?demo=1" className={styles.quietButton}>
                Explore a sample inbox
              </Link>
            </div>
          </div>
        </section>
      </PageFrame>
    </div>
  );
}
