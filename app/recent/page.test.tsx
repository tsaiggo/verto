import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listAllFilesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content-source", () => ({
  listAllFiles: listAllFilesMock,
}));

import RecentDocumentsView from "@/components/library/RecentDocumentsView";
import RecentPage from "./page";

async function renderedView() {
  const result = (await RecentPage()) as ReactElement<{ children: ReactNode }>;
  const view = Children.toArray(result.props.children).find(
    (child) => isValidElement(child) && child.type === RecentDocumentsView
  );
  expect(view).toBeDefined();
  return view as ReactElement<ComponentProps<typeof RecentDocumentsView>>;
}

describe("RecentPage source failures", () => {
  beforeEach(() => {
    listAllFilesMock.mockReset();
  });

  it("passes a recoverable failure state when the configured source cannot be listed", async () => {
    listAllFilesMock.mockRejectedValue(new Error("Repository access denied"));

    expect((await renderedView()).props).toMatchObject({
      initialRecent: [],
      initialLoadFailed: true,
    });
  });
});
