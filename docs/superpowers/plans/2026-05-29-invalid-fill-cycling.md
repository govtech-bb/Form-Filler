# Plan — Improve invalid-validation fill cycling

Date: 2026-05-29
Topic: Make the test-validation ("invalid") fill mode cycle through one meaningful violation *kind* per pass, consistently across the whole form.

## Goal

When test-validation mode is on, each press of **Fill** breaks the form in **one** way at a time, the *same* way across every field that can express it:

- Pass 1 → invalid format everywhere it applies
- Pass 2 → below the minimum length
- Pass 3 → above the maximum length
- Pass 4 → numeric/date out-of-range
- Pass 5 → empty (required fields)

Passes that no field on the page can express are skipped, so the cycle never wastes a press. A toast names the current pass (e.g. *"Pass 2 of 4: below minimum"*) so the cycle is visible.

User-visible win: predictable, demonstrable QA of a form's validation — "now watch it reject every bad format, now every too-short value," instead of today's mixed bag where each field independently picks a different violation on the same press.

## Problem with today's behaviour

`generateInvalidValue(field, step)` indexes `step` into **each field's own** `applicableViolations` list. Because fields have different applicable subsets, a single press produces a mix: a field with `minLength` goes too-short while an email goes bad-format on the very same pass. The "pass" means nothing global, and `invalidCycleStep` wrapping is per-field, not per-form.

## Approach

**Lift the cycle from per-field to per-form.** The orchestrator picks one violation *kind* per pass; the generator just expresses (or fails to express) that one kind for a given field.

1. Add `activeViolationKinds(fields)` — returns the global-order kinds that **at least one** field can express. This is the cycle the form actually has.
2. Change `generateInvalidValue` to take the **targeted kind** instead of a raw `step`. If the field can express that kind, do so; otherwise fall back to generic garbage (`!!!INVALID!!!`).
3. `runInvalidFill` resolves `targetKind = activeKinds[step % activeKinds.length]`, advances `invalidCycleStep`, and reports the named pass in the toast.

### Global order

```
invalidChars (format) → tooShort (below-min length) → tooLong (above-max length) → outOfRange (numeric/date) → empty (required)
```

(Reorders today's `VIOLATION_ORDER`, which leads with `tooShort`, to lead with `invalidChars` per the desired "format first" cycle.)

### Fallback

When the targeted kind isn't applicable to a field, emit generic garbage `!!!INVALID!!!` (chosen over "field's own first applicable violation" for simplicity — blunt but always visibly invalid). Note this means on, say, the out-of-range pass, a plain text field just gets `!!!INVALID!!!`.

### Structured types — kept outside the kind model

Checkbox, radio, select, and date-triplet parts each have exactly one invalid state and don't map onto format/length/range:

- `checkbox` → `false` (unchecked)
- `radio` → `null` (skip, leaves group unselected)
- `select` → `''` (deselected)
- `datePart` → out-of-range part (`'0'` / `'99'`)

These keep their current behaviour on **every** pass, regardless of the targeted kind. They are *not* counted when computing `activeViolationKinds` (their invalidation isn't one of the cycle kinds). Called out here so it's a deliberate decision, not an oversight: a required select stays deselected even during a "below minimum" pass — harmless, since that's its only invalid state.

## Scope

In this change:

1. Reorder `VIOLATION_ORDER` to lead with `invalidChars`.
2. Add `activeViolationKinds(fields: FieldMeta[]): ViolationKind[]` to `valueGenerator.ts`.
3. Change `generateInvalidValue` signature from `(field, step)` to `(field, kind: ViolationKind)`; keep the structured-type / `datePart` special-casing ahead of the kind logic; fall back to generic garbage when `kind` isn't in the field's applicable set.
4. Add a `violationLabel(kind): string` map for human-readable pass names ("invalid format", "below minimum", "above maximum", "out of range", "empty").
5. Update `runInvalidFill` to compute `activeKinds`, select the pass's kind, advance the step, and name the pass in both the loading and success toasts.
6. Rewrite `tests/invalidValue.test.ts` for the new signature and the new orchestration helpers.

Out of scope:

- Popup UI changes beyond what already exists (the toggle and badge stay as-is).
- Any change to the normal (valid) fill path.
- Resetting `invalidCycleStep` when the active-kinds set changes between pages — see open questions.

## Files

To modify:

- `src/shared/valueGenerator.ts` — reorder `VIOLATION_ORDER`; add `activeViolationKinds` and `violationLabel`; re-signature `generateInvalidValue`.
- `src/background/index.ts` — `runInvalidFill`: compute active kinds, pick targeted kind by step, named toasts.
- `tests/invalidValue.test.ts` — rewrite for kind-based API + `activeViolationKinds` + cycling-across-the-form.

## Verify

- `pnpm test` passes, including:
  - `activeViolationKinds` returns only expressible kinds, in global order.
  - `generateInvalidValue(field, kind)` expresses the kind when applicable, else returns generic garbage.
  - Structured types ignore the kind and keep their single invalid state.
  - A walk across passes on a mixed-field form: every field violates the *same* kind per pass; the step wraps over `activeKinds.length`.
- Manual: enable test-validation mode on a form with varied fields. Press Fill repeatedly; confirm the toast counts up ("Pass 1 of N: invalid format", …), each pass breaks fields the same way, and the cycle wraps.

## Open questions

- **Step reset on field-set change.** `invalidCycleStep` is global storage; if the active-kinds list differs between two forms, a stored step may land on a different kind than last time. Acceptable (it still resolves via `% length`), but worth deciding whether to reset the step when the active-kinds signature changes. Default: leave it; mod-wrap is harmless.
- **Generic-garbage on number/date fallback.** `!!!INVALID!!!` in a `type="number"` input is invalid (good), but some inputs reject non-numeric keystrokes outright so the field may end up empty. Confirm during implementation that the value still lands and triggers an error; if not, fall back to a numeric out-of-bounds instead for those types.
