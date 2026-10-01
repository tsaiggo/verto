"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MailAccountBinding } from "@/lib/mail/unified";
import styles from "./MailWorkspace.module.css";

export default function MailFromPicker({
  accounts,
  selectedId,
  disabled,
  onSelect,
}: {
  accounts: MailAccountBinding[];
  selectedId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const selected = accounts.find((entry) => entry.id === selectedId);
  if (!selected) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={styles.fromPicker}
          disabled={disabled}
          aria-label={`From account: ${selected.connection.account.address}`}
        >
          <span>{selected.connection.account.address}</span>
          <ChevronDown aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={styles.fromMenu}>
        {accounts.map((entry) => (
          <DropdownMenuItem
            key={entry.id}
            className={styles.fromOption}
            onSelect={() => onSelect(entry.id)}
          >
            <span>
              <strong>{entry.connection.account.displayName}</strong>
              <span>{entry.connection.account.address}</span>
            </span>
            {entry.id === selectedId && <Check aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
