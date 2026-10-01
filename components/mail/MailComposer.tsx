"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { Check, Send, Trash2, X } from "lucide-react";
import type { MailConnector } from "@/lib/mail/model";
import type { MailDraft } from "@/lib/mail/drafts";
import { parseMailRecipients } from "@/lib/mail/addresses";
import {
  deliverMailDraft,
  isDraftSending,
  subscribeMailDelivery,
  draftDeliveryWarning,
} from "@/lib/mail/delivery";
import styles from "./MailWorkspace.module.css";
import content from "./MailContent.module.css";

// eslint-disable-next-line complexity -- explicit draft, permission, and delivery states
export default function MailComposer({
  draft,
  connector,
  accountAddress,
  fromControl,
  demo,
  sendingEnabled,
  onSendingEnabled,
  onChange,
  onBeforeSend,
  storageFailed,
  onClose,
  onDiscard,
  onSent,
  onSendFailure,
  lifetime,
}: {
  draft: MailDraft;
  connector: MailConnector;
  accountAddress: string;
  fromControl?: (disabled: boolean) => ReactNode;
  demo: boolean;
  sendingEnabled: boolean;
  onSendingEnabled: () => void;
  onChange: (draft: MailDraft) => void;
  onBeforeSend?: (draft: MailDraft) => Promise<void>;
  storageFailed: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSent: (storageSaved: boolean) => void;
  onSendFailure: (message: string) => void;
  lifetime: RefObject<number>;
}) {
  const [showCc, setShowCc] = useState(Boolean(draft.cc));
  const [showBcc, setShowBcc] = useState(Boolean(draft.bcc));
  const [error, setError] = useState<string | null>(null);
  const [working, setBusy] = useState(false);
  const pending = useSyncExternalStore(
    subscribeMailDelivery,
    () => isDraftSending(draft.accountKey, draft.id),
    () => false
  );
  const busy = working || pending;
  const [discarding, setDiscarding] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    bodyRef.current?.focus({ preventScroll: true });
    return () => {
      mounted.current = false;
    };
  }, []);
  const change = (field: "to" | "cc" | "bcc" | "subject" | "bodyText", value: string) => {
    setDiscarding(false);
    setError(null);
    onChange({ ...draft, [field]: value });
  };
  const enable = async () => {
    if (!connector.enableSending || busy) return;
    setBusy(true);
    setError(null);
    const generation = lifetime.current;
    try {
      await connector.enableSending();
      if (mounted.current && generation === lifetime.current) onSendingEnabled();
    } catch (cause) {
      if (mounted.current && generation === lifetime.current)
        setError(
          cause instanceof Error ? cause.message : "Send permission was not granted. Try again."
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const send = async () => {
    if (busy) return;
    setError(null);
    let to: string[], cc: string[], bcc: string[];
    try {
      to = parseMailRecipients(draft.to);
      cc = parseMailRecipients(draft.cc);
      bcc = parseMailRecipients(draft.bcc);
      if (!to.length) throw new Error("Add at least one recipient in To.");
      if (!draft.subject.trim()) throw new Error("Add a subject before sending.");
      if (!draft.bodyText.trim()) throw new Error("Write a message before sending.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check your recipients.");
      return;
    }
    if (!demo && (!sendingEnabled || !connector.sendMessage)) {
      setError("Enable sending for this account first.");
      return;
    }
    setBusy(true);
    const generation = lifetime.current;
    try {
      await onBeforeSend?.(draft);
      let storageSaved = true;
      if (!demo)
        ({ storageSaved } = await deliverMailDraft(connector, draft, {
          to,
          cc,
          bcc,
          subject: draft.subject,
          bodyText: draft.bodyText,
          replyToMessageId:
            draft.mode === "reply" || draft.mode === "replyAll"
              ? draft.replyToMessageId
              : undefined,
          internetMessageId: draft.internetMessageId,
        }));
      if (generation === lifetime.current) onSent(storageSaved);
    } catch (cause) {
      if (mounted.current && generation === lifetime.current)
        setError(
          `${cause instanceof Error ? cause.message : "Message could not be sent."} Your draft is kept here. If delivery is uncertain, check Sent before trying again.`
        );
      else if (generation === lifetime.current)
        onSendFailure(
          "The previous message could not be confirmed as sent. Its draft is kept in Local drafts. Check Sent before trying again."
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  const title =
    draft.mode === "compose"
      ? "New message"
      : draft.mode === "forward"
        ? "Forward message"
        : "Reply";
  return (
    <form
      className={`${styles.composer} ${content.composer}${draft.mode === "compose" ? ` ${styles.fullComposer}` : ""}`}
      aria-label="Message draft"
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <header className={`${styles.composerHeader} ${content.composerHeader}`}>
        <div className={content.composerIdentity}>
          <h2>{title}</h2>
          <div className={content.fromIdentity}>
            <span>From</span>
            {fromControl ? fromControl(busy) : <span>{accountAddress}</span>}
          </div>
        </div>
        <span className={styles.draftStatus}>
          {storageFailed ? (
            "Not saved"
          ) : (
            <>
              <Check aria-hidden /> Saved locally
            </>
          )}
        </span>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Save & close"
          title="Save & close"
          disabled={busy}
          onClick={onClose}
        >
          <X aria-hidden />
        </button>
      </header>
      {(error || storageFailed) && (
        <p className={`${styles.inlineError} ${content.composerAlert}`} role="alert">
          {error ||
            "Your browser could not save this draft. Keep this page open and copy your message before leaving."}
        </p>
      )}
      {!demo && draftDeliveryWarning(draft.accountKey, draft.id) && (
        <p className={`${styles.permissionNote} ${content.composerAlert}`} role="alert">
          {draftDeliveryWarning(draft.accountKey, draft.id)}
        </p>
      )}
      <div className={styles.composerFields}>
        <div className={`${styles.recipientRow} ${content.recipientRow}`}>
          <label htmlFor={`${draft.id}-to`}>To</label>
          <AdaptiveMailField
            id={`${draft.id}-to`}
            value={draft.to}
            placeholder="name@example.com"
            onChange={(value) => change("to", value)}
            disabled={busy}
          />
          <div className={styles.recipientToggles}>
            <button type="button" aria-pressed={showCc} onClick={() => setShowCc(!showCc)}>
              Cc
            </button>
            <button type="button" aria-pressed={showBcc} onClick={() => setShowBcc(!showBcc)}>
              Bcc
            </button>
          </div>
        </div>
        {showCc && (
          <div className={`${styles.recipientRow} ${content.recipientRow}`}>
            <label htmlFor={`${draft.id}-cc`}>Cc</label>
            <AdaptiveMailField
              id={`${draft.id}-cc`}
              value={draft.cc}
              onChange={(value) => change("cc", value)}
              disabled={busy}
              placeholder="Additional recipients"
            />
          </div>
        )}
        {showBcc && (
          <div className={`${styles.recipientRow} ${content.recipientRow}`}>
            <label htmlFor={`${draft.id}-bcc`}>Bcc</label>
            <AdaptiveMailField
              id={`${draft.id}-bcc`}
              value={draft.bcc}
              onChange={(value) => change("bcc", value)}
              disabled={busy}
              placeholder="Hidden recipients"
            />
          </div>
        )}
        <div className={`${styles.recipientRow} ${content.recipientRow}`}>
          <label htmlFor={`${draft.id}-subject`}>Subject</label>
          <AdaptiveMailField
            id={`${draft.id}-subject`}
            value={draft.subject}
            onChange={(value) => change("subject", value)}
            disabled={busy}
            placeholder="What’s on your mind?"
          />
        </div>
        <textarea
          ref={bodyRef}
          className={`${styles.composeBody} ${content.composeBody}`}
          aria-label="Message body"
          value={draft.bodyText}
          onChange={(event) => change("bodyText", event.target.value)}
          disabled={busy}
          placeholder="Write your message…"
          spellCheck
        />
        <div className={`${styles.composeContext} ${content.composeContext}`}>
          <span>Plain text</span>
        </div>
        {!demo && !sendingEnabled && (
          <p className={styles.permissionNote}>
            {connector.enableSending
              ? "Sending requires separate permission from your mail provider."
              : "Sending is unavailable for this account. Your draft stays on this browser."}
          </p>
        )}
        {demo && <p className={styles.permissionNote}>Preview only. Sending here is simulated.</p>}
      </div>
      <footer className={`${styles.composerFooter} ${content.composerFooter}`}>
        {discarding ? (
          <div className={styles.discardConfirm}>
            <span>Discard this local draft?</span>
            <button type="button" className={styles.textButton} onClick={onDiscard}>
              Confirm discard
            </button>
            <button
              type="button"
              className={styles.textButton}
              onClick={() => setDiscarding(false)}
            >
              Keep draft
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Discard draft"
            title="Discard draft"
            disabled={busy}
            onClick={() => setDiscarding(true)}
          >
            <Trash2 aria-hidden />
          </button>
        )}
        {demo || sendingEnabled ? (
          <button type="submit" className={styles.primaryButton} disabled={busy}>
            {busy ? "Sending…" : demo ? "Send preview" : "Send mail"}
            <Send aria-hidden />
          </button>
        ) : (
          connector.enableSending && (
            <button
              type="button"
              className={styles.primaryButton}
              disabled={busy}
              onClick={() => void enable()}
            >
              {busy ? "Authorizing…" : "Enable sending"}
              <Send aria-hidden />
            </button>
          )
        )}
      </footer>
    </form>
  );
}

/** Compact fields grow with wrapped content, then scroll locally within three lines. */
function AdaptiveMailField({
  id,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => resizeMailField(field.current), [value]);
  useEffect(() => {
    const element = field.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      resizeMailField(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <textarea
      ref={field}
      id={id}
      rows={1}
      className={content.adaptiveField}
      value={value}
      autoComplete="off"
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value.replace(/[\r\n]+/g, " "))}
      disabled={disabled}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault();
      }}
    />
  );
}

function resizeMailField(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = "auto";
  const maximum = Number.parseFloat(getComputedStyle(element).maxHeight);
  // CSS is unavailable in DOM-only tests; the same three-line bound is retained.
  const limit = Number.isFinite(maximum) ? maximum : 74;
  element.style.height = `${Math.min(element.scrollHeight, limit)}px`;
}
