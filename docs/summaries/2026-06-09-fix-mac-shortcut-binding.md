# Fix keyboard shortcuts not firing for macOS users

Date: 2026-06-09

## What changed

Switched the `mac` `suggested_key` for both commands in `manifest.json` from
`Command+Shift+…` to `MacCtrl+Shift+…`:

- `fill-form`: `Command+Shift+F` → `MacCtrl+Shift+F`
- `toggle-test-mode`: `Command+Shift+X` → `MacCtrl+Shift+X`

Removed the now-obsolete `applyPlatformShortcuts()` relabeling in
`src/popup/index.ts` (it rewrote the popup's "Ctrl" labels to "Cmd" on Mac),
updated `README.md`, and bumped the version `1.0.2` → `1.0.3` in both
`manifest.json` and `package.json`.

## Why it looks this way

- **`suggested_key` is a suggestion, not a guarantee.** Chrome silently leaves a
  command *unbound* when its chord collides with an existing browser/OS shortcut at
  install time. `Command+Shift+F` is a known-problematic chord on macOS Chrome, so
  Mac users got an unbound command — the popup said "Cmd+Shift+F" (the manifest's
  `mac` key and the `applyPlatformShortcuts()` relabel agreed on it) but pressing it
  did nothing. Every layer of *our* code was internally consistent and correct;
  the failure was Chrome refusing to bind the chord.

- **`MacCtrl` maps to the physical Ctrl key on Mac.** Using `MacCtrl+Shift+F`
  means Mac users press the same physical keys as Windows/Linux users
  (Ctrl+Shift+F) — matching muscle memory and the bug report ("Ctrl+Shift+F not
  working for Mac users") — while sidestepping the `Command`-chord conflict.

- **The popup relabeling had to go.** With the binding now Ctrl-based on every
  platform, the HTML's hard-coded "Ctrl" / "Cmd" labels are already correct
  everywhere. `applyPlatformShortcuts()` would have actively *mislabeled* Mac as
  "Cmd", so it was removed rather than updated. The unused `.mod-key` / `.mod-combo`
  class hooks were left in the HTML (harmless, no CSS or JS depends on them).

- **Version bumped to match repo convention.** `manifest.json` is the source of
  truth (the build reads it via `crx({ manifest })`); `package.json` is kept in
  sync per the pattern set by the 1.0.1 and 1.0.2 bumps.

## Confidence / caveat

This could not be reproduced on the Windows dev machine — Chrome's silent
non-binding only manifests on macOS. The diagnosis rests on: (a) all of our code
being correct, (b) `Command+Shift+F` being a documented troublemaker on macOS
Chrome, and (c) silent-drop-on-conflict being standard Chrome behavior. The fix
removes the conflicting chord entirely, so it holds regardless of the exact
colliding shortcut. **Final confirmation requires loading the unpacked build on a
Mac and pressing Ctrl+Shift+F.**

## Verification

200/200 tests pass, `vite build` is clean, and the built `dist/manifest.json`
confirms `version: 1.0.3` with `MacCtrl+Shift+F` / `MacCtrl+Shift+X`. The on-Mac
keypress check is the one remaining manual step.
