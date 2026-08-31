# Work on any URL, not just `.gov.bb`

Date: 2026-08-31
Plan: [docs/plans/support-any-url.md](../plans/support-any-url.md)
Decision: [docs/decisions/0006-host-access-is-any-site-the-user-is-testing.md](../decisions/0006-host-access-is-any-site-the-user-is-testing.md)

## What changed

Source `manifest.json`: `host_permissions` and `content_scripts[].matches` are both
`["<all_urls>"]`, replacing the `.gov.bb` + localhost allowlist. `permissions` is
unchanged (`["scripting", "storage"]`), version `1.0.4` → `1.1.0` (also in
`package.json`).

New `src/shared/urlSupport.ts` explains the pages that still cannot be filled, wired
into `src/background/index.ts`. Docs: decision 0006 added, 0003 marked superseded,
permission wording in `README.md`, `PRIVACY.md` and `docs/ORG_DISTRIBUTION.md`
brought back in line with the manifest.

## Why it looks this way

- **No fill logic changed, because none of it was domain-aware.** The allowlist
  lived entirely in the manifest. The Barbados-flavoured values (phone numbers,
  `BBxxxxx` postcodes, TAMIS references) are chosen from *field labels*, not from
  the host, so they behave identically on a Netlify preview or a vendor form.

- **Both manifest fields had to move, and the third one follows.** crxjs mirrors
  the content script's `matches` onto the auto-generated
  `web_accessible_resources[].matches` for the dynamic-import chunk. Had only
  `content_scripts` been broadened, the `ensureContentScript` fallback would have
  injected a loader that could not import its own payload on any non-allowlisted
  origin — a silent failure on exactly the sites this change is for. Verified in
  the build output: all three are `<all_urls>`.

- **`activeTab` stayed dropped.** Decision 0003 removed it as redundant once
  `host_permissions` authorised `chrome.scripting.executeScript` on a user gesture;
  `<all_urls>` authorises it strictly more broadly, so re-adding it would widen the
  permission list on the store listing while granting nothing new.

- **"Works anywhere" makes silent failure worse, so it was fixed here.** Users will
  now press Alt+Shift+F on `chrome://extensions` and the Web Store. Two checks,
  because one is not enough: `describeUnsupportedUrl` reads the tab URL up front,
  but Chrome *withholds* `tab.url` for pages the extension has no access to — a
  `chrome://` tab frequently reports none — so `describeInjectionFailure` also
  translates the `executeScript` rejection. An unknown URL deliberately returns
  `null` (fill proceeds) rather than blocking a page we merely cannot read.
  `runFill` failures are now unwrapped with `errorMessage`, so the popup shows
  "Form Filler can't run on this page — …" instead of `Error: [object Object]`.
  Decision 0003 listed this message as "possible future work"; broad host access is
  what made it necessary.

- **The Web Store flag is back, on purpose.** This reverses the one thing decision
  0003 existed to achieve, so 0006 records the trade-off and the justification text
  to submit rather than leaving a future reader to rediscover it. `<all_urls>` is
  inherent to the request: a tool for filling forms on whichever site is under test
  cannot enumerate its hosts in advance.

- **`file://` is included but not guaranteed.** `<all_urls>` covers `file:`, so
  local prototype HTML works — but only once the user enables "Allow access to file
  URLs" at `chrome://extensions`, which no extension can grant itself. The blocked
  case names that toggle instead of reporting a generic failure.

## Verification

`pnpm test`: 237/237 pass — the 207 pre-existing tests unchanged (no fill logic was
touched) plus 30 new in `tests/urlSupport.test.ts` covering allowed schemes, each
blocked scheme, both Web Store hosts, unknown/absent URLs, and the injection-failure
translation. `pnpm build` clean; `dist/manifest.json` confirms `version: 1.1.0`,
`permissions: ["scripting", "storage"]`, and `<all_urls>` in `host_permissions`,
`content_scripts[].matches` and the generated `web_accessible_resources[].matches`.

Manual unpacked-load checks (fill on a non-`.gov.bb` form; reason shown in the popup
on a `chrome://` page) are **not** done — they need a browser and are left to
whoever loads the build.
