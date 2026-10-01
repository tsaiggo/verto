import type { MailConnection, MailConnector, MailMessage } from "./model";
import type { MailAccountBinding } from "./unified";

const samples = [
  {
    id: "google",
    from: "Google <notifications@google.com>",
    subject: "Your workspace, in focus",
    text: "A little organization can make room for your next idea. Keep the documents, conversations, and notes you return to close at hand.",
  },
  {
    id: "gmail",
    from: "Gmail <gmail-team@google.com>",
    subject: "A fresh start for your inbox",
    text: "A clear inbox begins with a few useful habits. Set aside a moment to read, reply, and save the messages that deserve a second look.",
  },
  {
    id: "apple",
    from: "Apple <receipt@apple.com>",
    subject: "Your latest receipt is ready",
    text: "Keep your purchase records together so they are easy to find when you need them. A receipt can sit alongside the rest of your reading without interrupting your day.",
  },
  {
    id: "microsoft",
    from: "Microsoft <account@microsoft.com>",
    subject: "Your account activity at a glance",
    text: "A short account update gives you the context you need before returning to your work. Read the details in one place and carry on with your next task.",
  },
  {
    id: "github",
    from: "GitHub <notifications@github.com>",
    subject: "A pull request is ready for review",
    text: "The next iteration is ready to read. Take a moment to review the changes, gather your notes, and share the questions you would like to discuss with the team.",
  },
  {
    id: "notion",
    from: "Notion <team@notion.so>",
    subject: "Your weekly workspace digest",
    text: "A few pages have moved forward this week. Revisit the notes you shared, follow the conversations that matter, and choose an idea to develop next.",
  },
  {
    id: "amazon",
    from: "Amazon <orders@amazon.com>",
    subject: "Your order update, all in one place",
    text: "A concise order update keeps the details together. Save it for later if you would like to return to the information after your current reading session.",
  },
  {
    id: "spotify",
    from: "Spotify <updates@spotify.com>",
    subject: "A soundtrack for your next reading session",
    text: "Make a little room for focused time. A familiar playlist can be the backdrop for a chapter, a page of notes, or the next idea you want to explore.",
  },
  {
    id: "slack",
    from: "Slack <notifications@slack.com>",
    subject: "Highlights from your workspace",
    text: "Catch up on a few conversations from your workspace. Gather the useful context, save the decisions, and return to your work with a clearer picture.",
  },
  {
    id: "dropbox",
    from: "Dropbox <no-reply@dropbox.com>",
    subject: "Your files are ready to share",
    text: "Keep your shared files and the conversations around them together. Open the relevant notes before your next review and carry the context into the discussion.",
  },
] as const;

export const brandDemoConnection: MailConnection = {
  account: {
    id: "demo-brand-preview",
    address: "brand-preview@example.com",
    displayName: "Sender brand preview",
    provider: "google",
  },
  folders: [
    { id: "INBOX", name: "Inbox", kind: "inbox", unreadCount: 3 },
    { id: "SENT", name: "Sent", kind: "sent" },
    { id: "DRAFT", name: "Drafts", kind: "drafts" },
    { id: "ARCHIVE", name: "Archive", kind: "archive" },
    { id: "TRASH", name: "Trash", kind: "trash" },
  ],
};

const messages: MailMessage[] = samples.map((sample, index) => ({
  id: `demo-brand-${sample.id}`,
  from: sample.from,
  subject: sample.subject,
  to: [`Alex Morgan <${brandDemoConnection.account.address}>`],
  receivedAt: new Date(Date.UTC(2026, 9, 1, 9, 45 - index * 5)).toISOString(),
  preview: sample.text,
  isRead: index >= 3,
  hasAttachments: false,
  bodyText: `Hi Alex,

${sample.text}

This is an illustrative message created by Verto to preview a sender avatar. It was not sent by ${sample.from.slice(0, sample.from.indexOf(" <"))}, and no real mailbox is connected.

Sample data · Verto Mail`,
}));

/** Opt-in illustrative messages; the regular example mailbox stays unchanged. */
export const brandDemoConnector: MailConnector = {
  id: "google",
  label: "Sender brand preview mailbox",
  isConfigured: () => true,
  connect: async () => {},
  restore: async () => brandDemoConnection,
  disconnect: async () => {},
  listMessages: async (folderId) => ({
    messages:
      folderId === "INBOX"
        ? messages.map(({ id, subject, from, receivedAt, preview, isRead, hasAttachments }) => ({
            id,
            subject,
            from,
            receivedAt,
            preview,
            isRead,
            hasAttachments,
          }))
        : [],
  }),
  getMessage: async (id) => {
    const message = messages.find((entry) => entry.id === id);
    if (!message) throw new Error("This illustrative brand message is unavailable.");
    return { ...message, to: [...message.to] };
  },
};

export const brandDemoMailAccounts: MailAccountBinding[] = [
  {
    id: "google:demo-brand-preview",
    connector: brandDemoConnector,
    connection: brandDemoConnection,
  },
];
