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

import TagsView from "@/components/tags/TagsView";
import TagsPage from "./page";

async function renderedView() {
  const result = (await TagsPage()) as ReactElement<{ children: ReactNode }>;
  const view = Children.toArray(result.props.children).find(
    (child) => isValidElement(child) && child.type === TagsView
  );
  expect(view).toBeDefined();
  return view as ReactElement<ComponentProps<typeof TagsView>>;
}

describe("TagsPage source failures", () => {
  beforeEach(() => {
    listAllFilesMock.mockReset();
  });

  it("passes a recoverable failure state when the configured source cannot be listed", async () => {
    listAllFilesMock.mockRejectedValue(new Error("Repository access denied"));

    expect((await renderedView()).props).toMatchObject({
      initialTags: [],
      initialLoadFailed: true,
    });
  });
});
