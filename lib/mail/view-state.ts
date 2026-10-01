export interface MailViewState {
  folder?: string;
  message?: string;
  query: string;
  unreadOnly: boolean;
  localDrafts: boolean;
  draftId?: string;
  listScroll: number;
  detailScroll: number;
}

const views = new Map<string, MailViewState>();

export function readMailView(scope: string): MailViewState | undefined {
  return views.get(scope);
}

export function saveMailView(scope: string, view: MailViewState): void {
  views.set(scope, view);
}

export function mailHref({
  demo,
  accountId,
  folder,
  message,
}: {
  demo?: boolean;
  accountId?: string;
  folder?: string;
  message?: string;
}): string {
  const params = new URLSearchParams();
  if (demo) params.set("demo", "1");
  if (accountId) params.set("account", accountId);
  if (folder) params.set("folder", folder);
  if (message) params.set("message", message);
  return `/mail${params.size ? `?${params}` : ""}`;
}
