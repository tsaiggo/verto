import { mailSender } from "./addresses";

export type SenderBrandId =
  | "google"
  | "gmail"
  | "apple"
  | "microsoft"
  | "github"
  | "notion"
  | "amazon"
  | "spotify"
  | "slack"
  | "dropbox";

export interface SenderBrand {
  readonly id: SenderBrandId;
  readonly name: string;
  readonly asset: string;
}

export const SENDER_BRANDS: readonly SenderBrand[] = [
  { id: "google", name: "Google", asset: "/mail/brands/google.svg" },
  { id: "gmail", name: "Gmail", asset: "/mail/brands/gmail.svg" },
  { id: "apple", name: "Apple", asset: "/mail/brands/apple.svg" },
  { id: "microsoft", name: "Microsoft", asset: "/mail/brands/microsoft.svg" },
  { id: "github", name: "GitHub", asset: "/mail/brands/github.svg" },
  { id: "notion", name: "Notion", asset: "/mail/brands/notion.svg" },
  { id: "amazon", name: "Amazon", asset: "/mail/brands/amazon.svg" },
  { id: "spotify", name: "Spotify", asset: "/mail/brands/spotify.svg" },
  { id: "slack", name: "Slack", asset: "/mail/brands/slack.svg" },
  { id: "dropbox", name: "Dropbox", asset: "/mail/brands/dropbox.svg" },
];

const BRAND_DOMAINS: Readonly<Partial<Record<SenderBrandId, readonly string[]>>> = {
  google: ["google.com"],
  apple: ["apple.com"],
  microsoft: ["microsoft.com"],
  github: ["github.com"],
  notion: ["notion.so", "notion.com"],
  amazon: ["amazon.com"],
  spotify: ["spotify.com"],
  slack: ["slack.com"],
  dropbox: ["dropbox.com"],
};

/** A local visual cue based on the From address; this does not verify a sender's identity. */
export function getSenderBrand(from: string): SenderBrand | undefined {
  const { address } = mailSender(from);
  if (!address) return undefined;
  if (address === "gmail-team@google.com") {
    return SENDER_BRANDS.find((brand) => brand.id === "gmail");
  }
  const domain = address.slice(address.lastIndexOf("@") + 1);
  return SENDER_BRANDS.find((brand) =>
    BRAND_DOMAINS[brand.id]?.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`))
  );
}
