import type { MailAttachment, MailConnection, MailConnector, MailMessage } from "./model";

const designNotes = `Example attachment — Design review notes

This file is sample data for the example mailbox.

Decisions
- Keep the reading pane visible when switching between messages.
- Save unfinished drafts locally for the selected account.
- Show the complete sender address in message details.

Next steps
- Maya: update the review checklist.
- Noah: confirm keyboard navigation.
- Alex: review the empty and error states.
`;
const workshopAgenda = `Example attachment — Workshop agenda

This file is sample data for the example mailbox.

10:00 Welcome and context
10:15 Map the current reading workflow
11:00 Identify the most common interruptions
11:30 Review ideas and choose next steps
12:00 Wrap up
`;

const attachmentText = new Map([
  ["demo-design-notes", designNotes],
  ["demo-workshop-agenda", workshopAgenda],
]);

const designAttachment: MailAttachment = {
  id: "demo-design-notes",
  name: "design-review-notes.txt",
  mimeType: "text/plain",
  size: new TextEncoder().encode(designNotes).length,
};

const agendaAttachment: MailAttachment = {
  id: "demo-workshop-agenda",
  name: "workshop-agenda.txt",
  mimeType: "text/plain",
  size: new TextEncoder().encode(workshopAgenda).length,
};

const messages: MailMessage[] = [
  {
    id: "demo-design-review",
    subject: "Design review notes and next steps",
    from: "Maya Chen <maya.chen@example.com>",
    to: ["Alex Morgan <alex.morgan@example.com>", "Noah Williams <noah.williams@example.com>"],
    cc: ["Priya Shah <priya.shah@example.com>", "Alex Morgan <alex.morgan@example.com>"],
    replyTo: ["Design Team <design-team@example.com>"],
    internetMessageId: "<demo-design-review@example.com>",
    receivedAt: "2026-10-01T08:45:00.000Z",
    preview:
      "Thanks for the thoughtful review yesterday. Here are the decisions and the next steps.",
    isRead: false,
    hasAttachments: true,
    attachments: [designAttachment],
    bodyText: `Hi Alex and Noah,

Thanks for the thoughtful review yesterday. I’ve gathered the decisions below so everyone has the same context before we start the next round of work. The attached notes are a short version you can keep beside the implementation checklist.

Reading and navigation

The main decision is to keep the message list and reading pane useful on their own. A reader should be able to scan the inbox, open a message, and move to the next item without losing their place. When a message is long, scrolling through its content should leave the folder navigation and message list available.

We also agreed that the active message needs a clear visual cue. The sender name, subject, and date should be easy to scan, while the selected row should stay legible alongside unread messages. Please include a message with a long subject in your review so we can check wrapping at narrower window sizes.

Drafts and replies

Unfinished messages should be easy to return to. The composer should make it clear when a draft has been saved on this device, and opening another message should preserve any work already in progress. If browser storage is unavailable, the reader needs a useful explanation and a chance to keep the text they have written.

For replies, please check the actual recipient addresses as well as the display names. This thread has a separate reply address for the design team, and Alex is included in both the To and Cc fields to make the duplicate handling easy to review. Reply all should include the other participants once each.

Attachments and details

The attachment in this example is a plain text checklist. Its name and size should be visible before download. Once it has been downloaded, opening it should show readable sample notes rather than an empty file.

The message details should include the sender’s full address, the recipients, and the date. These details are useful when someone is checking whether a message belongs to the right account or deciding who should receive a reply.

Next steps

Noah will walk through the keyboard paths, Priya will review the narrow layout, and I’ll update the checklist with the decisions above. Alex, please take one pass through the compose, reply, reply all, and forward flows and flag anything that feels surprising.

Before we close the review, please confirm the keyboard paths and empty states are covered in the final checklist.

Thanks,
Maya`,
  },
  {
    id: "demo-reading-list",
    subject: "Three essays for the weekend reading list",
    from: "Priya Shah <priya.shah@example.com>",
    to: ["Alex Morgan <alex.morgan@example.com>"],
    internetMessageId: "<demo-reading-list@example.com>",
    receivedAt: "2026-10-01T07:20:00.000Z",
    preview:
      "I picked three pieces that connect nicely with our conversations about focused reading.",
    isRead: false,
    hasAttachments: false,
    bodyText: `Hi Alex,

I picked three pieces for the weekend list that connect nicely with our conversations about focused reading. Each one approaches the same question from a different angle: how do we make room for ideas when the day is already full of interruptions?

The first is a short essay about keeping a small reading notebook. The author suggests writing one question before opening an article, then returning to that question at the end. I like the idea because it gives the reading session a purpose without turning every page into a task.

The second follows a team that replaced a daily stream of status messages with a weekly letter. Their most useful observation was that people read more carefully when they knew the update had an ending. It made me think about how we signal progress and closure in our own reading experience.

The third is an interview about revisiting notes months later. The interviewee keeps a separate shelf for ideas that have not yet found a home. That feels close to the way we use saved items: sometimes saving an article is a promise to return, and sometimes it is simply a useful pause.

I’ll add the full notes to the shared collection tomorrow. Let me know which one you’d like to discuss first.

Have a good weekend,
Priya`,
  },
  {
    id: "demo-workshop",
    subject: "Thursday workshop — agenda and a small request",
    from: "Noah Williams <noah.williams@example.com>",
    to: ["Alex Morgan <alex.morgan@example.com>", "Maya Chen <maya.chen@example.com>"],
    cc: ["Priya Shah <priya.shah@example.com>"],
    internetMessageId: "<demo-workshop@example.com>",
    receivedAt: "2026-09-30T14:10:00.000Z",
    preview:
      "The agenda is attached. Please bring one example of a reading task that was interrupted.",
    isRead: true,
    hasAttachments: true,
    attachments: [agendaAttachment],
    bodyText: `Hi everyone,

The agenda for Thursday’s workshop is attached. We’ll start at 10:00 and finish by noon, with a short break halfway through.

Please bring one recent example of a reading task that was interrupted. It could be an article you wanted to finish, a message you needed to answer, or a note you saved and then struggled to find. A concrete example will help us map what actually happened before we jump into ideas.

During the first half, we’ll walk through the current workflow together. In the second half, we’ll choose a few changes to try and agree on what we would need to see to call them useful.

There is no presentation to prepare. A few sentences about the task, the interruption, and what happened next are enough.

See you Thursday,
Noah`,
  },
  {
    id: "demo-library-update",
    subject: "The autumn collection is ready to browse",
    from: "Library Updates <library@example.com>",
    to: ["Alex Morgan <alex.morgan@example.com>"],
    internetMessageId: "<demo-library-update@example.com>",
    receivedAt: "2026-09-30T09:00:00.000Z",
    preview:
      "A new collection of essays, interviews, and field notes is ready for your next reading session.",
    isRead: true,
    hasAttachments: false,
    bodyText: `Hello Alex,

The autumn collection is ready to browse. It brings together essays about thoughtful tools, interviews with people who work with knowledge, and field notes from small teams building something useful.

You’ll find a short introduction beside each item, along with an estimated reading time. The collection is arranged so you can begin with a five-minute piece or settle into a longer conversation.

We’ve also refreshed the saved reading list. If you have a few unfinished items waiting there, this might be a good moment to revisit them and choose one for today.

This message is part of the example mailbox. All names, addresses, and content are sample data for exploring the reading experience.

Happy reading,
The Library team`,
  },
  {
    id: "demo-coffee",
    subject: "Coffee after the workshop?",
    from: '"López, Elena" <elena.lopez@example.com>',
    to: ["Alex Morgan <alex.morgan@example.com>"],
    internetMessageId: "<demo-coffee@example.com>",
    receivedAt: "2026-09-29T16:35:00.000Z",
    preview: "I’ll be nearby on Thursday and would enjoy hearing how the reading project is going.",
    isRead: false,
    hasAttachments: false,
    bodyText: `Hi Alex,

I’ll be nearby on Thursday and wondered if you have time for coffee after the workshop. I would enjoy hearing how the reading project is going and comparing notes on the things people save for later.

I’m free from 12:30 until 14:00. If the workshop runs over, we can find another afternoon next week.

Let me know what works for you.

Elena`,
  },
];

