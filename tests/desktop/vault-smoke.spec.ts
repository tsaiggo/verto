import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { $, $$, browser, expect } from "@wdio/globals";
import type {} from "webdriverio";

import {
  DESKTOP_SMOKE_EXTERNAL_MARKER,
  DESKTOP_SMOKE_INITIAL_MARKER,
  DESKTOP_SMOKE_LOCAL_DRAFT_MARKER,
  DESKTOP_SMOKE_SAVED_MARKER,
  DESKTOP_SMOKE_TITLE,
  DESKTOP_SMOKE_WATCH_TITLE,
  desktopSmokeBookmarks,
  desktopSmokeDocument,
  desktopSmokeRenamedDocument,
  desktopSmokeVault,
  desktopSmokeWatchedDocument,
} from "./fixture";

const ACTIVE_FOLDER_KEY = "verto:active-local-folder";
const BOOKMARKS_KEY = "verto:bookmarks";
const RECENT_FOLDERS_KEY = "verto:recent-local-folders";
const CONFLICT_MESSAGE =
  "This file changed on disk after you opened it. Reload the disk version or explicitly overwrite it.";
const DESKTOP_SMOKE_WATCH_MODIFIED_TITLE = "Watcher Modified Note";

async function buttonWithTitle(title: string) {
  let match: WebdriverIO.Element | undefined;
  await browser.waitUntil(
    async () => {
      const buttons = await $$("button[title]");
      for (const button of buttons) {
        if ((await button.getAttribute("title")) === title) {
          match = button;
          return true;
        }
      }
      return false;
    },
    {
      timeout: 60_000,
      timeoutMsg: `Could not find a button with title "${title}".`,
    }
  );
  return match!;
}

async function waitForAppWindow() {
  await browser.waitUntil(async () => (await browser.getTitle()) === "Verto", {
    timeout: 60_000,
    timeoutMsg: "The production Tauri window did not finish loading.",
  });
}

async function followNavigation(href: string) {
  const link = await $(`a[href="${href}"]`);
  await link.waitForClickable();
  await link.click();
  await browser.waitUntil(async () => (await browser.getUrl()).includes(href), {
    timeoutMsg: `Navigation to ${href} did not complete.`,
  });
}

async function libraryDocumentByTitle(title: string) {
  return $(`//div[@role="list" and @aria-label="Documents"]//a[contains(., "${title}")]`);
}

async function revealedBookmarkButton(title: string) {
  const documentLink = await libraryDocumentByTitle(title);
  await documentLink.waitForDisplayed();
  await documentLink.moveTo();
  return $(`button[aria-label="Bookmark: ${title}"]`);
}

async function libraryDocumentByFile(path: string) {
  return $(
    `//div[@role="list" and @aria-label="Documents"]//a[contains(@href, "${basename(path)}")]`
  );
}

async function openSmokeDocument() {
  await followNavigation("/library");
  const documentLink = await libraryDocumentByTitle(DESKTOP_SMOKE_TITLE);
  await documentLink.waitForDisplayed();
  await documentLink.click();
  await expect($("h1=Production desktop vault")).toBeDisplayed();
}

async function openSourceEditor() {
  const editButton = await $(
    '//*[@role="group" and @aria-label="Workspace mode"]//button[normalize-space(.)="Edit"]'
  );
  await editButton.waitForClickable();
  await editButton.click();
  const source = await $('textarea[aria-label="MDX source"]');
  await source.waitForDisplayed();
  return source;
}

async function reactivateAuthorizedVault() {
  // The native registry was prepared before launch to model a vault the user
  // authorized in an earlier session. The renderer history is deliberately
  // restored separately, then the normal Sources UI re-activates the vault.
  await browser.execute(
    (vault: string, activeKey: string, recentKey: string) => {
      window.localStorage.removeItem(activeKey);
      window.localStorage.setItem(recentKey, JSON.stringify([vault]));
    },
    desktopSmokeVault,
    ACTIVE_FOLDER_KEY,
    RECENT_FOLDERS_KEY
  );

  await followNavigation("/integrations");
  const recentFolder = await buttonWithTitle(desktopSmokeVault);
  await recentFolder.waitForClickable();
  await recentFolder.click();
  await expect($("p*=Found 1 readable file.")).toBeDisplayed();
}

