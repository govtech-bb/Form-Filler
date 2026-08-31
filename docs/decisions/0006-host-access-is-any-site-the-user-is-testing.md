# 0006 — Host access is `activeTab`, on any site the user is testing

Date: 2026-08-31
Status: Accepted

Supersedes
[0003 — Host access restricted to `.gov.bb` and local dev](0003-host-access-restricted-to-gov-bb-and-local-dev.md).

## Principle

Form Filler runs on **any page the user opens it on**, and asks for **no host
permissions at all** to do it. Access is `activeTab`: one tab, any origin, granted
by Chrome because the user just clicked **Fill All Fields** or pressed the
shortcut. The set of sites the tool works on is the user's decision at fill time —
neither the manifest's nor an allowlist's.

The content script is therefore **not declared in the manifest**. It is injected
programmatically, on that gesture, and only into that tab.

## Context

Decision 0003 scoped host access to `*.gov.bb` plus localhost, to clear the Chrome
Web Store's "Broad Host Permissions" review flag. That allowlist stopped matching
how the tool is used:

- Prototypes and pilots are served from Netlify, Vercel, GitHub Pages, `*.dev`
  preview URLs and ad-hoc staging hosts — none of them `.gov.bb`.
- Vendor and third-party forms a government service depends on are on the
  vendor's domain.
- Local development is not only `localhost`/`127.0.0.1`: LAN IPs, `*.local`
  hostnames, tunnels (ngrok, Cloudflare) and `file://` prototypes are all normal.

Off-allowlist the extension did nothing at all, and — as decision 0003 itself
recorded — it failed *silently*, because the toast is drawn by the very content
script that could not be injected. Every new host meant a manifest edit, a build,
and a Web Store resubmission, far too slow for a QA tool.

Nothing about the extension's behaviour was ever domain-specific. The
`.gov.bb`-flavoured parts — Barbados phone numbers, `BBxxxxx` postcodes, TAMIS
references — are *value generation*, driven by field labels, and are equally
correct on any host. The allowlist was never load-bearing for correctness.

The obvious replacement, `<all_urls>` in `host_permissions` and
`content_scripts[].matches`, would work — and would hand back exactly the review
flag decision 0003 existed to remove, plus the install-time warning "Read and
change all your data on all websites" for a tool that only ever acts on one tab
after an explicit click.

## Decision

Use `activeTab`. Permissions become `["activeTab", "scripting", "storage"]`; there
is no `host_permissions` key, no `content_scripts` key, and no
`web_accessible_resources` in the built manifest. Chrome grants `activeTab` on the
gestures this extension already uses — invoking the action (which opens the popup)
and firing a `commands` keyboard shortcut — so both entry points are covered.

`chrome.scripting.executeScript` then injects the content script into the active
tab under that grant, which is the path `ensureContentScript` already took for tabs
that predated the extension. `runFill` asks the tab for its fields *before*
injecting and injects only on silence: a second injection into a tab that already
has the script would register a duplicate `chrome.runtime.onMessage` listener.

This requires the content script to build as **one self-contained file**. crxjs
wraps a manifest-declared content script in a loader that dynamic-imports its real
payload, and that payload chunk needs a `web_accessible_resources` entry whose
`matches` reintroduces the broad pattern — the third place decision 0003 found it.
So `vite.config.ts` builds the content script in a second, chained lib/IIFE pass
(`dist/content.js`, ~21 kB, zero imports), leaving crxjs to handle the popup and
service worker. The pass is chained off the main build's `closeBundle`, so
`pnpm build` and `pnpm dev` remain single commands. `CONTENT_SCRIPT_FILE` in
`src/background/index.ts` and `fileName` in `vite.config.ts` must stay in sync;
there is no hashed manifest entry left to read the name from.

Because "works anywhere" makes users try genuinely impossible pages, report *why*
via `src/shared/urlSupport.ts`:

- `describeUnsupportedUrl` — an up-front check on the tab URL for `chrome://`,
  `devtools://`, `chrome-extension://`, `about:`, `view-source:`, `data:` and the
  Web Store.
- `describeInjectionFailure` — translates an `executeScript` rejection, the *only*
  signal available for pages whose URL Chrome withholds from the extension (a
  `chrome://` tab often reports no URL at all, so the up-front check cannot see
  it).

The popup renders the resulting message verbatim, so `runFill` failures are
unwrapped with `errorMessage` rather than stringified into `"Error: …"`.

## Consequences

- **No "Broad Host Permissions" flag.** This is the alternative the Web Store
  itself points to, so the review should be no slower than decision 0003's
  allowlist bought — while supporting every origin instead of two.
- **A smaller install prompt.** With no `host_permissions`, Chrome drops the "read
  and change all your data on all websites" warning. Access is visibly tied to the
  user's click.
- **No injection on pages the user never asked about.** Stronger than 0003's
  allowlist, which injected into every `.gov.bb` page on load.
- **The first fill on a page is slightly slower** — inject, then poll — instead of
  messaging a script that loaded with the page. Subsequent fills on the same page
  hit the fast path, since the script survives until navigation.
- **Cross-origin iframes are out of reach.** `activeTab` grants the tab's
  top-level origin, not third-party frames. The extension never passed
  `allFrames`, so no behaviour is lost, but a form inside a cross-origin iframe
  cannot be reached this way. A user-granted optional `<all_urls>` (see below)
  would be the escape hatch if that is ever needed.
- **The build has two passes, and a filename contract between them.** Renaming
  `content.js` in one place silently breaks injection; only a browser load catches
  it, since no test imports the built file.
- **`file://` pages need "Allow access to file URLs"** enabled for the extension at
  `chrome://extensions` — no extension can grant itself that.
  `describeInjectionFailure` names the toggle when a `file:` injection is refused.
- A blocked page now explains itself in the popup. Via the keyboard shortcut it
  still cannot: there is no content script to draw a toast on a page Chrome will
  not let us inject into.

## Alternatives considered

- **`<all_urls>` host permissions.** Simplest diff, no build change, and the
  content script stays pre-injected — but reinstates the review flag and the broad
  install warning, for no capability `activeTab` lacks on the paths we use.
- **`optional_host_permissions: ["<all_urls>"]`,** requested from the popup with
  `chrome.permissions.request()`. Optional permissions sit outside the broad-host
  review, and granting one would restore instant pre-injected fills and reach
  cross-origin frames. Deliberately deferred: it needs opt-in UI and a second
  code path, and `activeTab` alone covers the current workflow. This is the
  natural follow-up if the injection delay or iframes ever bite.
- **Skipping the Web Store** — Workspace force-install or a self-hosted CRX (see
  [ORG_DISTRIBUTION.md](../ORG_DISTRIBUTION.md)) avoids review entirely, but leaves
  the extension over-permissioned for anyone who does install it from the store.
