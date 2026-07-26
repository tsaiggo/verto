// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";

import {
  applyMdxSlashCommand,
  findMdxSlashTrigger,
  MDX_SLASH_COMMANDS,
} from "./mdx-slash-commands";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("slash command preview boundary", () => {
  it("renders an inserted bookmark through the production MDX renderer", async () => {
    const source = "/bookmark";
    const trigger = findMdxSlashTrigger(source, source.length);
    const command = MDX_SLASH_COMMANDS.find((candidate) => candidate.id === "bookmark");
    if (!trigger || !command) throw new Error("Expected bookmark command and trigger");
    const insertion = applyMdxSlashCommand(source, trigger, command);

    expect(insertion.source).toContain('url="https://example.com"');
    expect(insertion.source).not.toContain("href=");

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(createElement(RuntimeDocument, { source: insertion.source, format: "mdx" }));
    });

    const link = host.querySelector<HTMLAnchorElement>("a.link-card");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.textContent).toContain("Bookmark title");
    await act(async () => root.unmount());
  });
});
