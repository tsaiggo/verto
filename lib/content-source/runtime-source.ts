// Runtime content-source facade (client-safe).
//
// Unlike `./index.ts` — which selects a build-time source and pulls in the
// filesystem/server backends (`local`, `onedrive`) — this module only depends
// on the GitHub source, so it is safe to import from `"use client"` runtime
// readers without dragging `node:fs` into the client bundle. UI builds a
// `ContentSource` from a saved desktop connection + injected fetch through
// `createRuntimeSource` instead of reaching into `./github` directly.

import type { ContentSource } from "./types";
import type { FetchLike } from "../tauri";
import { createGitHubSourceFromConnection, type GitHubConnection } from "./github";

export interface RuntimeGitHubSourceConfig {
  kind: "github";
  connection: GitHubConnection;
  fetchImpl?: FetchLike;
}

export type RuntimeSourceConfig = RuntimeGitHubSourceConfig;

export function createRuntimeSource(config: RuntimeSourceConfig): ContentSource {
  switch (config.kind) {
    case "github":
      return createGitHubSourceFromConnection(config.connection, {
        fetchImpl: config.fetchImpl,
      });
    default: {
      const exhaustive: never = config.kind;
      throw new Error(`Unknown runtime source kind: ${String(exhaustive)}`);
    }
  }
}

export type { GitHubConnection };
