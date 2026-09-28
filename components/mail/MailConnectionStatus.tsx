import { StatusNotice } from "@/components/feedback/StatusNotice";
import type { MailSession } from "@/lib/mail/session";
import styles from "./MailWorkspace.module.css";

const connectionNoticeCopy = {
  restoring: {
    tone: "pending",
    title: "Checking your mail connection",
    description: "Looking for an existing Gmail or Outlook session.",
  },
  connecting: {
    tone: "pending",
    title: "Connecting your mail account",
    description: "Complete the provider sign-in to continue.",
  },
  disconnected: {
    tone: "warning",
    title: "Mail is not configured",
    description: "Gmail or Outlook needs provider setup before you can connect.",
  },
} as const;

export default function MailConnectionStatus({
  session,
  configured,
}: {
  session: MailSession;
  configured: boolean;
}) {
  if (session.status === "connected" || (session.status === "disconnected" && configured))
    return null;
  const notice =
    session.status === "error"
      ? {
          tone: "warning" as const,
          title: "Mail connection needs attention",
          description: session.message,
        }
      : connectionNoticeCopy[session.status];
  return <StatusNotice {...notice} className={styles.connectNotice} />;
}
