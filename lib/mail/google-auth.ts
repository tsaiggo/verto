interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

interface GoogleIdentity {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        include_granted_scopes?: boolean;
        login_hint?: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback: () => void;
      }): { requestAccessToken(options?: { prompt?: string }): void };
      revoke(token: string, callback: () => void): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let scriptPromise: Promise<GoogleIdentity> | null = null;

function permissionError(scope: string): Error {
  const permission = scope.endsWith("gmail.send")
    ? "send"
    : scope.endsWith("gmail.modify")
      ? "update"
      : "read";
  return new Error(`Gmail ${permission} permission was not granted.`);
}

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (window.google) resolve(window.google);
      else reject(new Error("Google sign-in did not load."));
    };
    script.onerror = () => reject(new Error("Google sign-in could not be loaded."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

export async function authorizeGoogleMail(options: {
  clientId?: string;
  scope: string;
  requiredScopes: string[];
  accountAddress?: string | null;
  prompt?: string;
}): Promise<{ token: string; expiresAt: number }> {
  const { clientId, scope, requiredScopes, accountAddress, prompt } = options;
  if (!clientId) throw new Error("Gmail is not configured.");
  const google = await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope,
        include_granted_scopes: true,
        ...(accountAddress ? { login_hint: accountAddress } : {}),
        callback(response) {
          if (response.error) {
            reject(
              response.error === "access_denied"
                ? permissionError(scope)
                : new Error("Google sign-in was cancelled or could not be completed.")
            );
            return;
          }
          const scopes = new Set(response.scope?.split(/\s+/));
          const missing = requiredScopes.find((required) => !scopes.has(required));
          if (!response.access_token || missing) {
            reject(permissionError(missing ?? scope));
            return;
          }
          const duration = Number.isFinite(response.expires_in) ? response.expires_in! : 3600;
          resolve({
            token: response.access_token,
            expiresAt: Date.now() + Math.max(0, duration - 60) * 1000,
          });
        },
        error_callback() {
          reject(new Error("Google sign-in was cancelled or could not be completed."));
        },
      });
      client.requestAccessToken(prompt ? { prompt } : undefined);
    } catch {
      reject(new Error("Google sign-in was cancelled or could not be completed."));
    }
  });
}
