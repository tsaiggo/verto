import type { MailAccount, MailConnector, MailProviderId } from "./model";
import { createGoogleMailConnector } from "./google";
import { createMicrosoftMailConnector, getCachedMicrosoftMailConnectors } from "./microsoft";

let connectors: MailConnector[] | null = null;

export function getMailConnectors(): MailConnector[] {
  if (!connectors) connectors = [createGoogleMailConnector(), createMicrosoftMailConnector()];
  return connectors;
}

/** Each connected mailbox owns its token and sending consent state. */
export function createMailConnector(provider: MailProviderId, address?: string): MailConnector {
  return provider === "google"
    ? createGoogleMailConnector({ accountAddress: address, selectAccount: !address })
    : createMicrosoftMailConnector({ accountAddress: address, selectAccount: true });
}

export async function getRestorableMailConnectors(): Promise<
  Array<MailConnector & { account?: MailAccount }>
> {
  const configured = getMailConnectors().filter((connector) => connector.isConfigured());
  const google = configured.filter((connector) => connector.id === "google");
  const microsoft = configured.some((connector) => connector.id === "microsoft")
    ? await getCachedMicrosoftMailConnectors().catch(() =>
        configured.filter((connector) => connector.id === "microsoft")
      )
    : [];
  return [...google, ...microsoft];
}
