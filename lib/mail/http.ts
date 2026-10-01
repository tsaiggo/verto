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
    if (response.status === 401) {
      throw new Error("Your mail session expired. Disconnect and connect again.");
    }
    if (response.status === 403) {
      throw new Error("Mail access was denied. Check the app permission and reconnect.");
    }
    throw new Error(`Mail request failed (${response.status}).`);
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
