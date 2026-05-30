# Plan — Drop AI, lean on faker with smarter routing

Date: 2026-05-29
Topic: Remove the Claude AI fallback entirely and replace its niche (unmatched free-text fields) with better label→faker routing plus a period-free filler fallback.

## Goal

The extension fills every field with local, deterministic fake data — no API key, no network call, no per-user setup. Unmatched free-text fields get a sensible faker value chosen from their label, and only truly unroutable fields fall back to plain word filler (never lorem sentences with full stops).

User-visible win: no key to paste, no "via AI" latency, and unmatched fields stop receiving absurd lorem sentences (`"Defetiscor cariosus velum via."`) that look fake and trip charset validators.

## Approach

AI was only ever reached for fields where `generateValue` returned null (unmatched free-text, or unsatisfiable patterns), and whatever it didn't return already fell through to `generateGenericText`. We established its value is marginal on the target forms. So: delete the AI path and strengthen the two local layers it sat on top of.

1. **Expand `RULES`** with more common form labels (deterministic label→faker).
2. **Add a keyword-routing layer** for text fields that no rule matched: inspect the label/hint to pick a faker category (e.g. long-form prompts → a short phrase; otherwise → a few words) before resorting to bare filler.
3. **Rebuild the absolute fallback** on `faker.lorem.words(n)` — no capitalization, no periods — padded to meet any minimum length.

### Alternatives considered

- **Swap faker for another lib** (chance.js, casual, `@ngneat/falso`). Rejected — faker is already integrated everywhere and is the most comprehensive; the gap was routing, not the engine.
- **Keep AI behind a proxy / bundled key.** Rejected this session — marginal value on the target forms, and a bundled key is extractable by any installer.

## Scope

**Remove AI (full cleanup):**

- `getAiValues` and the AI block in `runFill` — replace with the local fallback directly.
- `SAVE_API_KEY` and `CLEAR_AI_CACHE` message handlers; the `ai_cache_*` local storage.
- `claudeApiKey` and `aiFieldCount` from `StoredSettings` / `FillResult`; the `SAVE_API_KEY` / `CLEAR_AI_CACHE` message types.
- Popup: API-key input, key status, save-key, and clear-cache UI + handlers.
- `manifest.json`: drop the `https://api.anthropic.com/*` host permission.
- Toast: drop the `(N via AI)` suffix.

**Improve routing:**

- Add rule patterns for common labels not yet covered (candidates — refine in implementation): title/salutation, marital status, relationship, occupation/profession, reason/purpose, "number of…/how many" (→ number), religion, colour, make/model. Prose-y prompts (describe/explain/details/comment/why) → short phrase.
- New keyword-routing step inside the text fallback: choose phrase length / category from label+hint before bare filler.

**Period-free fallback:**

- Rewrite `generateGenericText` (and the min-length padding helper `loremAtLeast`) to use `faker.lorem.words(n)` — no periods — while still honouring `minLength`/hint minimums and `maxLength`.
- `bio`, `message`/`comment`/`notes`, `description`, `subject` rules keep their natural prose (periods allowed).

## Files

- `src/background/index.ts` — remove AI; route unmatched fields straight to the local fallback.
- `src/shared/types.ts` — drop AI-related settings/result fields and message types.
- `src/shared/rules.ts` — new rule patterns; possibly export a routing helper.
- `src/shared/valueGenerator.ts` — keyword-routing layer; period-free fallback + padding.
- `src/popup/index.html`, `src/popup/index.ts` — remove key/cache UI and handlers.
- `manifest.json` — remove the Anthropic host permission.
- `tests/valueGenerator.test.ts` — update `generateGenericText` expectations (word-based, no periods).
- `tests/rules.test.ts` — tests for new rule patterns.
- New `tests/genericText.test.ts` (or extend existing) — assert no periods + min-length honoured.

## Verify

- `pnpm test` green, including updated/added cases:
  - `generateGenericText` output contains no `.` and meets `minLength`/hint minimums, respects `maxLength`.
  - New rules map their labels to non-null faker values.
  - Keyword routing picks the intended category for sample labels.
- `vite build` clean; no remaining references to `claudeApiKey`, `getAiValues`, `ai_cache_`, or `anthropic`.
- Manual: load the extension; settings panel no longer shows a key field; fill a form with a mix of matched and unmatched fields and confirm unmatched ones get word-based values without full stops.

## Open questions

- Exact final rule set and routing keywords — proposed list above; settle concrete patterns during implementation against real gov-bb labels.
- Whether to keep the popup "settings" view at all once the key UI is gone, or collapse it (the test-mode toggle still lives there) — default: keep the view, just remove the key/cache controls.
