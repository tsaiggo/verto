import fs from "fs/promises";
import path from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AppError from "./error";
import GlobalError from "./global-error";
import HelpError from "./help/error";
import NotFound from "./not-found";
import ReadError from "./read/error";
import SearchError from "./search/error";

const error = new Error("failed");
const reset = () => {};

function renderError(Component: typeof AppError) {
  return renderToStaticMarkup(createElement(Component, { error, reset }));
}

describe("Codex route error states", () => {
  it("uses one restrained state and semantic action contract", () => {
    const errors = [
      renderError(AppError),
      renderError(GlobalError),
      renderError(HelpError),
      renderError(ReadError),
      renderError(SearchError),
    ];
    const notFound = renderToStaticMarkup(createElement(NotFound));

    for (const markup of [...errors, notFound]) {
      expect(markup).toContain("codex-route-state");
      expect(markup).toContain("codex-route-state__action--primary");
      expect(markup).toContain('data-slot="button"');
      expect(markup).not.toContain("clamp(72px");
      expect(markup).not.toContain("--accent-blue");
      expect(markup).not.toContain("text-white");
    }

    for (const markup of errors) expect(markup).toContain('role="alert"');
    expect(notFound).toContain('data-state="not-found"');
    expect(notFound).not.toContain('role="alert"');
  });

  it("keeps the standalone fallback and route-specific workspace frames", () => {
    const globalError = renderError(GlobalError);
    const helpError = renderError(HelpError);
    const readError = renderError(ReadError);
    const searchError = renderError(SearchError);

    expect(globalError).toContain("data-codex-state-fallback");
    expect(globalError).toContain("ui-sans-serif");
    expect(globalError).toContain("100dvh");
    expect(globalError).not.toContain("100vh");
    expect(globalError).toContain("prefers-color-scheme: dark");
    expect(globalError).toContain("--codex-surface: #212121");
    expect(globalError).toContain("color-scheme: light dark");
    expect(helpError).toContain('class="toc-rail"');
    expect(helpError).not.toContain("toc-sidebar");
    expect(readError).toContain('class="reader-scroll"');
    expect(searchError).toContain('href="/integrations"');
    expect(searchError).toContain("Review sources");
  });

  it("wires the shared classes into the final Codex layer and Help loading frame", async () => {
    const [css, helpLoading] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/codex-clone.css"), "utf8"),
      fs.readFile(path.join(process.cwd(), "app/help/loading.tsx"), "utf8"),
    ]);

    expect(css).toContain(".codex-state-page");
    expect(css).toContain(".codex-route-state__title");
    expect(css).toContain(".codex-route-state__actions");
    expect(css).not.toContain(".error-page");
    expect(css).not.toContain(".not-found-page");
    expect(css).not.toContain(".search-error");
    expect(css).not.toContain(".read-error");
    expect(helpLoading).toContain('className="toc-rail"');
    expect(helpLoading).not.toContain("toc-sidebar");
  });
});
