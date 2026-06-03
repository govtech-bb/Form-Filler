# Select Radix-style radio groups on the old alpha site

Date: 2026-06-03

## Context

The form filler selected radio options correctly on the new site but did
nothing on the old gov-bb alpha. The reported symptom was "the radio is never
selected." The old site renders radios as a Radix radio group.

## What changed

- `src/shared/fieldExtractor.ts`: `getFieldType` now classifies
  `button[role="radio"]` as a radio; a new `radioGroupMembers` helper resolves a
  group's option controls for both native (`name`-based) and Radix
  (container-based) radios; `extractFields` skips the inert proxy input and
  dedups Radix groups by their `[role="radiogroup"]`/`<fieldset>` container.
- `src/content/index.ts`: `applyValues` clicks the matching
  `button[role="radio"]` (by `value`, then label) instead of the proxy input.
- Tests: a full-pipeline behavioral test (`tests/applyValues.test.ts`) asserting
  the button is clicked and the proxy input is not, plus an extraction test
  (`tests/fieldExtractor.test.ts`) locking in one-field/two-option grouping.
- Commit `5808ce8`, merged to `main` via `62a8338`.

## Why it looks this way

Radix renders each option as a `<button role="radio">` (the real control, which
drives component state) plus an adjacent `<input type="radio">` that is
`aria-hidden`, `tabindex="-1"`, `pointer-events:none`, `opacity:0` — a *proxy*
that exists only so the value participates in native form submission. Radix
ignores events on it.

The filler only ever looked at `input`/`select`/`textarea`, so it found the
proxy and never the button. Two failures stacked, both silent:

1. The proxy input carries **no `name`**, so option-building
   (`input[type="radio"][name=""]`) matched nothing → empty `options` →
   `generateValue` returns `null` for an optionless radio → **no fill
   instruction was produced at all.** The radio was never even attempted.
2. Even with an instruction, clicking the proxy is a no-op the framework
   ignores.

So the fix had to be end-to-end, not a fill-time patch: the button has to be the
extracted element (to produce options and an instruction) *and* the click
target. A click-redirect alone would not have worked, because extraction never
got far enough to emit an instruction.

Grouping was the one real design choice. Native radios group by shared `name`;
Radix buttons share no `name`, so they're grouped by the enclosing
`[role="radiogroup"]` (what Radix puts on its Root), falling back to `<fieldset>`.
Rejected alternative: grouping by nearest common DOM ancestor of sibling buttons
— too fragile against arbitrary flex/grid wrappers. The container approach keys
off the semantic boundary Radix actually emits.

## Process note

Per user direction mid-session, the work was done on a `fix-radix-radio-selection`
branch and merged into `main` with `--no-ff`; the branch was then deleted. No
worktree was used.

## Open questions

- Grouping assumes a `[role="radiogroup"]` or `<fieldset>` ancestor. The HTML
  sample provided started one level *inside* the radiogroup, so the ancestor is
  inferred, not confirmed. If the live old-site DOM has neither, each button
  falls back to its own single-option group (multiple instructions, multiple
  clicks). Worth confirming against the real page with the built extension.
- Not yet browser-tested end to end on the live alpha site — verified via the
  test suite (198/198) and a clean `vite build` only.
