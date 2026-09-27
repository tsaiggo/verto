"use client";

import { useState } from "react";
import { ArrowLeft, Inbox, Mail, Paperclip, ShieldCheck } from "lucide-react";
import styles from "./MailMock.module.css";

type PreviewMessage = {
  id: string;
  sender: string;
  address: string;
  initials: string;
  subject: string;
  preview: string;
  dateLabel: string;
  receivedAt: string;
  receivedLabel: string;
  unread: boolean;
  attachment: boolean;
  body: string;
};

const MESSAGES: PreviewMessage[] = [
  {
    id: "research-sync",
    sender: "Maya Chen",
    address: "maya.chen@example.com",
    initials: "MC",
    subject: "Notes from today's research sync",
    preview: "I pulled together the decisions and open questions from our review…",
    dateLabel: "9:42 AM",
    receivedAt: "2026-09-27T09:42:00",
    receivedLabel: "Today, 9:42 AM",
    unread: true,
    attachment: true,
    body: `Hi team,\n\nI pulled together the decisions and open questions from our research sync. The strongest request was to keep a source link beside every saved note, so readers can return to the original email or document without guessing where it came from.\n\nFor the next review, let's compare the Inbox list with and without the Agent pane open. At narrower desktop widths the message should open in its own view, with a clear way back to the same folder.\n\nI've attached the short summary for reference. We can go through the remaining questions on Thursday.\n\nMaya`,
  },
  {
    id: "epub-import",
    sender: "Elena Ortiz",
    address: "elena.ortiz@example.com",
    initials: "EO",
    subject: "Re: EPUB import flow",
    preview: "Keeping the original book file makes the progress model much clearer.",
    dateLabel: "Yesterday",
    receivedAt: "2026-09-26T16:18:00",
    receivedLabel: "Yesterday, 4:18 PM",
    unread: false,
    attachment: false,
    body: `Hi Maya,\n\nKeeping the original book file makes the progress model much clearer. A reader should be able to reopen the same edition later and find the chapter they left, even after changing display settings.\n\nI added two questions to the review notes: what happens when the browser storage is cleared, and how do we explain an annotation whose exact text position can no longer be found?\n\nElena`,
  },
  {
    id: "api-review",
    sender: "Samir Patel",
    address: "samir.patel@example.com",
    initials: "SP",
    subject: "Read-only mail access review",
    preview: "The first release can stay with the smallest permission set…",
    dateLabel: "Sep 25",
    receivedAt: "2026-09-25T11:08:00",
    receivedLabel: "Sep 25, 11:08 AM",
    unread: true,
    attachment: false,
    body: `Hello,\n\nThe first release can stay with the smallest permission set needed to list folders and read messages. Saving an excerpt to a local note should be a separate, visible choice by the user.\n\nPlease keep sending, moving, and deleting messages out of this review so the read-only state stays easy to understand.\n\nSamir`,
  },
  {
    id: "reading-list",
    sender: "Jules Wong",
    address: "jules.wong@example.com",
    initials: "JW",
    subject: "Weekend reading list",
    preview: "Three articles on personal knowledge workflows, with a short summary…",
    dateLabel: "Sep 24",
    receivedAt: "2026-09-24T08:30:00",
    receivedLabel: "Sep 24, 8:30 AM",
    unread: false,
    attachment: true,
    body: `Good morning,\n\nHere are three articles on personal knowledge workflows, with a short summary attached. The useful pattern across them is simple: capture the original source, then make your own note beside it.\n\nLet's discuss which pieces belong in the Library and which should remain in Mail.\n\nJules`,
  },
  {
    id: "citation-examples",
    sender: "Product Team",
    address: "product@example.com",
    initials: "PT",
    subject: "PDF citation examples for review",
    preview: "A few page-level references to use when checking the reader design.",
    dateLabel: "Sep 22",
    receivedAt: "2026-09-22T14:06:00",
    receivedLabel: "Sep 22, 2:06 PM",
    unread: false,
    attachment: true,
    body: `Hello,\n\nAttached are a few page-level references to use when checking the PDF reader design. Each citation includes the source document and page number; when text is selectable, the note also keeps its selected passage.\n\nPlease check the case where a PDF has no text layer. Reading by page should still work, while precise text selection remains unavailable.\n\nProduct Team`,
  },
];

