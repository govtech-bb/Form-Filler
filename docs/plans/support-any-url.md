# Plan: Work on any URL, not just `.gov.bb`

## Goal

Let Form Filler fill forms on **any** page the user opens it on — prototype hosts,
vendor forms, preview URLs, local files — instead of only `*.gov.bb` and
`localhost`/`127.0.0.1`, and tell the user why when a page genuinely cannot be
filled.

## Background

Nothing in the fill logic is domain-aware. The only gate is the source
`manifest.json`: `host_permissions` and `content_scripts[].matches` both carried
the `.gov.bb` + local-dev allowlist added by
[decision 0003](../decisions/0003-host-access-restricted-to-gov-bb-and-local-dev.md)
to clear the Chrome Web Store's "Broad Host Permissions" flag. Off-allowlist, the
extension did nothing *and said nothing*, because the toast is drawn by the content
script that could not be injected.

`@crxjs/vite-plugin` propagates the content script's `matches` into two places in
the built manifest — `content_scripts[].matches` and the auto-generated
`web_accessible_resources[].matches` for the dynamic-import chunk. Both must be
broad, or the injected loader cannot import its own payload on a non-allowlisted
origin.

## Steps

1. **Manifest** — `host_permissions` and `content_scripts[].matches` → `["<all_urls>"]`.
   Keep `permissions: ["scripting", "storage"]`; `activeTab` stays dropped
   (`host_permissions` already authorises the `executeScript` fallback). Version
   `1.0.4` → `1.1.0`, mirrored in `package.json`.
2. **`src/shared/urlSupport.ts`** (new, pure, unit-tested)
   - `describeUnsupportedUrl(url)` → a user-facing reason, or `null` when the page
     is fillable. `null` for an unknown URL: Chrome withholds `tab.url` on pages we
     have no access to, and refusing to try would break ordinary pages.
   - `describeInjectionFailure(error, url)` → translates an `executeScript`
     rejection, the only signal for pages whose URL Chrome hides. Names the
     "Allow access to file URLs" toggle for `file:` URLs.
3. **`src/background/index.ts`** — check the URL up front in `runFill(tabId, url)`;
   wrap `ensureContentScript`'s `executeScript` and rethrow the translated reason;
   pass `tab.url` from both entry points (keyboard command, popup `FILL_REQUEST`);
   unwrap errors with `errorMessage` so the popup shows the message, not `"Error: …"`.
4. **Docs** — decision 0006 accepting the Web Store trade-off, 0003 marked
   superseded, README/PRIVACY/ORG_DISTRIBUTION permission wording corrected.

## Verification

- `pnpm test` — the existing suite plus `tests/urlSupport.test.ts`.
- `pnpm build`, then confirm in `dist/manifest.json` that `host_permissions`,
  `content_scripts[].matches` **and** the generated
  `web_accessible_resources[].matches` are all `<all_urls>` at version `1.1.0`.
- Manual unpacked load: fill a non-`.gov.bb` form; confirm a `chrome://` page
  reports a reason in the popup instead of failing silently.

## Out of scope

- Any per-site allowlist/blocklist UI.
- Surfacing the blocked-page reason for the keyboard shortcut — impossible on a
  page Chrome will not let us inject into.
- Changing value generation: the Barbados-flavoured values are label-driven and
  stay as they are on every host.
