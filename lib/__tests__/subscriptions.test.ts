import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_SUBSCRIPTIONS,
  SUBSCRIPTIONS_KEY,
  deleteSubscription,
  findSubscription,
  loadSubscriptions,
  removeSubscription,
  saveSubscription,
  saveSubscriptions,
  upsertSubscription,
  type Subscription,
  type SubscriptionsState,
} from "@/lib/subscriptions";

const baseSubscription: Subscription = {
  feedUrl: "https://blog.example.com/feed.xml",
  title: "Example Blog",
  createdAt: "2026-06-05T00:00:00.000Z",
};

function subscription(overrides: Partial<Subscription>): Subscription {
  return { ...baseSubscription, ...overrides };
}

describe("upsertSubscription", () => {
  it("adds a new subscription to the front", () => {
    const previous = subscription({
      feedUrl: "https://other.example/feed",
      title: "Other",
    });
    const next = upsertSubscription([previous], baseSubscription);

    expect(next).toEqual([baseSubscription, previous]);
  });

  it("overwrites an existing feed and moves it to the front", () => {
    const old = subscription({ title: "Old", createdAt: "2020-01-01T00:00:00.000Z" });
    const other = subscription({
      feedUrl: "https://other.example/feed",
      title: "Other",
    });
    const updated = subscription({ title: "New", createdAt: "2026-06-06T00:00:00.000Z" });

    expect(upsertSubscription([old, other], updated)).toEqual([updated, other]);
  });

  it("caps the list at the requested maximum", () => {
    const existing = Array.from({ length: 3 }, (_, index) =>
      subscription({
        feedUrl: `https://e.example/${index}`,
        title: `Feed ${index}`,
      })
    );

    const next = upsertSubscription(existing, baseSubscription, 3);

    expect(next).toHaveLength(3);
    expect(next[0]).toEqual(baseSubscription);
  });

  it("keeps a valid siteUrl and drops an invalid one", () => {
    const withSite = upsertSubscription([], subscription({ siteUrl: "https://blog.example.com" }));
    expect(withSite[0].siteUrl).toBe("https://blog.example.com");

    const withBadSite = upsertSubscription([], subscription({ siteUrl: "javascript:alert(1)" }));
    expect(withBadSite[0].siteUrl).toBeUndefined();
  });

  it("rejects feeds without an absolute http(s) URL", () => {
    expect(upsertSubscription([], subscription({ feedUrl: "javascript:alert(1)" }))).toEqual([]);
    expect(upsertSubscription([], subscription({ feedUrl: "//evil.example" }))).toEqual([]);
    expect(upsertSubscription([], subscription({ feedUrl: "/relative/feed" }))).toEqual([]);
    expect(upsertSubscription([], subscription({ feedUrl: "" }))).toEqual([]);
  });

  it("does not mutate the input list", () => {
    const list = [subscription({ feedUrl: "https://other.example/feed", title: "Other" })];
    upsertSubscription(list, baseSubscription);

    expect(list).toEqual([subscription({ feedUrl: "https://other.example/feed", title: "Other" })]);
  });
});

describe("removeSubscription", () => {
  it("removes subscriptions by feedUrl", () => {
    const target = baseSubscription;
    const other = subscription({
      feedUrl: "https://other.example/feed",
      title: "Other",
    });

    expect(removeSubscription([target, other], target.feedUrl)).toEqual([other]);
  });

  it("does not mutate the input list", () => {
    const list = [baseSubscription];
    removeSubscription(list, baseSubscription.feedUrl);

    expect(list).toEqual([baseSubscription]);
  });
});

describe("findSubscription", () => {
  it("returns the subscription stored for a feedUrl", () => {
    const other = subscription({
      feedUrl: "https://other.example/feed",
      title: "Other",
    });

    expect(findSubscription([other, baseSubscription], baseSubscription.feedUrl)).toEqual(
      baseSubscription
    );
  });

  it("returns null when no subscription matches", () => {
    expect(findSubscription([baseSubscription], "https://missing.example/feed")).toBeNull();
  });
});

describe("subscriptions persistence", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips subscriptions through localStorage", () => {
    const state: SubscriptionsState = { subscriptions: [baseSubscription] };

    saveSubscriptions(state);

    expect(loadSubscriptions()).toEqual(state);
  });

  it("returns an empty state when nothing is stored", () => {
    expect(loadSubscriptions()).toEqual({ subscriptions: [] });
  });

  it("ignores malformed stored JSON", () => {
    window.localStorage.setItem(SUBSCRIPTIONS_KEY, "{not json");

    expect(loadSubscriptions()).toEqual({ subscriptions: [] });
  });

  it("drops invalid subscriptions and caps persisted entries", () => {
    const many = Array.from({ length: MAX_SUBSCRIPTIONS + 3 }, (_, index) =>
      subscription({
        feedUrl: `https://e.example/${index}`,
        title: `Feed ${index}`,
      })
    );
    window.localStorage.setItem(
      SUBSCRIPTIONS_KEY,
      JSON.stringify({
        subscriptions: [null, { title: "Missing url" }, { feedUrl: "//evil.example" }, ...many],
      })
    );

    const loaded = loadSubscriptions();

    expect(loaded.subscriptions).toHaveLength(MAX_SUBSCRIPTIONS);
    expect(loaded.subscriptions[0].feedUrl).toBe("https://e.example/0");
  });

  it("saves one subscription and notifies same-tab subscribers without StorageEvent", () => {
    const events: string[] = [];
    vi.stubGlobal("StorageEvent", undefined);
    window.addEventListener = (type: string) => void events.push(`listen:${type}`);
    window.dispatchEvent = (event: Event) => {
      events.push(event.type);
      return true;
    };

    expect(() => saveSubscription(baseSubscription)).not.toThrow();
    expect(loadSubscriptions()).toEqual({ subscriptions: [baseSubscription] });
    expect(events).toContain("storage");
  });

  it("deletes one subscription and notifies same-tab subscribers", () => {
    const other = subscription({
      feedUrl: "https://other.example/feed",
      title: "Other",
    });
    const events: string[] = [];
    saveSubscriptions({ subscriptions: [baseSubscription, other] });
    vi.stubGlobal("StorageEvent", undefined);
    window.dispatchEvent = (event: Event) => {
      events.push(event.type);
      return true;
    };

    expect(deleteSubscription(baseSubscription.feedUrl)).toEqual({
      subscriptions: [other],
    });
    expect(loadSubscriptions()).toEqual({ subscriptions: [other] });
    expect(events).toContain("storage");
  });
});

describe("subscriptions without a DOM", () => {
  it("loadSubscriptions returns an empty state when window is undefined", () => {
    expect(loadSubscriptions()).toEqual({ subscriptions: [] });
  });

  it("saveSubscriptions is a no-op when window is undefined", () => {
    expect(() => saveSubscriptions({ subscriptions: [baseSubscription] })).not.toThrow();
  });
});