export const demoConnection: MailConnection = {
  account: {
    id: "demo-google-example",
    address: "alex.morgan@example.com",
    displayName: "Alex Morgan (example)",
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

/** A stable, entirely local mailbox used to preview the mail workbench. */
export const demoConnector: MailConnector = {
  id: "google",
  label: "Gmail example mailbox",
  isConfigured: () => true,
  connect: async () => {},
  restore: async () => demoConnection,
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
    const message = messages.find((item) => item.id === id);
    if (!message) throw new Error("This example message is unavailable.");
    return {
      ...message,
      to: [...message.to],
      ...(message.cc ? { cc: [...message.cc] } : {}),
      ...(message.replyTo ? { replyTo: [...message.replyTo] } : {}),
      ...(message.attachments
        ? { attachments: message.attachments.map((item) => ({ ...item })) }
        : {}),
    };
  },
  getAttachment: async (messageId, attachment) => {
    const message = messages.find((item) => item.id === messageId);
    const content = attachmentText.get(attachment.id);
    if (!message?.attachments?.some((item) => item.id === attachment.id) || content === undefined) {
      throw new Error("This example attachment is unavailable.");
    }
    return new Blob([content], { type: "text/plain;charset=utf-8" });
  },
};

export const demoWorkConnection: MailConnection = {
  account: {
    id: "demo-microsoft-example",
    address: "alexandria.morgan@product-strategy.northstar-example.com",
    displayName: "Alex Morgan · Work (example)",
    provider: "microsoft",
  },
  folders: [
    { id: "inbox", name: "Inbox", kind: "inbox", unreadCount: 2 },
    { id: "sentitems", name: "Sent", kind: "sent" },
    { id: "drafts", name: "Drafts", kind: "drafts" },
    { id: "archive", name: "Archive", kind: "archive" },
    { id: "deleteditems", name: "Trash", kind: "trash" },
  ],
};

const workMessages: MailMessage[] = [
  {
    id: "demo-work-long",
    subject:
      "Research handoff: reading workflows, account switching, and the decisions we need to review before the next design session",
    from: "Research & Platform Experience Team <research-and-platform-experience@northstar-example.com>",
    to: [
      `Alex Morgan <${demoWorkConnection.account.address}>`,
      "Workspace Experience Review <workspace-experience-review@northstar-example.com>",
    ],
    cc: [
      "Reading & Knowledge Research <reading-and-knowledge-research@northstar-example.com>",
      "Product Architecture <product-architecture@northstar-example.com>",
    ],
    receivedAt: "2026-10-01T09:15:00.000Z",
    internetMessageId: "<demo-work-long@northstar-example.com>",
    preview:
      "The research handoff is ready. Please review the open questions before our next session.",
    isRead: false,
    hasAttachments: false,
    bodyText: `Hi Alex,

The research handoff is ready for the next review. We have grouped the observations around reading, mailbox context, and the moments when a reader moves between accounts.

Please start with the full account identity. A long address should remain readable when you expand the message details. The inbox can stay compact while the reading pane gives the subject and recipients enough room to wrap.

The notes are available at:
https://example.com/research/reading-workflows/account-switching/expanded-message-details/long-addresses-and-adaptive-text-layout-for-the-next-design-session

For the review, try opening this message in the combined inbox, then replying from the mailbox that received it. Switch to the personal account and return to the work draft. The draft should still belong to this work account.

This is an illustrative work mailbox. All names, addresses, and messages are sample data.

Thanks,
The Research team`,
  },
  {
    id: "demo-work-sync",
    subject: "Tomorrow's planning session",
    from: "Jordan Lee <jordan.lee@northstar-example.com>",
    to: [`Alex Morgan <${demoWorkConnection.account.address}>`],
    receivedAt: "2026-10-01T06:50:00.000Z",
    preview: "Can you bring the reading workflow notes to tomorrow's planning session?",
    isRead: false,
    hasAttachments: false,
    bodyText:
      "Hi Alex,\n\nCan you bring the reading workflow notes to tomorrow's planning session? We will start with the open decisions and leave time to review the next iteration.\n\nThis is a sample work message.\n\nJordan",
  },
];

export const demoWorkConnector: MailConnector = {
  id: "microsoft",
  label: "Outlook example mailbox",
  isConfigured: () => true,
  connect: async () => {},
  restore: async () => demoWorkConnection,
  disconnect: async () => {},
  listMessages: async (folderId) => ({
    messages: folderId === "inbox" ? workMessages.map((message) => ({ ...message })) : [],
  }),
  getMessage: async (id) => {
    const message = workMessages.find((item) => item.id === id);
    if (!message) throw new Error("This example work message is unavailable.");
    return { ...message, to: [...message.to], cc: message.cc ? [...message.cc] : undefined };
  },
};

export const demoMailAccounts = [
  { id: "google:demo-google-example", connector: demoConnector, connection: demoConnection },
  {
    id: "microsoft:demo-microsoft-example",
    connector: demoWorkConnector,
    connection: demoWorkConnection,
  },
];
