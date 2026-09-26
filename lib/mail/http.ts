export async function mailJson<T>(url: string, token: string, headers?: HeadersInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Your mail session expired. Disconnect and connect again.");
    }
    if (response.status === 403) {
      throw new Error("Mail access was denied. Check the app permission and reconnect.");
    }
    throw new Error(`Mail request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}
