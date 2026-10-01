"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Mail } from "lucide-react";
import MailConnectionStatus from "@/components/mail/MailConnectionStatus";
import MailWorkbench from "@/components/mail/MailWorkbench";
import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import { Button } from "@/components/ui/button";
import { getMailConnectors } from "@/lib/mail/connectors";
import type { MailConnector } from "@/lib/mail/model";
import { demoConnection, demoConnector } from "@/lib/mail/demo";
import { getMailSession, setMailSession, useMailSession } from "@/lib/mail/session";
import styles from "./MailWorkspace.module.css";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Mail could not be loaded.";
}

export default function MailWorkspace() {
  const searchParams = useSearchParams();
  const demo = searchParams?.get("demo") === "1";
  const connectors = useMemo(() => getMailConnectors(), []);
  const available = connectors.filter((connector) => connector.isConfigured());
  const session = useMailSession();
  const sessionRequest = useRef(0);

  useEffect(() => {
    if (demo) return;
    if (getMailSession().connection) return;
    let cancelled = false;
    const request = ++sessionRequest.current;
    if (available.length) setMailSession({ status: "restoring", connection: null });
    async function restore() {
      for (const connector of available) {
        try {
          const connection = await connector.restore();
          if (cancelled || request !== sessionRequest.current) return;
          if (connection) {
            setMailSession({ status: "connected", connection });
            return;
          }
        } catch (error) {
          if (!cancelled && request === sessionRequest.current) {
            setMailSession({ status: "error", connection: null, message: errorMessage(error) });
          }
          return;
        }
      }
      if (!cancelled && request === sessionRequest.current) {
        setMailSession({ status: "disconnected", connection: null });
      }
    }
    void restore();
    return () => {
      cancelled = true;
      sessionRequest.current += 1;
    };
    // Connector configuration is fixed for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);

  const connect = useCallback(async (connector: MailConnector) => {
    const request = ++sessionRequest.current;
    setMailSession({ status: "connecting", connection: null });
    try {
      await connector.connect();
      const connection = await connector.restore();
      if (request !== sessionRequest.current) return;
      setMailSession(
        connection
          ? { status: "connected", connection }
          : { status: "disconnected", connection: null }
      );
    } catch (error) {
      if (request === sessionRequest.current) {
        setMailSession({ status: "error", connection: null, message: errorMessage(error) });
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    const request = ++sessionRequest.current;
    const provider = session.connection?.account.provider;
    const connector = connectors.find((item) => item.id === provider);
    if (!connector) return;
    try {
      await connector.disconnect();
      if (request === sessionRequest.current) {
        setMailSession({ status: "disconnected", connection: null });
      }
    } catch (error) {
      if (request === sessionRequest.current) {
        setMailSession({ status: "error", connection: null, message: errorMessage(error) });
      }
    }
  }, [connectors, session.connection]);

  const connector = connectors.find((item) => item.id === session.connection?.account.provider);

  if (demo) {
    return <MailWorkbench key="demo" connector={demoConnector} connection={demoConnection} demo />;
  }
  if (session.connection && connector) {
    return (
      <MailWorkbench
        key={`${connector.id}:${session.connection.account.address}`}
        connector={connector}
        connection={session.connection}
        onDisconnect={disconnect}
      />
    );
  }

  return (
    <div className={styles.page}>
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
                    onClick={() => void connect(item)}
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
