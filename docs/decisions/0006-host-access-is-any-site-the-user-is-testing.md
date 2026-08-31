# 0006 — Host access is any site the user is testing

Date: 2026-08-31
Status: Accepted

Supersedes
[0003 — Host access restricted to `.gov.bb` and local dev](0003-host-access-restricted-to-gov-bb-and-local-dev.md).

## Principle

Form Filler runs on **any page the user opens it on**. Host access is
`<all_urls>` in both `host_permissions` and `content_scripts[].matches`. The set
of sites the tool works on is a decision the user makes at fill time, not one the
manifest makes for them.

## Context

Decision 0003 scoped host access to `*.gov.bb` plus localhost, to clear the
Chrome Web Store's "Broad Host Permissions" review flag. That allowlist stopped
matching how the tool is actually used:

- Prototypes and pilots are served from Netlify, Vercel, GitHub Pages, `*.dev`
  preview URLs and ad-hoc staging hosts — none of them `.gov.bb`.
- Vendor and third-party forms a government service depends on are on the
  vendor's domain.
- Local development is not only `localhost`/`127.0.0.1`: LAN IPs, `*.local`
  hostnames, tunnels (ngrok, Cloudflare) and `file://` prototypes are all normal.

Off-allowlist the extension did nothing at all, and — as decision 0003 itself
recorded — it failed *silently*, because the toast is drawn by the very content
script that could not be injected. Every new host meant a manifest edit, a build,
and a Web Store resubmission, which is far too slow for a QA tool.

Nothing about the extension's behaviour was ever domain-specific. The content
script is reactive: on load it registers a `chrome.runtime.onMessage` listener and
does nothing until a user gesture (popup button or keyboard command) reaches it.
The `.gov.bb`-flavoured parts — Barbados phone numbers, `BBxxxxx` postcodes, TAMIS
references — are *value generation*, driven by field labels, and they are equally
correct on any host. The allowlist was never load-bearing for correctness.

## Decision

Request `<all_urls>` in `host_permissions` and `content_scripts[].matches`. crxjs
mirrors the matches onto the generated `web_accessible_resources`, so the
content script's dynamic-import chunk is reachable from every origin too — which
is required, or the `ensureContentScript` injection fallback would load a loader
that cannot import its own payload.

`activeTab` is deliberately **not** re-added. Decision 0003 dropped it as
redundant once `host_permissions` authorised `chrome.scripting.executeScript`, and
that reasoning holds for `<all_urls>`: permissions stay `["scripting", "storage"]`.

Because "works anywhere" makes users try genuinely impossible pages, add
`src/shared/urlSupport.ts` and report *why* a page cannot be filled:

- `describeUnsupportedUrl` — an up-front check on the tab URL for `chrome://`,
  `devtools://`, `chrome-extension://`, `about:`, `view-source:`, `data:` and the
  Web Store.
- `describeInjectionFailure` — translates an `executeScript` rejection, which is
  the *only* signal available for pages whose URL Chrome withholds from the
  extension (a `chrome://` tab often reports no URL at all, so the up-front check
  cannot see it).

The popup renders the resulting message verbatim, so `runFill` failures are
unwrapped with `errorMessage` instead of being stringified into `"Error: …"`.

## Consequences

- **The Chrome Web Store "Broad Host Permissions" flag returns.** This is now an
  accepted cost, not an oversight: the tool's purpose *is* to fill forms on
  arbitrary test sites, so the permission is justifiable in the review's
  single-purpose narrative. Expect a slower review than a scoped allowlist gets.
  Justification to submit: "The extension fills form fields with fake test data on
  whichever page the tester is testing; that page can be any origin, so the host
  set cannot be enumerated in advance."
- The content script now injects on every page the user visits, not only on
  allowlisted ones. It still only registers a message listener and acts after a
  user gesture, and it still makes no network requests (decision 0001).
- A blocked page now explains itself in the popup. Via the keyboard shortcut it
  still cannot: there is no content script to draw a toast on a page Chrome will
  not let us inject into. The popup is the place that reports the reason.
- `file://` pages work only if the user enables "Allow access to file URLs" for
  the extension at `chrome://extensions`. `describeInjectionFailure` names that
  toggle when a `file:` injection is refused.
- Any future host-access change must still be verified in the built
  `dist/manifest.json`, including the generated `web_accessible_resources` — the
  mechanism decision 0003 documented remains true.
