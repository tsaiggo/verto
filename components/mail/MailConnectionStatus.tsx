import type { MailSession } from "@/lib/mail/session";
import styles from "./MailWorkspace.module.css";

export default function MailConnectionStatus({
  session,
  configured,
}: {
  session: MailSession;
  configured: boolean;
}) {
  const title =
    session.status === "restoring"
      ? "Checking your mail connection"
      : session.status === "connecting"
        ? "Connecting your mail account"
        : session.status === "error"
          ? "Mail connection needs attention"
          : configured
            ? "Connect your mail"
            : "Mail is not configured";
  const description =
    session.status === "error"
      ? session.message
      : session.status === "connecting"
        ? "Complete the provider sign-in to continue."
        : !configured
          ? "Gmail or Outlook needs provider setup before you can connect."
          : null;
  return (
    <div
      className={styles.connectionState}
      role={
        session.status === "error"
          ? "alert"
          : session.status === "connecting" || session.status === "restoring"
            ? "status"
            : undefined
      }
    >
      <h2 id="connect-title">{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
