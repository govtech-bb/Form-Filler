# Plan: Work on any URL, not just `.gov.bb`

## Goal

Let Form Filler fill forms on **any** page the user opens it on — prototype hosts,
vendor forms, preview URLs, local files — instead of only `*.gov.bb` and
`localhost`/`127.0.0.1`, *without* asking for broad host permissions, and tell the
user why when a page genuinely cannot be filled.

## Background

Nothing in the fill logic is domain-aware. The only gate was the source
`manifest.json`: `host_permissions` and `content_scripts[].matches` both carried
the `.gov.bb` + local-dev allowlist added by
[decision 0003](../decisions/0003-host-access-restricted-to-gov-bb-and-local-dev.md)
to clear the Chrome Web Store's "Broad Host Permissions" flag. Off-allowlist, the
extension did nothing *and said nothing*, because the toast is drawn by the content
script that could not be injected.

Swapping the allowlist for `<all_urls>` would work and would hand the review flag
straight back, along with the "read and change all your data on all websites"
install warning — for a tool that only ever acts on one tab after an explicit
click. `activeTab` is the alternative: one tab, any origin, granted on a user
gesture. Chrome grants it for both of this extension's entry points (invoking the
action, and a `commands` shortcut).

The catch is the build. `@crxjs/vite-plugin` wraps a *manifest-declared* content
script in a loader that dynamic-imports its payload, and that chunk needs a
`web_accessible_resources` entry whose `matches` is the third place the broad
pattern appears. So the content script must not be declared in the manifest at all,
and must build as one self-contained file that
`chrome.scripting.executeScript({ files })` can inject (that API reads extension
files directly and needs no web-accessible entry).

## Steps

1. **Manifest** — `permissions: ["activeTab", "scripting", "storage"]`; remove
   `host_permissions`; remove the `content_scripts` block entirely. Version
   `1.0.4` → `1.1.0`, mirrored in `package.json`.
2. **`vite.config.ts`** — add a second, chained lib/IIFE pass emitting
   `dist/content.js` (self-contained, no imports), run from the main build's
   `closeBundle` so `pnpm build` and `pnpm dev` stay single commands.
3. **`src/background/index.ts`** — inject `CONTENT_SCRIPT_FILE` ('content.js')
   instead of reading a hashed name from `getManifest().content_scripts`; keep the
   ask-first/inject-on-silence order so a repeat fill cannot register a duplicate
   message listener.
4. **`src/shared/urlSupport.ts`** (new, pure, unit-tested)
   - `describeUnsupportedUrl(url)` → a user-facing reason, or `null` when the page
     is fillable. `null` for an unknown URL: Chrome withholds `tab.url` on pages we
     have no access to, and refusing to try would break ordinary pages.
   - `describeInjectionFailure(error, url)` → translates an `executeScript`
     rejection, the only signal for pages whose URL Chrome hides. Names the
     "Allow access to file URLs" toggle for `file:` URLs.
5. **Background wiring** — check the URL up front in `runFill(tabId, url)`; pass
   `tab.url` from both entry points; unwrap errors with `errorMessage` so the popup
   shows the message, not `"Error: …"`.
6. **Docs** — decision 0006, 0003 marked superseded, README/PRIVACY/
   ORG_DISTRIBUTION permission wording corrected.

## Verification

- `pnpm test` — the existing suite plus `tests/urlSupport.test.ts`.
- `pnpm build` from a clean `dist/`, then confirm the built `manifest.json` has
  `permissions: ["activeTab", "scripting", "storage"]` and **no**
  `host_permissions`, `content_scripts` or `web_accessible_resources` key; that
  `dist/content.js` exists and contains no `import`/`__vitePreload`/`getURL`; and
  that `<all_urls>` appears nowhere in `dist/`.
- Manual unpacked load: fill a non-`.gov.bb` form; fill twice on one page (no
  duplicate-listener effects); confirm a `chrome://` page reports a reason in the
  popup instead of failing silently.

## Out of scope

- `optional_host_permissions` with a popup opt-in to restore pre-injected fills and
  reach cross-origin iframes — noted as the follow-up in decision 0006.
- Any per-site allowlist/blocklist UI.
- Surfacing the blocked-page reason for the keyboard shortcut — impossible on a
  page Chrome will not let us inject into.
- Changing value generation: the Barbados-flavoured values are label-driven and
  stay as they are on every host.
