"use client";

import { useSyncExternalStore } from "react";
import type { MailConnection } from "./model";

export type MailSession =
  | { status: "disconnected"; connection: null }
  | { status: "connecting"; connection: null }
  | { status: "connected"; connection: MailConnection }
  | { status: "error"; connection: null; message: string };

const EMPTY_SESSION: MailSession = { status: "disconnected", connection: null };
let currentSession: MailSession = EMPTY_SESSION;
const listeners = new Set<() => void>();

export function getMailSession(): MailSession {
  return currentSession;
}

export function setMailSession(next: MailSession): void {
  currentSession = next;
  for (const listener of listeners) listener();
}

export function subscribeMailSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMailSession(): MailSession {
  return useSyncExternalStore(subscribeMailSession, getMailSession, () => EMPTY_SESSION);
}
