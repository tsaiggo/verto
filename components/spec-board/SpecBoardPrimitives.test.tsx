import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SpecBoardPageShell from "@/components/spec-board/SpecBoardPageShell";
import SpecBoardSearchPrompt from "@/components/spec-board/SpecBoardSearchPrompt";
import SpecBoardSection from "@/components/spec-board/SpecBoardSection";

describe("SpecBoardSearchPrompt", () => {
  it("renders the shared redesign search anatomy with an optional shortcut", () => {
    const html = renderToStaticMarkup(
      createElement(SpecBoardSearchPrompt, {
        className: "uhd05-search-box",
        label: "Search anything...",
        shortcut: "⌘K",
      })
    );

    expect(html).toContain('class="spec-board-search uhd05-search-box"');
    expect(html).toContain("Search anything...");
    expect(html).toContain("<kbd>⌘K</kbd>");
  });

  it("omits the shortcut when the board does not need one", () => {
    const html = renderToStaticMarkup(
      createElement(SpecBoardSearchPrompt, {
        label: "Type a command…",
      })
    );

    expect(html).toContain("Type a command…");
    expect(html).not.toContain("<kbd>");
  });
});

describe("SpecBoardSection", () => {
  it("wraps redesign sections in a shared section and heading shell", () => {
    const html = renderToStaticMarkup(
      createElement(
        SpecBoardSection,
        {
          className: "uhd07-panel uhd07-command",
          headerClassName: "uhd07-section-head",
          title: "Command Palette",
        },
        createElement("p", null, "Body")
      )
    );

    expect(html).toContain('class="spec-board-section uhd07-panel uhd07-command"');
    expect(html).toContain('class="spec-board-section__head uhd07-section-head"');
    expect(html).toContain("<strong>Command Palette</strong>");
    expect(html).toContain("<p>Body</p>");
  });
});

describe("SpecBoardPageShell", () => {
  it("keeps the board frame slot order consistent across redesign routes", () => {
    const html = renderToStaticMarkup(
      createElement(SpecBoardPageShell, {
        className: "uhd06-page",
        ariaLabel: "Sources board",
        rail: createElement("aside", { className: "rail" }, "Rail"),
        main: createElement("main", { className: "main" }, "Main"),
        aside: createElement("aside", { className: "callouts" }, "Callouts"),
        footer: createElement("footer", { className: "foot" }, "Footer"),
      })
    );

    expect(html).toContain('class="spec-board-page uhd06-page"');
    expect(html).toContain('aria-label="Sources board"');
    expect(html.indexOf('class="rail"')).toBeLessThan(html.indexOf('class="main"'));
    expect(html.indexOf('class="main"')).toBeLessThan(html.indexOf('class="callouts"'));
    expect(html.indexOf('class="callouts"')).toBeLessThan(html.indexOf('class="foot"'));
  });
});
