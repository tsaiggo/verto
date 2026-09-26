import type { MailConnector } from "./model";
import { createGoogleMailConnector } from "./google";
import { createMicrosoftMailConnector } from "./microsoft";

let connectors: MailConnector[] | null = null;

export function getMailConnectors(): MailConnector[] {
  if (!connectors) connectors = [createGoogleMailConnector(), createMicrosoftMailConnector()];
  return connectors;
}
