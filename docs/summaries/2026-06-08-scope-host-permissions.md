# Scope host access to `.gov.bb` + local dev (CWS — Broad Host Permissions)

Date: 2026-06-08
Plan: [docs/plans/scope-host-permissions.md](../plans/scope-host-permissions.md)
Decision: [docs/decisions/0003-host-access-restricted-to-gov-bb-and-local-dev.md](../decisions/0003-host-access-restricted-to-gov-bb-and-local-dev.md)

## What changed

In source `manifest.json`: replaced the content script's `["<all_urls>"]` matches
with an explicit allowlist, added a matching `host_permissions`, dropped
`activeTab` from `permissions` (now `["scripting", "storage"]`), and bumped the
version `1.0.1` → `1.0.2` (also in `package.json`). Allowlist:

```
https://*.gov.bb/*
http://localhost/*   https://localhost/*
http://127.0.0.1/*   https://127.0.0.1/*
```

## Why it looks this way

- **Two manifest fields were flagged, not one.** The build uses
  `@crxjs/vite-plugin`, which propagates the content script's match patterns into
  the built `dist/manifest.json` in *two* places: `content_scripts[].matches` and
  the auto-generated `web_accessible_resources[].matches` (the dynamic-import
  chunk). Both came out `<all_urls>`. Narrowing the single source pattern fixes
  both — crxjs mirrors the matches onto the generated WAR. Confirmed in the build
  output.

- **Allowlist over broad-then-appeal.** The extension is a QA tool for Barbados
  government service forms; it has no reason to run on arbitrary sites. An explicit
  allowlist is faster and less ambiguous to review than justifying `<all_urls>`.
  `https://*.gov.bb/*` is one pattern covering `gov.bb` and every subdomain
  (`alpha.gov.bb`, `staging.alpha.gov.bb`) and path. Chrome match patterns ignore
  the port, so `http://localhost/*` covers `:3000`, `:8000`, etc.; the `https`
  and `127.0.0.1` variants were added per the dev-testing requirement.

- **`activeTab` dropped as redundant.** It existed only to grant
  `chrome.scripting.executeScript` temporary host access on a user gesture (the
  `ensureContentScript` fallback for tabs open before injection). The new
  `host_permissions` allowlist authorizes that same `executeScript` on exactly the
  supported hosts, so `activeTab` adds nothing. This supersedes the
  `remove-tabs-permission` session's reasoning, which kept it. Recorded as
  decision 0003.

- **Behaviour-neutral on supported sites.** The content script is purely reactive
  — on load it only registers a `chrome.runtime.onMessage` listener and acts after
  a user gesture. Scoping *where* it injects changes nothing on `.gov.bb`/localhost.
  Off-allowlist, fills no longer work (expected); a clearer "unsupported site"
  message is noted as possible future work, out of scope here.

- **Version bump is packaging, not features.** The Web Store refuses a re-upload at
  an existing version, so `1.0.1` → `1.0.2`. `manifest.json` is the source of truth
  (`crx({ manifest })`); `package.json` bumped to match.

## Verification

200/200 tests pass (unchanged — no logic touched) and `pnpm build` is clean. The
built `dist/manifest.json` confirms: `permissions: ["scripting", "storage"]`,
`host_permissions` and both `content_scripts[].matches` and the generated
`web_accessible_resources[].matches` equal to the allowlist, `version: 1.0.2`, and
**zero** occurrences of `<all_urls>`. Manual unpacked-load check on a `.gov.bb`
page and `http://localhost:3000` (popup fill + Ctrl+Shift+F) is left to the
resubmission step.
