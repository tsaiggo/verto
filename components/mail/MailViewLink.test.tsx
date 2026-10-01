// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MailViewLink, { navigateMailView } from "./MailViewLink";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

let host: HTMLDivElement;
let root: Root;
let passedThrough: boolean;

function stopBrowserNavigation(event: MouseEvent) {
  passedThrough = !event.defaultPrevented;
  event.preventDefault();
}

beforeEach(() => {
  window.history.replaceState(null, "", "/mail?demo=1&local=1");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  document.addEventListener("click", stopBrowserNavigation);
  passedThrough = false;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.removeEventListener("click", stopBrowserNavigation);
  vi.restoreAllMocks();
});

async function click(props: Parameters<typeof MailViewLink>[0], options: MouseEventInit = {}) {
  await act(async () => root.render(createElement(MailViewLink, props, "Open mail")));
  await act(async () => {
    host
      .querySelector("a")!
      .dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...options })
      );
  });
}

describe("local Mail view navigation", () => {
  it("normalizes a bare offline Mail route to its account without a router request", () => {
    window.history.replaceState(null, "", "/mail");
    const replace = vi.spyOn(window.history, "replaceState");
    expect(navigateMailView("/mail?account=google%3Areader", { replace: true })).toBe(true);
    expect(replace).toHaveBeenCalledOnce();
    expect(window.location.search).toBe("?account=google%3Areader");
    expect(navigateMailView("/library")).toBe(false);
  });

  it("keeps a real href, pushes a mailbox query locally and closes the account menu once", async () => {
    const navigate = vi.fn();
    const push = vi.spyOn(window.history, "pushState");
    const href = "/mail?demo=1&local=1&account=work&folder=inbox";
    await click({ href, onNavigate: navigate });
    expect(host.querySelector("a")?.getAttribute("href")).toBe(href);
    expect(window.location.search).toBe("?demo=1&local=1&account=work&folder=inbox");
    expect(push).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
    expect(passedThrough).toBe(false);
  });

  it("supports replacing a query without adding a browser history entry", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const push = vi.spyOn(window.history, "pushState");
    await click({ href: "/mail?folder=SENT", replace: true });
    expect(replace).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?folder=SENT");
  });

  it("honors an account navigation callback that cancels navigation", async () => {
    const push = vi.spyOn(window.history, "pushState");
    await click({ href: "/mail?account=work", onNavigate: (event) => event.preventDefault() });
    expect(push).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?demo=1&local=1");
  });

  it.each([
    [{ href: "/mail?account=work" }, { ctrlKey: true }],
    [{ href: "/mail?account=work", target: "_blank" }, {}],
    [{ href: "/library" }, {}],
  ])(
    "leaves modified, new-tab and cross-route clicks to the usual link behavior",
    async (props, options) => {
      const push = vi.spyOn(window.history, "pushState");
      await click(props, options);
      expect(push).not.toHaveBeenCalled();
      expect(passedThrough).toBe(true);
    }
  );
});
