"use client";

import Image from "next/image";
import { useState } from "react";
import { mailSender } from "@/lib/mail/addresses";
import { getSenderBrand } from "@/lib/mail/sender-brands";
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
  const brand = getSenderBrand(sender.address);
  const [failedAsset, setFailedAsset] = useState<string | null>(null);
  const visibleBrand = brand?.asset !== failedAsset ? brand : undefined;
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
      className={`${styles.avatar}${compact ? ` ${styles.rowAvatar}` : ""}${visibleBrand ? ` ${styles.brandAvatar}` : ""}`}
      data-tone={tones[hash % tones.length]}
      data-brand={visibleBrand?.id}
      aria-hidden
    >
      {visibleBrand ? (
        <Image
          src={visibleBrand.asset}
          alt=""
          width={24}
          height={24}
          unoptimized
          className={styles.brandMark}
          onError={() => setFailedAsset(visibleBrand.asset)}
        />
      ) : (
        sender.initials
      )}
    </span>
  );
}
