# Web Mail: live acceptance

Status: **not run against real Gmail or Outlook accounts**. This checklist is
the deployment gate after OAuth client IDs, a fixed origin and authorized test
accounts are supplied. Automated mocks and the demo inbox do not complete it.
Use disposable messages and recipients you control. Record results without
access tokens, message bodies or private account details.

## Deployment inputs

- [ ] Record the build revision, browser/version, exact origin and test date.
- [ ] Choose one fixed origin, preferably an owned domain with trusted HTTPS,
      such as `https://mail.example.com`; its mail page is `<origin>/mail`.
      For local development, use `http://localhost:3000`.
- [ ] Set `NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID` and/or
      `NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID` before building. These are
      public client IDs, not secrets. Rebuild/redeploy when either value changes.
- [ ] Confirm `/mail` loads directly at that origin and sign-in popups are allowed.
- [ ] Have a Gmail test account and an Outlook mailbox compatible with the app's
      configured audience. For combined-account checks, have at least two accounts.
      Arrange a separate recipient inbox you control for delivery checks.
- [ ] Seed each inbox with enough disposable messages to span several pages,
      one unread message, one attachment, one custom label/folder and a unique
      phrase found only deep in a body. Keep the provider's web app open as the
      independent reference.

### Google configuration

Create a **Web application** OAuth client, enable the Gmail API, and register
the exact authorized JavaScript origin: scheme, hostname and port, with no
path, query or fragment. For localhost, add `http://localhost` and the actual
port origin. [Google client setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid).

