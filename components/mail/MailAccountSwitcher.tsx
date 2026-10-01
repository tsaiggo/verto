"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Inbox, LayoutGrid, Mail, Plus, Settings2 } from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { MailProviderId } from "@/lib/mail/model";
import styles from "./MailAccountSwitcher.module.css";

export interface MailAccountOption {
  id: string;
  address: string;
  displayName?: string;
  provider: MailProviderId;
  unreadCount?: number;
  status?: "connected" | "reauth-required" | "unavailable";
  message?: string;
}

export interface MailAccountSwitcherProps {
  accounts: MailAccountOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  accountHref?: (id: string) => string;
  onAdd: (provider: MailProviderId) => void | Promise<void>;
  onDisconnect?: (id: string) => void | Promise<void>;
  onReconnect?: (id: string) => void | Promise<void>;
  availableProviders?: MailProviderId[];
  addingProvider?: MailProviderId | null;
  allInboxes?: { unreadCount?: number; disabled?: boolean };
  demo?: boolean;
  disabled?: boolean;
}

function providerName(provider: MailProviderId): string {
  return provider === "google" ? "Gmail" : "Outlook";
}

function ProviderMark({ provider }: { provider: MailProviderId }) {
  const Icon = provider === "google" ? Mail : LayoutGrid;
  return (
    <span className={styles.providerMark} aria-hidden="true">
      <Icon />
    </span>
  );
}

function AccountDetails({ account, demo }: { account: MailAccountOption; demo?: boolean }) {
  return (
    <span className={styles.accountDetails}>
      <span className={styles.accountName}>{account.displayName || account.address}</span>
      {account.displayName && <span className={styles.accountAddress}>{account.address}</span>}
      <span className={styles.accountMeta}>
        {providerName(account.provider)}
        {demo
          ? " · Sample account"
          : account.status === "reauth-required"
            ? " · Sign in needed"
            : ""}
        {!demo && account.status === "unavailable" ? " · Unavailable" : ""}
      </span>
    </span>
  );
}