describe("Verto production desktop vault", () => {
  it("reopens an authorized vault, reads a document, and saves an edit", async () => {
    await waitForAppWindow();
    await reactivateAuthorizedVault();

    await openSmokeDocument();
    await expect($(`p*=${DESKTOP_SMOKE_INITIAL_MARKER}`)).toBeDisplayed();

    const source = await openSourceEditor();
    const updatedSource = `${await source.getValue()}\n${DESKTOP_SMOKE_SAVED_MARKER}\n`;
    await source.setValue(updatedSource);

    const saveButton = await $(`button[aria-label^="Save ${DESKTOP_SMOKE_TITLE}"]`);
    await saveButton.waitForClickable();
    await saveButton.click();
    await expect($("p*=Saved to your local folder.")).toBeDisplayed();

    await browser.waitUntil(
      async () =>
        (await readFile(desktopSmokeDocument, "utf8")).includes(DESKTOP_SMOKE_SAVED_MARKER),
      { timeoutMsg: "The production desktop edit was not persisted to the Markdown file." }
    );
  });

  it("returns a structured conflict without overwriting an external Markdown edit", async () => {
    await openSmokeDocument();
    const source = await openSourceEditor();
    const localDraft = `${await source.getValue()}\n${DESKTOP_SMOKE_LOCAL_DRAFT_MARKER}\n`;
    await source.setValue(localDraft);

    const externalSource = `${await readFile(
      desktopSmokeDocument,
      "utf8"
    )}\n${DESKTOP_SMOKE_EXTERNAL_MARKER}\n`;
    await writeFile(desktopSmokeDocument, externalSource, "utf8");

    const saveButton = await $(`button[aria-label^="Save ${DESKTOP_SMOKE_TITLE}"]`);
    await saveButton.waitForClickable();
    await saveButton.click();

    const conflictAlert = await $(`//*[@role="alert" and contains(., "${CONFLICT_MESSAGE}")]`);
    await conflictAlert.waitForDisplayed();
    await expect(
      $('//*[@role="alert"]//button[normalize-space(.)="Reload disk version"]')
    ).toBeDisplayed();
    await expect(
      $('//*[@role="alert"]//button[normalize-space(.)="Overwrite anyway"]')
    ).toBeDisplayed();
    expect(await source.getValue()).toContain(DESKTOP_SMOKE_LOCAL_DRAFT_MARKER);

    const diskAfterConflict = await readFile(desktopSmokeDocument, "utf8");
    expect(diskAfterConflict).toBe(externalSource);
    expect(diskAfterConflict).toContain(DESKTOP_SMOKE_EXTERNAL_MARKER);
    expect(diskAfterConflict).not.toContain(DESKTOP_SMOKE_LOCAL_DRAFT_MARKER);

    // Resolve the dirty state through the UI so later navigation is not intercepted.
    const reloadDiskButton = await $(
      '//*[@role="alert"]//button[normalize-space(.)="Reload disk version"]'
    );
    await reloadDiskButton.click();
    await conflictAlert.waitForExist({
      reverse: true,
      timeoutMsg: "Reloading the disk version did not clear the save conflict.",
    });
    await browser.waitUntil(
      async () => (await source.getValue()).includes(DESKTOP_SMOKE_EXTERNAL_MARKER),
      {
        timeoutMsg: "Reloading the disk version did not replace the editor draft.",
      }
    );
    expect(await source.getValue()).not.toContain(DESKTOP_SMOKE_LOCAL_DRAFT_MARKER);
  });

  it("reflects native watcher create, modify, rename, and delete events in Library", async () => {
    await followNavigation("/library");

    // Exercise the native watcher boundary with an actual out-of-process disk
    // change. The library must update without a manual rescan or page reload.
    await writeFile(
      desktopSmokeWatchedDocument,
      `---\ntitle: ${DESKTOP_SMOKE_WATCH_TITLE}\n---\n\n# Added outside Verto\n`,
      "utf8"
    );
    const watchedDocumentLink = await libraryDocumentByTitle(DESKTOP_SMOKE_WATCH_TITLE);
    await watchedDocumentLink.waitForDisplayed({
      timeout: 30_000,
      timeoutMsg: "The native watcher did not add the externally created Markdown document.",
    });
    const originalPathLink = await libraryDocumentByFile(desktopSmokeWatchedDocument);
    await originalPathLink.waitForDisplayed();

    await writeFile(
      desktopSmokeWatchedDocument,
      `---\ntitle: ${DESKTOP_SMOKE_WATCH_MODIFIED_TITLE}\n---\n\n# Modified outside Verto\n`,
      "utf8"
    );
    const modifiedDocumentLink = await libraryDocumentByTitle(DESKTOP_SMOKE_WATCH_MODIFIED_TITLE);
    await modifiedDocumentLink.waitForDisplayed({
      timeout: 30_000,
      timeoutMsg: "The native watcher did not refresh the externally modified Markdown document.",
    });
    await watchedDocumentLink.waitForExist({
      reverse: true,
      timeout: 30_000,
      timeoutMsg: "Library kept the stale pre-modification Markdown title.",
    });

    await rename(desktopSmokeWatchedDocument, desktopSmokeRenamedDocument);
    const renamedPathLink = await libraryDocumentByFile(desktopSmokeRenamedDocument);
    await renamedPathLink.waitForDisplayed({
      timeout: 30_000,
      timeoutMsg: "The native watcher did not reflect the Markdown rename in Library.",
    });
    await originalPathLink.waitForExist({
      reverse: true,
      timeout: 30_000,
      timeoutMsg: "Library kept the stale pre-rename Markdown path.",
    });

    await unlink(desktopSmokeRenamedDocument);
    await renamedPathLink.waitForExist({
      reverse: true,
      timeout: 30_000,
      timeoutMsg: "The native watcher did not remove the deleted Markdown document.",
    });
    await modifiedDocumentLink.waitForExist({
      reverse: true,
      timeout: 30_000,
      timeoutMsg: "Library kept the deleted Markdown document title.",
    });
  });

  it("restores a portable UI bookmark after a new desktop process starts", async function () {
    this.timeout(360_000);
    await followNavigation("/library");
    // The bookmark affordance becomes interactive on row hover/focus.
    const bookmarkButton = await revealedBookmarkButton(DESKTOP_SMOKE_TITLE);
    await bookmarkButton.waitForClickable();
    await bookmarkButton.click();
    const removeBookmarkButton = await $(
      `button[aria-label="Remove bookmark: ${DESKTOP_SMOKE_TITLE}"]`
    );
    await removeBookmarkButton.waitForDisplayed();

    await browser.waitUntil(
      async () =>
        readFile(desktopSmokeBookmarks, "utf8")
          .then((json) => {
            const bookmarks = JSON.parse(json) as Array<{ title?: unknown }>;
            return bookmarks.some((bookmark) => bookmark.title === DESKTOP_SMOKE_TITLE);
          })
          .catch(() => false),
      {
        timeout: 30_000,
        timeoutMsg: "The UI bookmark was not mirrored to the portable Vault state.",
      }
    );
    await browser.waitUntil(
      () =>
        browser.execute(() => {
          for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index);
            if (key?.startsWith("verto:state-store-recovery:") && key.endsWith(":bookmarks")) {
              return false;
            }
          }
          return true;
        }),
      {
        timeout: 30_000,
        timeoutMsg: "The portable bookmark write did not finish before the process restart.",
      }
    );

    // Replace the browser cache with an empty value before ending the session.
    // The next renderer can only recover this bookmark by hydrating the
    // portable .verto/bookmarks.json written above.
    const clearedCache = await browser.execute((key: string) => {
      window.localStorage.setItem(key, "[]");
      return window.localStorage.getItem(key);
    }, BOOKMARKS_KEY);
    expect(clearedCache).toBe("[]");

    const previousSessionId = browser.sessionId;
    const restartedSessionId = await browser.reloadSession();
    expect(restartedSessionId).not.toBe(previousSessionId);
    await waitForAppWindow();
    await followNavigation("/bookmarks");

    const restoredBookmark = await $(
      `//*[@id="bookmark-panel"]//a[contains(., "${DESKTOP_SMOKE_TITLE}")]`
    );
    await restoredBookmark.waitForDisplayed({
      timeout: 30_000,
      timeoutMsg: "The restarted desktop process did not hydrate the portable bookmark.",
    });
  });

  it("applies an external portable-state update without reloading the app", async () => {
    const restoredBookmark = await $(
      `//*[@id="bookmark-panel"]//a[contains(., "${DESKTOP_SMOKE_TITLE}")]`
    );
    await restoredBookmark.waitForDisplayed();

    // Model another device (or a sync provider) replacing the portable state
    // file while this renderer remains open. The native watcher must refresh
    // StateStore directly; content indexing and a page reload are not involved.
    await writeFile(desktopSmokeBookmarks, "[]\n", "utf8");

    await restoredBookmark.waitForExist({
      reverse: true,
      timeout: 30_000,
      timeoutMsg: "The open desktop session did not apply the external bookmark update.",
    });
    await browser.waitUntil(
      async () =>
        browser.execute((key: string) => {
          const json = window.localStorage.getItem(key);
          if (json === null) return false;
          try {
            const bookmarks: unknown = JSON.parse(json);
            return Array.isArray(bookmarks) && bookmarks.length === 0;
          } catch {
            return false;
          }
        }, BOOKMARKS_KEY),
      {
        timeout: 30_000,
        timeoutMsg: "The external bookmark update did not refresh the local cache.",
      }
    );
  });
});