Origins require HTTPS except loopback/localhost; non-loopback raw IP addresses
are rejected. A changing LAN address such as `http://192.168.1.20:3000` is a
preview address, not an authorized Gmail origin. [Google origin validation](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow#javascript-origin-validation-rules).

Configure these scopes in the consent screen:

| User step | Requested scope |
| --- | --- |
| Connect/Reconnect | `https://www.googleapis.com/auth/gmail.readonly` |
| First message action | `https://www.googleapis.com/auth/gmail.modify` |
| Enable sending | `https://www.googleapis.com/auth/gmail.send` |

Gmail readonly and modify are restricted scopes; public use can require
verification. Modify also permits provider sending, while Verto separately
requires its explicit send setup. In Testing, add every participating account
as an allowed test user; Workspace policy can still restrict access.
[Gmail scopes and verification](https://developers.google.com/workspace/gmail/api/auth/scopes).

### Microsoft configuration

Register an Entra app whose audience includes the test mailboxes; the current
connector uses the common authority for organizational and personal accounts.
Register `<origin>/mail` under **Single-page application**, not Web, and add
delegated `Mail.Read`, `User.Read`, `Mail.ReadWrite` and `Mail.Send` permissions.
Connect requests Read/User.Read; an action adds ReadWrite, and Enable sending
adds Send. Tenant policy may require administrator approval.

The app sends `${window.location.origin}/mail` as the redirect: match its scheme,
host, port and `/mail` path/case; omit query and fragment. Microsoft requires
HTTPS outside its localhost exceptions. Registering only an HTTP LAN IP does
not satisfy this flow. [Microsoft SPA and redirect rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url).

## Gmail acceptance

- [ ] Connect from a fresh session. Confirm the account is the selected Gmail
      address, initial permission is read access, and no startup popup appears.
- [ ] Open Inbox, wait for sync completion and compare all pages with Gmail.
      Read a complete body and download the known attachment. Search for the
      deep body phrase; a preview alone must not be the source of the match.
- [ ] Mark a disposable unread message read. Grant modify permission for the
      connected account. Confirm Gmail and Verto agree after completion.
      Mark it unread again; subsequent actions in this connection reuse the grant.
- [ ] Star and unstar it. Compare both states with Gmail, then reload/reconnect
      and sync to confirm the state persists remotely.
- [ ] Archive an Inbox message with a custom label. It leaves Inbox, remains
      under its custom label and appears in Verto Archive. Archive is virtual:
      messages with `INBOX`, `TRASH`, `SPAM` or `DRAFT` are excluded; eligible
      Sent mail can appear. Archive does not remove custom labels.
- [ ] Move a disposable message to Trash. Confirm it appears in Gmail Trash
      and Verto Trash after sync, and leaves Inbox/Archive membership. Restore
      it using Gmail's web UI, then sync Verto. This tests recovery before the
      provider's retention policy removes it; Verto has no restore/delete-forever action.
- [ ] Change read/star/label membership and delete a disposable message in
      Gmail's UI. Sync Verto again and verify changes/removals without duplicates.
- [ ] Cancel or partially deny modify consent, and try choosing a different
      Google account. The action must fail honestly while prior read access,
      saved mail and any enabled sending remain usable.
- [ ] Reload the page, then separately leave it open until the token expires.
      Saved bodies/search remain usable; online actions ask for Reconnect.
      No timer/startup consent appears. Reconnect explicitly to the same account.
      [Google token renewal](https://developers.google.com/identity/oauth2/web/guides/use-token-model#token_expiration).
- [ ] Enable sending explicitly, send a unique message to the controlled
      recipient and check Gmail Sent and the recipient inbox. Reply to a seeded
      conversation and verify threading; forward it and verify quoted text.
      Forwarded original attachments and new-file uploads are outside this scope.

## Outlook acceptance

- [ ] Connect the selected Outlook mailbox. Confirm initial Read/User.Read
      consent and the account identity; do not accept an unintended tenant/account.
- [ ] Sync Inbox through several pages. Compare complete body, unread state,
      attachment bytes and deep-body search with Outlook's web UI.
- [ ] Mark a disposable message read and unread. Grant Mail.ReadWrite for that
      same mailbox; subsequent actions reuse the grant during this connection.
- [ ] Star and unstar it; verify Outlook flag status agrees. Reload and sync
      to confirm remote persistence.
- [ ] Archive an Inbox message. Confirm it leaves Inbox and appears in the
      mailbox's Archive folder. Open it there and download its attachment;
      no old-ID copy should remain in the saved Inbox.
- [ ] Move a disposable message to Trash. Confirm it is in Outlook Deleted
      Items, with its complete detail still readable after sync. Restore through
      Outlook's web UI and sync again. Verto does not permanently delete mail.
- [ ] Move/change/delete messages through Outlook's UI during and after sync.
      Verify destination membership and removal from the old folder. No duplicate
      should appear if the provider changes a message ID during a move.
- [ ] Cancel ReadWrite consent, deny it, or select another account. Existing
      read/send access and saved messages remain usable; no mutation is reported.
- [ ] Reload within the browser session and verify MSAL can restore silently.
      Simulate a temporary identity-network failure, restore networking and retry:
      it must not be reported as an expired session. Revoke access or expire the
      session and verify Reconnect is requested without an automatic popup.
      [MSAL error handling](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/errors).
- [ ] Enable Mail.Send explicitly. Send, reply and forward to controlled
      recipients, checking Outlook Sent Items and actual arrival separately.
      Graph acceptance is not delivery confirmation.
      [Graph sendMail response](https://learn.microsoft.com/en-us/graph/api/user-sendmail).

## Shared persistence, accounts and failure checks

- [ ] Connect two accounts, switch folders, then use the combined Inbox.
      Identical subjects/IDs must remain assigned to the right account. Apply an
      action in the combined Inbox and verify only its owner mailbox changes.
- [ ] Open the same message in two windows and start opposite read/star actions
      together. Only the window holding its shared mutation lease may contact
      the provider; the other explains that it must wait. Retry after completion
      and verify both windows and the provider agree. Interrupt a window during
      an action, then sync to reconcile any unconfirmed remote change.
- [ ] Disconnect one account and reconnect it without removing its saved cache.
      Its offline messages remain readable; the other account remains connected.
      Permission expansion must remain bound to the selected account.
- [ ] Save Inbox and one additional folder, then go offline. Read saved full
      bodies, search them and switch accounts. Unsaved folders explain that they
      need syncing; attachments, sends and message changes require connectivity.
- [ ] At HTTPS/localhost, visit Mail online until the shell/assets are cached,
      close/reopen or reload while offline, and verify saved Mail loads. Repeat
      with a query on `/mail`. Plain HTTP LAN previews support already-open cache
      reads but cannot promise a fresh offline reload through a service worker.
- [ ] Open the same site in a different browser profile/device or at a different
      origin. Its mail cache and drafts must not be presented as the first profile's
      data. Storage is local to a browser profile and exact origin, per account.
- [ ] Use **Manage accounts → Clear saved mail** on one account. Only its saved
      mail/checkpoints disappear; its drafts and OAuth authorization remain.
      Explicit sync repopulates it. The other account's cache remains intact.
- [ ] In a disposable profile, copy any needed draft text, then clear all browser
      site data. Saved mail, local drafts and local sign-in state disappear;
      reconnecting and syncing must start with a fresh local library.
- [ ] Create and edit Compose, Reply, Reply all and Forward drafts. Reload and
      switch accounts; the drafts stay with their originating account. Local
      drafts are separate from the provider's Drafts folder.
- [ ] Open the same draft in two windows. Edit distinct drafts in both without
      losing either. Start one send and attempt another send/edit/discard of that
      same draft in the second window: the renewable send lease blocks conflicts.
- [ ] Block or exhaust localStorage/IndexedDB in a disposable browser profile.
      Draft-saving failures show a copy-before-leaving notice; a send whose shared
      reservation cannot be stored must not contact the provider. Saved mail
      failures must not advance a checkpoint or claim a local change succeeded.
- [ ] Interrupt the network during a disposable send, then reload or let its
      lease expire. A warning preserves the uncertainty; there is no automatic
      resend. Check Sent and the recipient before an explicit retry. A confirmed
      provider acceptance with failed local cleanup must retain an already-sent
      warning rather than permit a duplicate from a stale window.
- [ ] Fail an action request or its full reread. UI/saved state must not change
      optimistically. If the request may have reached the provider, verify there
      and sync before repeating a move. A provider-confirmed change followed by
      cache failure explicitly asks for sync.

## Provider ID and continuation checks

Outlook currently uses Graph's default IDs consistently for list, delta,
detail, attachments and mutations. Moves can change them; the authoritative
returned ID replaces the saved original. Opting into immutable IDs later must
cover every request and migrate saved identities, rather than mixing formats.
Graph's delta links support either format, but existing cache IDs still need
conversion. [Microsoft immutable IDs](https://learn.microsoft.com/en-us/graph/outlook-immutable-id).

Automated security checks cover foreign origins, credentials/fragments,
cross-folder and endpoint-changing list/delta continuations. During a live run,
confirm paginated Inbox/Archive/custom-folder sync completes without an invalid
continuation error. Do not edit provider state URLs, log bearer tokens or treat
a failed page as a completed checkpoint.

## Result record

| Provider/scenario | Result | Evidence or issue | Tester/date |
| --- | --- | --- | --- |
| Gmail actions, sync, consent/expiry | Pending | Client ID, origin and authorized test account required | — |
| Outlook actions, sync, consent/renewal | Pending | Client ID, origin and authorized test account required | — |
| Multi-account, offline/cache, drafts/send failures | Pending | Run at the intended deployment origin | — |

Mark each checklist item only after observing its expected result. Record any
tenant-policy restriction, browser-storage failure or unsupported environment
as an issue. Live acceptance is complete only after both required providers and
the shared scenarios pass at the intended deployment origin.
