# Improve the invalid-validation fill cycling

Date: 2026-05-29

## What changed

Test-validation ("invalid") fill mode now breaks the form **one violation kind at a
time, form-wide**. Each press of Fill targets a single kind across every applicable
field, walking a global order and skipping kinds no field can express:

```
invalid format → below minimum (length) → above maximum (length) → out of range (numeric/date) → empty (required)
```

The toast names the pass — e.g. *"pass 2 of 4: below minimum"* — so the cycle is
visible while testing a form's validators.

## Why it looks this way

The old mode indexed the cycle step into **each field's own** applicable-violation
list. Because fields have different applicable subsets, a single press produced a
mix — one field went too-short while an email went bad-format on the same pass — and
the "pass" number meant nothing across the form. The request was to make a pass mean
one thing everywhere.

Key decisions made during planning:

- **Cycle lifted from per-field to per-form.** A new `activeViolationKinds(fields)`
  computes the form's real cycle (the global-order kinds at least one field can
  express); `invalidCycleStep` now indexes into *that*, so no press is wasted on a
  kind nothing can express. `generateInvalidValue` was re-signatured from
  `(field, step)` to `(field, kind)` — the orchestrator owns the cycle, the
  generator just expresses one kind.
- **Generic-garbage fallback over field-specific.** When a field can't express the
  pass's targeted kind (e.g. an above-max pass hitting a field with no max), it emits
  `!!!INVALID!!!` rather than falling back to its own first applicable violation.
  Chosen for simplicity — blunt but always visibly invalid, and keeps every field
  participating in every pass.
- **Structured types sit outside the cycle.** Checkbox / radio / select and
  date-triplet parts each have exactly one invalid state (uncheck / skip / deselect /
  out-of-range part) that doesn't map onto format/length/range. They keep that single
  invalid state on every pass and are excluded from `activeViolationKinds`, so they
  neither add nor gate a pass. This was made an explicit decision, not an oversight:
  a required select stays deselected even on a "below minimum" pass — harmless, since
  that's its only invalid state.
- **`VIOLATION_ORDER` reordered** to lead with `invalidChars`, matching the desired
  "format first" cycle.

## Open follow-up

`invalidCycleStep` is not reset when the field set changes between forms — `% length`
makes a stale step harmless, so this was left as-is by choice.

Generic garbage (`!!!INVALID!!!`) only reaches a `type="number"` input on an
out-of-range pass when that field has no min/max bound. Not yet verified on a live
form that the value lands and triggers an error rather than being silently rejected by
the input — flagged for manual verification.

## Verification

- Full suite 149/149 green, including the rewritten `tests/invalidValue.test.ts`
  (kind-expression, generic-garbage fallback, structured-type handling,
  `activeViolationKinds`, cross-form pass walk).
- `vite build` clean.
- Not yet exercised in the live extension (toast + Chrome storage cycling) — no
  browser test harness in this repo.
