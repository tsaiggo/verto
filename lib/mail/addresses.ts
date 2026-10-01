const RECIPIENT_ERROR = "Enter valid email addresses separated by commas.";

interface Mailbox {
  name: string;
  address: string;
}

interface AddressParseState {
  quoted: boolean;
  escaped: boolean;
  brackets: number;
  comments: number;
}

function outsideNameOrComment(state: AddressParseState, character: string): boolean {
  if (state.escaped) {
    state.escaped = false;
    return false;
  }
  if (character === "\\" && (state.quoted || state.comments > 0)) {
    state.escaped = true;
    return false;
  }
  if (character === '"' && state.comments === 0) {
    state.quoted = !state.quoted;
    return false;
  }
  if (state.quoted) return false;
  if (character === "(") {
    state.comments++;
    return false;
  }
  if (character === ")") {
    if (--state.comments < 0) throw new Error(RECIPIENT_ERROR);
    return false;
  }
  return state.comments === 0;
}

function completeAddressHeader(state: AddressParseState): boolean {
  return !state.quoted && state.brackets === 0 && state.comments === 0 && !state.escaped;
}

function recipientSeparator(character: string): boolean {
  return character === "," || character === ";";
}

/** Split address headers without splitting a quoted display name or comment. */
function addressParts(text: string): string[] {
  if (!text.trim()) return [];
  if (/[\r\n]/.test(text)) throw new Error(RECIPIENT_ERROR);
  const parts: string[] = [];
  let start = 0;
  const state: AddressParseState = { quoted: false, escaped: false, brackets: 0, comments: 0 };
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (!outsideNameOrComment(state, character)) continue;
    if (character === "<") state.brackets++;
    else if (character === ">") {
      if (--state.brackets < 0) throw new Error(RECIPIENT_ERROR);
    } else if (recipientSeparator(character) && state.brackets === 0) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
    if (state.brackets > 1) throw new Error(RECIPIENT_ERROR);
  }
  if (!completeAddressHeader(state)) throw new Error(RECIPIENT_ERROR);
  parts.push(text.slice(start));
  if (parts.some((part) => !part.trim())) throw new Error(RECIPIENT_ERROR);
  return parts;
}

function withoutComments(text: string): string {
  let result = "";
  let quoted = false;
  let escaped = false;
  let depth = 0;
  for (const character of text) {
    if (escaped) {
      if (!depth) result += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && (quoted || depth > 0)) {
      if (!depth) result += character;
      escaped = true;
      continue;
    }
    if (character === '"' && !depth) quoted = !quoted;
    if (!quoted && character === "(") depth++;
    else if (!quoted && character === ")") depth--;
    else if (!depth) result += character;
  }
  return result;
}

function validAddress(address: string): boolean {
  if (address.length > 254) return false;
  const separator = address.indexOf("@");
  if (separator <= 0 || separator !== address.lastIndexOf("@")) return false;
  const local = address.slice(0, separator);
  const domain = address.slice(separator + 1);
  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-z0-9.!#$%&'*+\-/=?^_`{|}~]+$/i.test(local)
  ) {
    return false;
  }
  const labels = domain.split(".");
  return (
    labels.length >= 2 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) &&
    /^[a-z]{2,63}$/i.test(labels.at(-1) ?? "")
  );
}

function mailbox(text: string): Mailbox {
  const cleaned = withoutComments(text).trim();
  const angle = /^(.*?)<([^<>]+)>\s*$/.exec(cleaned);
  const address = (angle ? angle[2] : cleaned).trim().toLowerCase();
  if (!validAddress(address)) throw new Error(RECIPIENT_ERROR);
  let name = angle?.[1].trim() ?? "";
  if (name.startsWith('"') && name.endsWith('"')) {
    name = name.slice(1, -1).replace(/\\([\\"])/g, "$1");
  }
  return { name, address };
}

/** Validate and normalize composer recipients. Empty input returns no recipients. */
export function parseMailRecipients(text: string): string[] {
  return [...new Set(addressParts(text).map((part) => mailbox(part).address))];
}

function senderInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const firstLetter = (word: string) =>
    Array.from(word).find((letter) => /[\p{L}\p{N}]/u.test(letter));
  const first = firstLetter(words[0] ?? "") ?? "?";
  const last = words.length > 1 ? (firstLetter(words.at(-1) ?? "") ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase();
}

/** A tolerant display helper; invalid provider headers never break message rendering. */
export function mailSender(from: string): { name: string; address: string; initials: string } {
  try {
    const sender = mailbox(addressParts(from)[0] ?? "");
    const name = sender.name || sender.address;
    return { name, address: sender.address, initials: senderInitials(name) };
  } catch {
    const name = from.trim() || "Unknown sender";
    return { name, address: "", initials: senderInitials(name) };
  }
}
