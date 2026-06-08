# Remove unused `tabs` permission (CWS rejection — Purple Potassium)

Date: 2026-06-08
Plan: [docs/plans/remove-tabs-permission.md](../plans/remove-tabs-permission.md)

## What changed

Dropped `"tabs"` from `manifest.json`'s `permissions` (now
`["activeTab", "scripting", "storage"]`) and bumped the version `1.0.0` → `1.0.1`
in both `manifest.json` and `package.json`.

## Why it looks this way

- **The Web Store was right — `tabs` was dead weight.** v1.0.0 was rejected under
  the "Use of Permissions" policy (violation ref *Purple Potassium*). The `tabs`
  permission *only* gates the `url`, `pendingUrl`, `title`, and `favIconUrl`
  properties of `Tab` objects. Tracing every `chrome.tabs` call in
  `src/background/index.ts`: `sendMessage(...)` never needs it, and the three
  `tabs.query({ active: true, currentWindow: true })` calls only read `tab.id`,
  which is ungated. Nothing touched a `tabs`-gated property, so removal is
  behaviour-neutral — no code changed.

- **The other three permissions stay because they're load-bearing.** `activeTab`
  grants `chrome.scripting.executeScript` temporary host access to the current tab
  when the user invokes the extension (popup click or keyboard command) — that's
  how `ensureContentScript` injects into tabs open before the extension loaded.
  `scripting` is the API itself; `storage` backs `chrome.storage.local`. Removing
  any of these would break a real path.

- **Version bumped for resubmission, not for features.** The Web Store refuses a
  re-upload at an existing version number, so `1.0.0` → `1.0.1` is purely a
  packaging requirement. `manifest.json` is the source of truth (the build reads it
  via `crx({ manifest })`); `package.json` was bumped to match.

## Verification

200/200 tests pass (unchanged — no logic touched), `pnpm build` is clean, and the
built `dist/manifest.json` confirms `version: 1.0.1` with exactly the three
remaining permissions. Manual unpacked-load check (popup fill + Ctrl+Shift+F) is
left to the resubmission step; it cannot regress, since no `tabs`-gated property
was ever read.
