"use client";

// Auth context for the desktop GitHub login.
//
// Exposes the signed-in user, the OAuth token, and the connected repository,
// plus `signIn` / `signOut` / `setConnection` actions. State is hydrated from
// the host auth file on mount and written back whenever it changes.
//
// In the web build (`isTauri()` === false) this is an inert provider: there is
// no token, `signIn` rejects with a clear message, and consumers simply hide
// their desktop-only UI.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isTauri, tauriFetch } from "@/lib/tauri";
import {
  DEFAULT_SCOPE,
  DeviceFlowError,
  getClientId,
  pollForToken,
  requestDeviceCode,
  type DeviceCodeResponse,
} from "@/lib/auth/github-device";
import { fetchUser, type GitHubUser } from "@/lib/auth/github-api";
import {
  clearAuth,
  loadAuth,
  saveAuth,
  type RepoConnection,
  type StoredAuth,
} from "@/lib/auth/store";

export interface AuthState {
  /** True until the persisted auth file has been read on mount. */
  loading: boolean;
  /** Whether the runtime can sign in (desktop only). */
  available: boolean;
  /** Signed-in user, or null when signed out. */
  user: GitHubUser | null;
  /** OAuth access token, or null when signed out. */
  token: string | null;
  /** Connected repository, or null when none chosen yet. */
  connection: RepoConnection | null;
  /**
   * Begin the device flow. `onPrompt` is invoked with the user code +
   * verification URL so the UI can display them. Resolves once the user has
   * authorised and the profile has been fetched.
   */
  signIn: (onPrompt?: (info: DeviceCodeResponse) => void) => Promise<void>;
  /** Forget the token + connection (delete the host auth file). */
  signOut: () => Promise<void>;
  /** Persist the chosen repository connection. */
  setConnection: (connection: RepoConnection) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [available] = useState(() => isTauri());
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [connection, setConnectionState] = useState<RepoConnection | null>(
    null,
  );
  // Guards against overlapping sign-in attempts.
  const signingIn = useRef(false);

  // Hydrate from the host auth file once on mount.
  useEffect(() => {
    let cancelled = false;
    void loadAuth().then((stored) => {
      if (cancelled) return;
      if (stored) {
        setToken(stored.token);
        setUser(stored.user);
        setConnectionState(stored.connection ?? null);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: StoredAuth) => {
    await saveAuth(next);
  }, []);

  const signIn = useCallback(
    async (onPrompt?: (info: DeviceCodeResponse) => void) => {
      if (!available) {
        throw new DeviceFlowError(
          "GitHub sign-in is only available in the Verto desktop app.",
        );
      }
      if (signingIn.current) return;
      signingIn.current = true;
      try {
        const clientId = getClientId();
        const fetchImpl = await tauriFetch();
        const device = await requestDeviceCode(
          clientId,
          DEFAULT_SCOPE,
          fetchImpl,
        );
        onPrompt?.(device);

        // Open the verification page in the system browser.
        try {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl(device.verificationUri);
        } catch {
          // Non-fatal: the UI still shows the URL for manual entry.
        }

        const accessToken = await pollForToken({
          clientId,
          deviceCode: device.deviceCode,
          interval: device.interval,
          expiresIn: device.expiresIn,
          fetchImpl,
        });
        const profile = await fetchUser(accessToken, fetchImpl);
        setToken(accessToken);
        setUser(profile);
        setConnectionState(null);
        await persist({ token: accessToken, user: profile });
      } finally {
        signingIn.current = false;
      }
    },
    [available, persist],
  );

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    setConnectionState(null);
    await clearAuth();
  }, []);

  const setConnection = useCallback(
    async (next: RepoConnection) => {
      setConnectionState(next);
      if (token && user) {
        await persist({ token, user, connection: next });
      }
    },
    [persist, token, user],
  );

  const value = useMemo<AuthState>(
    () => ({
      loading,
      available,
      user,
      token,
      connection,
      signIn,
      signOut,
      setConnection,
    }),
    [
      loading,
      available,
      user,
      token,
      connection,
      signIn,
      signOut,
      setConnection,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth context. Returns an inert default outside a provider. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return ctx;
}
