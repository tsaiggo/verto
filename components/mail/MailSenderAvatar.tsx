import { mailSender } from "@/lib/mail/addresses";
import styles from "./MailWorkspace.module.css";

const tones = ["blue", "teal", "amber", "rose"] as const;

export default function MailSenderAvatar({
  from,
  compact = false,
}: {
  from: string;
  compact?: boolean;
}) {
  const sender = mailSender(from);
  const identity = (sender.address || sender.name)
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  let hash = 0;
  for (const character of identity) {
    hash = (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0;
  }

  return (
    <span
      className={`${styles.avatar}${compact ? ` ${styles.rowAvatar}` : ""}`}
      data-tone={tones[hash % tones.length]}
      aria-hidden
    >
      {sender.initials}
    </span>
  );
}
