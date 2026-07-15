import { useEffect, useRef } from "react";
import { APP_NAVIGATION_INTENT_EVENT } from "@/lib/app-navigation";

type EditorSaveStatus = "idle" | "saving" | "saved" | "error";

const LEAVE_EDITOR_MESSAGE = "You have unsaved changes. Leave the editor and discard this draft?";
const HISTORY_GUARD_STATE_KEY = "__vertoEditorLeaveGuard";
const CONFIRMED_NAVIGATION_WINDOW_MS = 1_000;

interface EditorNavigationEvent extends Event {
  readonly navigationType?: string;
}

interface LeaveGuardSession {
  token: string;
  href: string;
  navigation: EventTarget | null;
  restoringHistory: boolean;
  allowNextPopState: boolean;
  allowBeforeUnload: boolean;
  leaving: boolean;
  confirmedNavigationTimer: ReturnType<typeof setTimeout> | null;
  finalizeTimer: ReturnType<typeof setTimeout> | null;
}

let historyGuardSequence = 0;

export function shouldBlockEditorLeave(
  source: string,
  baselineSource: string,
  saveStatus: EditorSaveStatus
): boolean {
  return source !== baselineSource || saveStatus === "saving";
}

function isModifiedOrSecondaryClick(event: MouseEvent): boolean {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

export function sameOriginNavigationAnchor(
  event: MouseEvent,
  currentHref: string
): HTMLAnchorElement | null {
  if (isModifiedOrSecondaryClick(event) || !(event.target instanceof Element)) return null;

  const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.hasAttribute("download")) return null;
  if (anchor.target && anchor.target.toLowerCase() !== "_self") return null;

  try {
    const current = new URL(currentHref);
    const destination = new URL(anchor.href, current);
    if (destination.origin !== current.origin) return null;
    const isHashNavigation =
      destination.pathname === current.pathname &&
      destination.search === current.search &&
      destination.hash !== current.hash;
    if (isHashNavigation || destination.href === current.href) return null;
    return anchor;
  } catch {
    return null;
  }
}

function browserNavigation(): EventTarget | null {
  return (window as Window & { navigation?: EventTarget }).navigation ?? null;
}

function historyStateWithGuard(state: unknown, token: string): Record<string, unknown> {
  const current = state !== null && typeof state === "object" ? state : {};
  return { ...current, [HISTORY_GUARD_STATE_KEY]: token };
}

function isSessionHistoryState(state: unknown, token: string): boolean {
  return (
    state !== null &&
    typeof state === "object" &&
    (state as Record<string, unknown>)[HISTORY_GUARD_STATE_KEY] === token
  );
}

function startConfirmedNavigation(session: LeaveGuardSession, allowPopState: boolean): void {
  session.allowBeforeUnload = true;
  session.allowNextPopState = allowPopState;
  session.leaving = true;
  if (session.confirmedNavigationTimer) clearTimeout(session.confirmedNavigationTimer);
  session.confirmedNavigationTimer = setTimeout(() => {
    session.allowBeforeUnload = false;
    session.allowNextPopState = false;
    session.leaving = false;
    session.confirmedNavigationTimer = null;
  }, CONFIRMED_NAVIGATION_WINDOW_MS);
}

function createLeaveGuardSession(navigation: EventTarget | null): LeaveGuardSession {
  historyGuardSequence += 1;
  const session: LeaveGuardSession = {
    token: `editor-${historyGuardSequence}`,
    href: window.location.href,
    navigation,
    restoringHistory: false,
    allowNextPopState: false,
    allowBeforeUnload: false,
    leaving: false,
    confirmedNavigationTimer: null,
    finalizeTimer: null,
  };

  // Browsers without the Navigation API need a same-URL sentinel. The first
  // Back traversal lands on the original editor entry, where it can be
  // cancelled before Next's popstate listener replaces the draft.
  if (!navigation) {
    window.history.pushState(
      historyStateWithGuard(window.history.state, session.token),
      "",
      session.href
    );
  }

  return session;
}

