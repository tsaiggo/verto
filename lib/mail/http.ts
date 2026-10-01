export class MailRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly reason?: string
  ) {
    super(message);
    this.name = "MailRequestError";
  }
}

async function mailErrorDetails(response: Response): Promise<{ code?: string; reason?: string }> {
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; errors?: Array<{ reason?: unknown }> };
    };
    const firstReason = Array.isArray(body.error?.errors)
      ? body.error.errors[0]?.reason
      : undefined;
    const reason = typeof firstReason === "string" ? firstReason : undefined;
    const code = typeof body.error?.code === "string" ? body.error.code : reason;
    return { code, reason };
  } catch {
    // Many error responses have no JSON body.
    return {};
  }
}

async function mailRequest(url: string, token: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(url, { ...init, headers, redirect: "error" });
  } catch {
    throw new Error("Mail could not be reached. Check your connection and try again.");
  }

  if (!response.ok) {
    // Keep provider details out of displayed messages. Graph supplies a string
    // code; Gmail reports quota/permission reasons beside its numeric HTTP code.
    const { code, reason } = await mailErrorDetails(response);
    if (response.status === 401) {
      throw new MailRequestError(
        "Your mail session expired. Disconnect and connect again.",
        response.status,
        code,
        reason
      );
    }
    if (response.status === 403) {
      if (
        ["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded"].includes(code ?? "")
      ) {
        throw new MailRequestError(
          code === "dailyLimitExceeded"
            ? "Mail reached its daily request limit. Try syncing later."
            : "Mail is receiving too many requests. Wait a moment and try syncing again.",
          response.status,
          code,
          reason
        );
      }
      throw new MailRequestError(
        "Mail access was denied. Check the app permission and reconnect.",
        response.status,
        code,
        reason
      );
    }
    throw new MailRequestError(
      `Mail request failed (${response.status}).`,
      response.status,
      code,
      reason
    );
  }

  return response;
}

export async function mailJson<T>(url: string, token: string, headers?: HeadersInit): Promise<T> {
  const response = await mailRequest(url, token, { headers });
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("Mail returned an unreadable response. Try again.");
  }
}

export async function mailPost(url: string, token: string, body: unknown): Promise<void> {
  await mailRequest(url, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function mailBlob(url: string, token: string): Promise<Blob> {
  const response = await mailRequest(url, token);
  return response.blob();
}
