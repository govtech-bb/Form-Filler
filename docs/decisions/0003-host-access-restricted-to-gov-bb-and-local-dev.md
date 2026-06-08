# 0003 — Host access restricted to `.gov.bb` and local dev

Date: 2026-06-08
Status: Accepted

## Principle

The extension's host access is deliberately scoped to an explicit allowlist:
Barbados government domains (`*.gov.bb`, all subdomains and paths) plus local
development origins (`localhost` and `127.0.0.1`, http and https). New features
must **not** broaden host access to `<all_urls>` or to unrelated domains. If
another origin genuinely needs support, it is added to the allowlist explicitly,
in both `host_permissions` and `content_scripts[].matches`.

## Context

The extension is built with `@crxjs/vite-plugin`, which reads the source
`manifest.json` and propagates the content script's match patterns into the built
manifest in two places: `content_scripts[].matches` and the auto-generated
`web_accessible_resources[].matches`. The source originally declared
`"matches": ["<all_urls>"]`, so both ended up `<all_urls>` in the build.

The Chrome Web Store flagged this as "Broad Host Permissions," which slows or
blocks review. The extension is an internal QA tool for filling Barbados
government service forms; it has no reason to run on arbitrary sites. The content
script is purely reactive (registers a message listener on load, acts only after a
user gesture), so scoping where it injects changes no behaviour on supported sites.

## Decision

Replace `<all_urls>` with the explicit allowlist in the source `manifest.json`
(`host_permissions` + `content_scripts[].matches`); crxjs mirrors it onto the
generated web-accessible-resource. Drop the `activeTab` permission: it existed only
to grant `chrome.scripting.executeScript` temporary host access on a user gesture,
and the new `host_permissions` allowlist authorizes that same `ensureContentScript`
fallback on exactly the supported hosts. This supersedes the
`remove-tabs-permission` plan's reasoning, which kept `activeTab`.

## Consequences

- Clears the Web Store "Broad Host Permissions" flag without an appeal.
- The extension no longer injects or fills on sites outside the allowlist. The
  popup still opens everywhere, but a fill attempt off-allowlist fails silently
  (the content script can't be injected). A clearer "unsupported site" message is
  possible future work, not part of this decision.
- Adding support for a new origin is now a deliberate, reviewable allowlist edit —
  the default is "scoped," never "broad."
- Any host-access change must keep the source `manifest.json` and the built
  `dist/manifest.json` (incl. the generated `web_accessible_resources`) in sync;
  verify the build output, not just the source.