function AccountChoice({
  id,
  disabled,
  href,
  onSelect,
  onNavigate,
  children,
}: {
  id: string;
  disabled?: boolean;
  href?: string;
  onSelect: MailAccountSwitcherProps["onSelect"];
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenuPrimitive.RadioItem
      value={id}
      disabled={disabled}
      className={styles.accountItem}
      asChild={Boolean(href)}
      onSelect={(event) => {
        if (href) event.preventDefault();
        else onSelect(id);
      }}
    >
      {href ? (
        <Link href={href} onNavigate={onNavigate}>
          {children}
        </Link>
      ) : (
        children
      )}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function AccountMenuItem({
  account,
  demo,
  onSelect,
  href,
  onNavigate,
}: {
  account: MailAccountOption;
  demo?: boolean;
  onSelect: MailAccountSwitcherProps["onSelect"];
  href?: string;
  onNavigate: () => void;
}) {
  return (
    <AccountChoice id={account.id} href={href} onSelect={onSelect} onNavigate={onNavigate}>
      <ProviderMark provider={account.provider} />
      <AccountDetails account={account} demo={demo} />
      {account.unreadCount !== undefined && (
        <span className={styles.unreadCount} aria-label={`${account.unreadCount} unread`}>
          {account.unreadCount}
        </span>
      )}
      <span className={styles.selectionMark}>
        <DropdownMenuPrimitive.ItemIndicator>
          <Check aria-hidden="true" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
    </AccountChoice>
  );
}

function ManagedAccount({
  account,
  demo,
  onDisconnect,
  onReconnect,
}: {
  account: MailAccountOption;
  demo?: boolean;
  onDisconnect?: MailAccountSwitcherProps["onDisconnect"];
  onReconnect?: MailAccountSwitcherProps["onReconnect"];
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    if (!onDisconnect || pending) return;
    setPending(true);
    setError(null);
    try {
      await onDisconnect(account.id);
      setConfirming(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This account could not be disconnected.");
    } finally {
      setPending(false);
    }
  }

  async function reconnect() {
    if (!onReconnect || pending) return;
    setPending(true);
    setError(null);
    try {
      await onReconnect(account.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <li className={styles.managedAccount}>
      <div className={styles.managedIdentity}>
        <ProviderMark provider={account.provider} />
        <AccountDetails account={account} demo={demo} />
        {!demo && account.status === "reauth-required" && onReconnect && (
          <button
            type="button"
            className={styles.quietButton}
            disabled={pending}
            onClick={() => void reconnect()}
          >
            {pending ? "Connecting…" : "Reconnect"}
          </button>
        )}
        {!demo && onDisconnect && !confirming && (
          <button type="button" className={styles.quietButton} onClick={() => setConfirming(true)}>
            Disconnect
          </button>
        )}
      </div>
      {account.message && <p className={styles.accountMessage}>{account.message}</p>}
      {confirming && (
        <div className={styles.confirmation}>
          <p>Disconnect this account? Drafts saved on this device will be kept.</p>
          <div className={styles.confirmationActions}>
            <button
              type="button"
              className={styles.quietButton}
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.quietButton}
              disabled={pending}
              onClick={() => void disconnect()}
            >
              {pending ? "Disconnecting…" : "Disconnect account"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className={styles.accountMessage} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

function AddAccountActions({
  demo,
  availableProviders = [],
  addingProvider,
  onAdd,
}: Pick<MailAccountSwitcherProps, "demo" | "availableProviders" | "addingProvider" | "onAdd">) {
  const [error, setError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<MailProviderId | null>(null);
  const pending = addingProvider ?? pendingProvider;

  async function add(provider: MailProviderId) {
    if (pending) return;
    setError(null);
    setPendingProvider(provider);
    try {
      await onAdd(provider);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This account could not be connected.");
    } finally {
      setPendingProvider(null);
    }
  }

  if (demo) {
    return (
      <div className={styles.addSection}>
        <p>These sample accounts help you try switching inboxes. No real mail is connected.</p>
        <Link className={styles.providerButton} href="/mail">
          Connect your own accounts
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.addSection}>
      <h3>Add an account</h3>
      <p>Connect with read-only access. Sending asks for separate permission.</p>
      {availableProviders.length ? (
        <div className={styles.providerActions}>
          {availableProviders.map((provider) => (
            <button
              key={provider}
              type="button"
              className={styles.providerButton}
              disabled={Boolean(pending)}
              onClick={() => void add(provider)}
            >
              <ProviderMark provider={provider} />
              {pending === provider
                ? `Connecting ${providerName(provider)}…`
                : `Connect ${providerName(provider)}`}
            </button>
          ))}
        </div>
      ) : (
        <p>No mail providers are configured yet.</p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export default function MailAccountSwitcher(props: MailAccountSwitcherProps) {
  const { accounts, selectedId, onSelect, accountHref, allInboxes, demo, disabled } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = accounts.find((account) => account.id === selectedId);
  const allSelected = selectedId === "all" && Boolean(allInboxes);
  const label = allSelected ? "All inboxes" : selected?.address || "Choose an account";

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            ref={trigger}
            type="button"
            className={styles.trigger}
            disabled={disabled}
            aria-label={`Switch mail account, current: ${label}`}
          >
            {allSelected ? (
              <Inbox className={styles.triggerIcon} aria-hidden="true" />
            ) : selected ? (
              <ProviderMark provider={selected.provider} />
            ) : null}
            <span className={styles.triggerLabel}>{label}</span>
            <ChevronDown className={styles.chevron} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={styles.menu}
          onCloseAutoFocus={(event) => {
            if (manageOpen) event.preventDefault();
          }}
        >
          <DropdownMenuRadioGroup value={selectedId}>
            {allInboxes && (
              <AccountChoice
                id="all"
                disabled={allInboxes.disabled}
                href={accountHref?.("all")}
                onSelect={onSelect}
                onNavigate={() => setMenuOpen(false)}
              >
                <Inbox className={styles.allIcon} aria-hidden="true" />
                <span className={styles.accountDetails}>
                  <span className={styles.accountName}>All inboxes</span>
                  <span className={styles.accountMeta}>Mail from every account</span>
                </span>
                {allInboxes.unreadCount !== undefined && (
                  <span
                    className={styles.unreadCount}
                    aria-label={`${allInboxes.unreadCount} unread`}
                  >
                    {allInboxes.unreadCount}
                  </span>
                )}
                <span className={styles.selectionMark}>
                  <DropdownMenuPrimitive.ItemIndicator>
                    <Check aria-hidden="true" />
                  </DropdownMenuPrimitive.ItemIndicator>
                </span>
              </AccountChoice>
            )}
            {allInboxes && <DropdownMenuSeparator />}
            {accounts.map((account) => (
              <AccountMenuItem
                key={account.id}
                account={account}
                demo={demo}
                onSelect={onSelect}
                href={accountHref?.(account.id)}
                onNavigate={() => setMenuOpen(false)}
              />
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className={styles.actionItem} onSelect={() => setManageOpen(true)}>
            <Plus aria-hidden="true" />
            Add account
          </DropdownMenuItem>
          <DropdownMenuItem className={styles.actionItem} onSelect={() => setManageOpen(true)}>
            <Settings2 aria-hidden="true" />
            Manage accounts
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent
          className={styles.dialog}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
        >
          <div className={styles.dialogHeading}>
            <DialogTitle className={styles.dialogTitle}>Mail accounts</DialogTitle>
            <DialogDescription className={styles.dialogDescription}>
              Choose the accounts you use in Mail.
            </DialogDescription>
          </div>
          <ul className={styles.accountList}>
            {accounts.map((account) => (
              <ManagedAccount
                key={account.id}
                account={account}
                demo={demo}
                onDisconnect={props.onDisconnect}
                onReconnect={props.onReconnect}
              />
            ))}
          </ul>
          <AddAccountActions
            demo={demo}
            availableProviders={props.availableProviders}
            addingProvider={props.addingProvider}
            onAdd={props.onAdd}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