export function useEditorLeaveGuard(shouldBlockLeave: boolean): void {
  const sessionRef = useRef<LeaveGuardSession | null>(null);

  useEffect(() => {
    if (!shouldBlockLeave) return;

    const navigation = browserNavigation();
    let session = sessionRef.current;
    if (!session || session.href !== window.location.href || session.navigation !== navigation) {
      session = createLeaveGuardSession(navigation);
      sessionRef.current = session;
    } else if (session.finalizeTimer) {
      clearTimeout(session.finalizeTimer);
      session.finalizeTimer = null;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (session.allowBeforeUnload) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!sameOriginNavigationAnchor(event, window.location.href)) return;

      if (!window.confirm(LEAVE_EDITOR_MESSAGE)) {
        event.preventDefault();
        return;
      }

      // A normal same-origin anchor may still perform a full navigation. Suppress
      // the browser's second prompt for this one, explicitly confirmed click.
      startConfirmedNavigation(session, false);
    };

    const handleNavigate = (event: Event) => {
      const navigateEvent = event as EditorNavigationEvent;
      if (navigateEvent.navigationType !== "traverse" || !event.cancelable) return;
      if (session.leaving) return;

      if (!window.confirm(LEAVE_EDITOR_MESSAGE)) {
        // The Navigation API fires before a back/forward traversal commits, so
        // cancelling here keeps both the URL and mounted draft unchanged.
        event.preventDefault();
        return;
      }

      startConfirmedNavigation(session, false);
    };

    const handleAppNavigationIntent = (event: Event) => {
      if (!event.cancelable || session.leaving) return;
      if (!window.confirm(LEAVE_EDITOR_MESSAGE)) {
        event.preventDefault();
        return;
      }
      startConfirmedNavigation(session, false);
    };

    const handlePopState = (event: PopStateEvent) => {
      if (session.allowNextPopState) {
        session.allowNextPopState = false;
        return;
      }

      if (isSessionHistoryState(event.state, session.token)) {
        // This is the forward traversal used to restore a cancelled Back. Keep
        // it invisible to the app router as both entries represent the editor.
        event.stopImmediatePropagation();
        session.restoringHistory = false;
        return;
      }

      if (session.restoringHistory) {
        event.stopImmediatePropagation();
        window.history.forward();
        return;
      }

      if (!window.confirm(LEAVE_EDITOR_MESSAGE)) {
        // Capture phase runs before Next's normal popstate listener. Preventing
        // it from seeing the attempted traversal is what keeps loaded source
        // from replacing the unsaved draft while the sentinel is restored.
        event.stopImmediatePropagation();
        session.restoringHistory = true;
        window.history.forward();
        return;
      }

      if (window.location.href === session.href) {
        // A normal Back first lands on the duplicate, same-URL editor entry.
        // The confirmed second traversal reaches the real destination.
        event.stopImmediatePropagation();
        startConfirmedNavigation(session, true);
        window.history.back();
      } else {
        // history.go(-n) may already have reached its requested destination.
        startConfirmedNavigation(session, false);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener(APP_NAVIGATION_INTENT_EVENT, handleAppNavigationIntent);
    document.addEventListener("click", handleDocumentClick, true);
    if (navigation) navigation.addEventListener("navigate", handleNavigate);
    else window.addEventListener("popstate", handlePopState, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener(APP_NAVIGATION_INTENT_EVENT, handleAppNavigationIntent);
      document.removeEventListener("click", handleDocumentClick, true);
      if (navigation) navigation.removeEventListener("navigate", handleNavigate);
      else window.removeEventListener("popstate", handlePopState, true);

      // Defer finalization so React Strict Mode can immediately reattach the
      // same session without stacking another history sentinel.
      session.finalizeTimer = setTimeout(() => {
        if (sessionRef.current !== session) return;
        sessionRef.current = null;
        if (session.confirmedNavigationTimer) clearTimeout(session.confirmedNavigationTimer);

        if (
          !session.navigation &&
          !session.leaving &&
          window.location.href === session.href &&
          isSessionHistoryState(window.history.state, session.token)
        ) {
          // Saving or unmounting while still on the sentinel returns to the
          // original same-URL entry, so a clean editor does not require two
          // Back presses later.
          window.history.back();
        }
      }, 0);
    };
  }, [shouldBlockLeave]);
}
