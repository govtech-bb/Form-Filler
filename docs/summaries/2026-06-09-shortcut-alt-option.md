# Move shortcuts to Alt/Option+Shift and show both OSs in the UI

Date: 2026-06-09
Supersedes: [2026-06-09-fix-mac-shortcut-binding.md](2026-06-09-fix-mac-shortcut-binding.md)
(the `MacCtrl+Shift+F` binding from that change never shipped — 1.0.3 was unreleased)

## What changed

- **`manifest.json`** — both commands now bind `Alt+Shift+…` on every platform:
  - `fill-form`: `Alt+Shift+F`
  - `toggle-test-mode`: `Alt+Shift+X`
  - `default` and `mac` are identical. In Chrome's command syntax `Alt` *is* the
    **Option (⌥)** key on macOS, so `Alt+Shift+F` is triggered by Option+Shift+F
    there and displays as ⌥⇧F in `chrome://extensions/shortcuts`.
- **`src/popup/index.html`** — the popup now shows both OS bindings explicitly
  rather than detecting the platform: the main-view hint reads
  "Alt+Shift+F · ⌥ Option+Shift+F on macOS", and the Settings view lists a
  "Windows / Linux" row and a "macOS" row for each command. Added `.shortcut-row`,
  `.os-tag`, and `.hint-os` styles (all ≥13px, matching the file's accessibility note).
- **`README.md`** — usage lines updated to the Alt/Option keys for both OSs.

Version stays at **1.0.3** (unreleased), so no re-bump.

## Why it looks this way

- **Alt/Option avoids the macOS Command-chord conflict entirely.** The original
  `Command+Shift+F` was silently dropped by Chrome on Mac (conflicting chord).
  `Alt+Shift+…` is a conventional, conflict-free chord for Chrome extension
  commands and works the same on Windows, Linux, and macOS.
- **Both modifiers map cleanly across platforms with a single value.** Because
  `Alt` resolves to Option on macOS, one `Alt+Shift+…` binding covers all
  platforms — no per-OS manifest divergence and no popup JS needed.
- **UI shows both OSs by request.** The user asked for the commands to be visible
  for both Windows and macOS, so the popup lists them statically rather than
  relabeling based on `navigator.platform` (which the prior change had removed).

## Verification

200/200 tests pass, `vite build` is clean, and the built `dist/manifest.json`
confirms `Alt+Shift+F` / `Alt+Shift+X`. On-Mac confirmation (press Option+Shift+F
on a fresh install) is the one remaining manual step — Chrome only re-reads
`suggested_key` defaults on install/update, so existing installs may need an
extension reload.
