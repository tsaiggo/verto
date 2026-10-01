import { parseMailRecipients } from "./addresses";
import type { MailOutgoing } from "./model";

const CONTROL = /[\u0000-\u001f\u007f]/;

export function validateMailOutgoing(message: MailOutgoing): MailOutgoing {
  function recipients(values: string[]): string[] {
    return values.map((value) => {
      if (CONTROL.test(value))
        throw new Error("Recipient addresses cannot contain control characters.");
      const parsed = parseMailRecipients(value);
      if (parsed.length !== 1) throw new Error("Enter one valid email address per recipient.");
      return parsed[0];
    });
  }
  const to = recipients(message.to);
  const cc = recipients(message.cc);
  const bcc = recipients(message.bcc);
  if (!to.length && !cc.length && !bcc.length) throw new Error("Add a recipient before sending.");
  if (CONTROL.test(message.subject))
    throw new Error("The subject cannot contain control characters.");
  if (
    message.replyToMessageId !== undefined &&
    (!message.replyToMessageId || CONTROL.test(message.replyToMessageId))
  ) {
    throw new Error("The original message ID is invalid.");
  }
  if (
    message.internetMessageId !== undefined &&
    !/^<[^<>\s]+@[^<>\s]+>$/.test(message.internetMessageId)
  ) {
    throw new Error("The reply message ID is invalid.");
  }
  return { ...message, to, cc, bcc };
}

export function decodeMailBase64(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function encodedSubject(subject: string): string {
  const words: string[] = [];
  let chunk = "";
  for (const character of subject) {
    if (new TextEncoder().encode(chunk + character).length > 42) {
      words.push(`=?UTF-8?B?${base64(chunk)}?=`);
      chunk = "";
    }
    chunk += character;
  }
  if (chunk) words.push(`=?UTF-8?B?${base64(chunk)}?=`);
  return words.join("\r\n ");
}

export function gmailRawMessage(
  message: MailOutgoing,
  sender: string,
  references?: string
): string {
  const headers = [
    `From: ${parseMailRecipients(sender)[0]}`,
    ...(message.to.length ? [`To: ${message.to.join(", ")}`] : []),
    ...(message.cc.length ? [`Cc: ${message.cc.join(", ")}`] : []),
    ...(message.bcc.length ? [`Bcc: ${message.bcc.join(", ")}`] : []),
    `Subject: ${encodedSubject(message.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];
  if (message.internetMessageId) {
    headers.push(`In-Reply-To: ${message.internetMessageId}`);
    const previous = references?.match(/<[^<>\s]+@[^<>\s]+>/g) ?? [];
    headers.push(
      `References: ${[...new Set([...previous, message.internetMessageId])].join("\r\n ")}`
    );
  }
  const body =
    base64(message.bodyText.replace(/\r\n|\r|\n/g, "\r\n"))
      .match(/.{1,76}/g)
      ?.join("\r\n") ?? "";
  return base64(`${headers.join("\r\n")}\r\n\r\n${body}\r\n`)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