export default function MailMock() {
  const [selectedId, setSelectedId] = useState(MESSAGES[0].id);
  const [detailOpen, setDetailOpen] = useState(false);
  const selected = MESSAGES.find((message) => message.id === selectedId) ?? MESSAGES[0];
  const unreadCount = MESSAGES.filter((message) => message.unread).length;

  return (
    <section className={styles.root} aria-label="Mail design preview">
      <div className={styles.content}>
        <header className={styles.pageHeader}>
          <div>
            <div className={styles.eyebrow}>Workspace / Mail</div>
            <h1>Mail</h1>
            <p>A read-only place for messages alongside your library.</p>
          </div>
          <span className={styles.previewPill}>
            <ShieldCheck aria-hidden="true" /> Design preview
          </span>
        </header>

        <div className={styles.accountBar}>
          <span className={styles.accountIcon} aria-hidden="true">
            <Mail />
          </span>
          <div className={styles.accountCopy}>
            <strong>Gmail</strong>
            <span>maya.lee@example.com</span>
          </div>
          <span className={styles.connection}>
            <span aria-hidden="true" /> Connected state · sample
          </span>
        </div>

        <div className={styles.mailFrame} data-detail-open={detailOpen}>
          <section className={styles.listPane} aria-label="Sample messages">
            <div className={styles.listHeader}>
              <div className={styles.folderTitle}>
                <span className={styles.folderIcon} aria-hidden="true">
                  <Inbox />
                </span>
                <div>
                  <h2>Inbox</h2>
                  <p>5 sample messages · {unreadCount} unread</p>
                </div>
              </div>
              <span className={styles.readOnly}>Read-only</span>
            </div>

            <ul className={styles.messageList}>
              {MESSAGES.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    className={`${styles.messageRow}${selectedId === message.id ? ` ${styles.selectedRow}` : ""}`}
                    aria-current={selectedId === message.id ? "true" : undefined}
                    onClick={() => {
                      setSelectedId(message.id);
                      setDetailOpen(true);
                    }}
                  >
                    <span className={styles.rowTop}>
                      <span className={styles.senderGroup}>
                        {message.unread && <span className={styles.unreadDot} aria-hidden="true" />}
                        <strong>{message.sender}</strong>
                      </span>
                      <time dateTime={message.receivedAt}>{message.dateLabel}</time>
                    </span>
                    <span className={styles.subjectLine}>
                      <span>{message.subject}</span>
                      {message.attachment && <Paperclip aria-hidden="true" />}
                    </span>
                    <span className={styles.messagePreview}>{message.preview}</span>
                    {message.unread && <span className={styles.srOnly}>Unread</span>}
                    {message.attachment && <span className={styles.srOnly}>Has attachment</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.detailPane} aria-label="Sample message detail">
            <div className={styles.detailTop}>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => setDetailOpen(false)}
              >
                <ArrowLeft aria-hidden="true" /> Back to Inbox
              </button>
              <span className={styles.detailFolder}>Inbox / Message</span>
            </div>

            <article className={styles.article} key={selected.id}>
              <div className={styles.articleHeading}>
                <h2>{selected.subject}</h2>
                <div className={styles.messageFlags}>
                  {selected.unread && <span className={styles.unreadLabel}>Unread</span>}
                  {selected.attachment && (
                    <span className={styles.attachmentLabel}>
                      <Paperclip aria-hidden="true" /> Attachment
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.messageMeta}>
                <span className={styles.avatar} aria-hidden="true">
                  {selected.initials}
                </span>
                <div className={styles.senderIdentity}>
                  <strong>{selected.sender}</strong>
                  <span>&lt;{selected.address}&gt;</span>
                  <small>To: maya.lee@example.com</small>
                </div>
                <time dateTime={selected.receivedAt}>{selected.receivedLabel}</time>
              </div>

              <div className={styles.bodyText}>{selected.body}</div>
            </article>
          </section>
        </div>

        <p className={styles.disclaimer}>
          Sample messages only. Selecting a row changes this preview; no mailbox is connected and no
          message action is sent.
        </p>
      </div>
    </section>
  );
}
