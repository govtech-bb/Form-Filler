# Drop the AI fallback; lean on faker with smarter routing

Date: 2026-05-30
Plan: [docs/superpowers/plans/2026-05-29-drop-ai-faker-routing.md](../superpowers/plans/2026-05-29-drop-ai-faker-routing.md)

## What changed

The extension no longer calls the Claude API or needs an API key. Every field is
filled by local, deterministic faker logic. Unmatched free-text fields now get a
sensible faker value from their label, and the absolute fallback is built from words
(never lorem sentences), so it carries no full stops.

## Why it looks this way

This session started by asking whether the AI key was earning its place. Tracing the
flow showed AI only fired for fields where `generateValue` returned null (unmatched
free-text / unsatisfiable patterns), and whatever it didn't return already fell
through to `generateGenericText`. On the target gov-bb forms — minimal DOM, no
`pattern` attributes — AI couldn't use the one thing it was prompted to respect, and
most fields were already covered locally. Verdict: marginal value, real costs (key
setup, a key sitting in `chrome.storage.sync`, latency, a label-only cache, and it
wasn't even wired into the error-correction loop where adherence matters).

A brief detour considered a shared/bundled key behind Chrome Web Store domain
restriction. Rejected: a bundled key is extractable by any installer, so it would
trust the whole org with the Anthropic bill to power a marginal feature. We chose to
remove AI instead.

Key decisions:

- **faker stays; the gap was routing, not the engine.** faker is already integrated
  everywhere and is the most comprehensive JS option, so no library swap. Instead we
  widened `RULES` (title/salutation, marital status, relationship, religion, colour,
  vehicle make/model, "number of…", profession) and added a long-form heuristic so
  prompts like "describe/explain/reason" get a longer phrase.
- **Generic fallback is period-free by construction.** Rebuilt `generateGenericText`
  and the min-length padding on `faker.lorem.words()` rather than `.sentence()`, so a
  full stop can't appear — periods both look like filler and trip "letters only"
  charset validators. The prose rules (bio/message/description/subject) keep their
  natural periods, since those fields rarely carry charset restrictions.
- **Generic name rule emits `firstName + lastName`, not `fullName()`.** `fullName()`
  can append a suffix with a period ("Jr."), which would fail name charset rules and
  made a test flaky. first+last is deterministically period-free.

## Cleanup

Full AI removal: `getAiValues`, the AI block in `runFill`, the `SAVE_API_KEY` /
`CLEAR_AI_CACHE` handlers and the `ai_cache_*` storage, `claudeApiKey` / `aiFieldCount`
from types/results, the `(N via AI)` toast, the popup key/cache UI (and its dead CSS),
and the `api.anthropic.com` host permission. A manual Ctrl+Shift+X shortcut-display
that had been added to the popup was preserved.

## Verification

- Full suite 167/167 green (added 9 rule tests + a no-full-stops test; updated
  `generateGenericText` expectations).
- `vite build` clean; `dist` and `src` confirmed free of `anthropic` / `ai_cache` /
  `claudeApiKey` references; popup bundle shrank (~6.1 → 4.6 kB).
- Still worth a manual glance in-browser: the settings view renders correctly with the
  key UI gone, and a fill on a mixed form leaves no field blank or full-stopped.

## Not done (out of scope)

The README / Chrome-Web-Store packaging instructions belonged to the abandoned
bundled-key direction, so they are not part of this change.
