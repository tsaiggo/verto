// @vitest-environment jsdom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import MailTextBody from "./MailTextBody";

it("renders safe body links with their exact destinations and never creates email HTML elements", () => {
  const body = document.createElement("div");
  const text =
    "Open https://example.com/confirm?a=1&b=2.\n<script>alert(1)</script> javascript:alert(2)";
  body.innerHTML = renderToStaticMarkup(createElement(MailTextBody, { text }));
  const link = body.querySelector("a")!;
  expect(body.textContent).toBe(text);
  expect(link.getAttribute("href")).toBe("https://example.com/confirm?a=1&b=2");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(body.querySelectorAll("a")).toHaveLength(1);
  expect(body.querySelector("script, img, iframe")).toBeNull();
});
