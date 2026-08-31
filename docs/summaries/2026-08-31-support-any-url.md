# Work on any URL, not just `.gov.bb`

Date: 2026-08-31
Plan: [docs/plans/support-any-url.md](../plans/support-any-url.md)
Decision: [docs/decisions/0006-host-access-is-any-site-the-user-is-testing.md](../decisions/0006-host-access-is-any-site-the-user-is-testing.md)

## What changed

The extension now fills forms on any page the user invokes it on, and asks for
**fewer** permissions than before to do it. Source `manifest.json`:
`permissions: ["activeTab", "scripting", "storage"]`, no `host_permissions` key, and
no `content_scripts` key — the `.gov.bb` + localhost allowlist is gone rather than
widened. Version `1.0.4` → `1.1.0` (also in `package.json`).

- `vite.config.ts` gained a second, chained lib/IIFE pass emitting a self-contained
  `dist/content.js`; crxjs still handles the popup and service worker.
- `src/background/index.ts` injects that file with `chrome.scripting.executeScript`
  on the user's gesture, instead of reading a hashed filename out of the manifest.
- New `src/shared/urlSupport.ts` explains the pages that still cannot be filled.
- Docs: decision 0006 added, 0003 marked superseded, permission wording in
  `README.md`, `PRIVACY.md` and `docs/ORG_DISTRIBUTION.md` brought back in line
  with the manifest.

## Why it looks this way

- **No fill logic changed, because none of it was domain-aware.** The allowlist
  lived entirely in the manifest. The Barbados-flavoured values (phone numbers,
  `BBxxxxx` postcodes, TAMIS references) are chosen from *field labels*, not from
  the host, so they behave identically on a Netlify preview or a vendor form.

- **`activeTab` rather than `<all_urls>`.** The first cut of this change simply
  broadened both manifest fields to `<all_urls>`. That works, and it hands back
  exactly the Chrome Web Store "Broad Host Permissions" flag decision 0003 existed
  to remove — plus the "read and change all your data on all websites" install
  warning, for a tool that only ever touches one tab after an explicit click.
  `activeTab` grants one tab, any origin, on a user gesture, and Chrome grants it
  for both entry points here: invoking the action (which opens the popup) and firing
  a `commands` shortcut. Same reach, no flag, smaller prompt, and no injection into
  pages the user never asked about — which is stricter than the old allowlist, since
  that injected into every `.gov.bb` page on load.

- **The content script had to leave the manifest, and that is a build change.**
  crxjs wraps a *declared* content script in a loader that dynamic-imports its real
  payload, and that chunk gets a generated `web_accessible_resources` entry whose
  `matches` is the third place the broad pattern appears — the mechanism decision
  0003 documented. Declaring nothing removes all three. `executeScript({ files })`
  reads extension files directly and needs no web-accessible entry, but it does
  need *one* flat file, so the content script builds in its own lib/IIFE pass
  (21.5 kB, zero imports — it only pulls in `fieldExtractor` and `toast`; faker
  lives in the background). The pass is chained off the main build's `closeBundle`
  so `pnpm build` and `pnpm dev` stay single commands. The cost is a filename
  contract: `CONTENT_SCRIPT_FILE` in the background and `fileName` in
  `vite.config.ts`, with no hashed manifest entry left to derive it from.

- **Ask before injecting.** `runFill` still messages the tab first and injects only
  on silence. That ordering used to be an optimisation for tabs that predated the
  extension; now that nothing is pre-injected it also prevents a repeat fill from
  registering a *duplicate* `chrome.runtime.onMessage` listener in the same page.
  `pollForFields` is kept, though the IIFE registers its listener synchronously
  (no dynamic import to wait for), so it is now cheap insurance rather than load-bearing.

- **"Works anywhere" makes silent failure worse, so it was fixed here.** Users will
  press Alt+Shift+F on `chrome://extensions` and the Web Store. Two checks, because
  one is not enough: `describeUnsupportedUrl` reads the tab URL up front, but Chrome
  *withholds* `tab.url` for pages the extension has no access to — a `chrome://` tab
  frequently reports none — so `describeInjectionFailure` also translates the
  `executeScript` rejection. An unknown URL deliberately returns `null` (the fill
  proceeds) rather than blocking a page we merely cannot read. `runFill` failures are
  unwrapped with `errorMessage`, so the popup shows "Form Filler can't run on this
  page — …" instead of `Error: [object Object]`. Decision 0003 listed this message as
  "possible future work"; running everywhere is what made it necessary.

- **`optional_host_permissions` was deliberately deferred.** An opt-in
  `<all_urls>` grant would restore instant pre-injected fills and reach cross-origin
  iframes, and optional permissions sit outside the broad-host review. It needs
  opt-in UI and a second code path, and `activeTab` covers the current workflow —
  recorded in 0006 as the follow-up if the first-fill delay or iframes ever bite.

## Verification

`pnpm test`: 237/237 pass — the 207 pre-existing tests unchanged (no fill logic was
touched) plus 30 new in `tests/urlSupport.test.ts` covering allowed schemes, each
blocked scheme, both Web Store hosts, unknown/absent URLs, and the injection-failure
translation.

`pnpm build` from a cleaned `dist/` is clean and emits both passes. The built
`manifest.json` confirms `version: 1.1.0`, `permissions: ["activeTab", "scripting",
"storage"]`, and **no** `host_permissions`, `content_scripts` or
`web_accessible_resources` key; `<all_urls>` appears nowhere in `dist/` at all.
`dist/content.js` is 21.5 kB with zero `import` / `__vitePreload` / `getURL`
occurrences, and its `chrome.runtime.onMessage.addListener` call sits inside the
injected IIFE body.

Manual unpacked-load checks are **not** done — they need a browser and are left to
whoever loads the build. Worth covering there, since no test exercises the built
file: a fill on a non-`.gov.bb` form, two fills on the same page (no
duplicate-listener effects), a `file://` prototype with and without the file-access
toggle, and a `chrome://` page reporting its reason in the popup.
