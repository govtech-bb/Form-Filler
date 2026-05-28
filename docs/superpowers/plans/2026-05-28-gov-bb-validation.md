# Plan — Train form-filler on gov-bb form validations

Date: 2026-05-28
Topic: Make the form-filler generate values that pass validation on gov.bb forms (https://github.com/govtech-bb/gov-bb) on the first try.

## Goal

When the user runs the extension on a gov-bb forms-app page, every supported field should be filled with a value that satisfies the form's server-side validations without needing the AI fallback and without waiting for the error-feedback round-trip.

User-visible win: open a gov-bb form, hit fill, submit — no validation errors on the first attempt for the in-scope fields.

## Approach

**Hardcode gov-bb-specific knowledge into the existing rules / extractor / generator pipeline.** No new infrastructure, no domain gating, no schema fetch. Rationale chosen during discussion:

- gov-bb forms render via TanStack Form. Schema validations (`pattern`, `minLength`, etc.) are **not** present on the DOM — inputs only carry `type`, `name`, `id`, `disabled`, `placeholder`. So the existing strategy of "read HTML attributes" cannot recover the validations; the extension must already know them.
- Hints (`<p data-hint>`) and rendered error messages ARE in the DOM, and the form-filler's existing hint extractor (`generateFromHintExample`) already converts `"for example, BB17004"` → `BB#####`. We piggyback on this where possible instead of duplicating rules.

### Alternatives considered

- **Country-profile registry (`profiles/barbados.ts`)** — abstractly cleaner but premature without a second country. Rejected.
- **Live schema fetch** — fetch `/api/forms/:id` and drive generation from the schema's actual `validations`. Heavier (CORS, formId detection, opt-in setting), parked for a future phase.

## Scope

In this change:

1. **Day/Month/Year date triplet** — detect and handle gov-bb's split date layout (`<fieldset data-date-field>` containing three `<input type="number">` boxes labeled Day / Month / Year). Generate one coherent past date and split its parts across the three inputs.
2. **National ID rule** — replace the current 9-digit numeric output with the BB shape `^\d{6}-\d{4}$` (e.g. `850101-0001`).
3. **National Insurance rule (new)** — label match `/national[\s\-_]?insurance/`, `/\bnis\b/`. Emit `^[A-Z]{2}\d{6}[A-Z]$` (e.g. `AB123456C`).
4. **TAMIS number rule (new)** — label match `/\btamis\b/`. Emit numeric.
5. **Tests** for each of the above.

Out of scope:

- Postcode rule changes — the gov-bb hint `"Enter a valid postcode (for example, BB17004)"` already drives `generateFromHintExample` to a valid `BB#####`. No code change needed.
- Phone rule changes — when the gov-bb pattern is **not** in the DOM, faker output is filled and the server rejects it; the existing validation-error feedback loop (which already extracts the "for example, …" from error messages) recovers on the second pass. Acceptable for this phase; revisit if it's slow in practice.
- Schema fetch / API integration (Phase 2 if needed).
- Domain gating — rules are always-on per the discussion.

## Design notes

### Date-triplet plumbing

The three Day / Month / Year inputs need values from the **same** generated date. The current pipeline calls `generateValue(field)` independently per field, so we need shared context across the three calls.

Chosen approach: pass an optional `dateGroupCache: Map<string, Date>` through `generateValue` (or wrap the batch call). The triplet detector tags each field with `datePart` and `dateGroupId` (the parent fieldset's `data-ff-uid` is a natural key). The generator looks up or creates a `Date` for that group, then returns the relevant part.

### Type additions

`FieldMeta` gains two optional fields:

```ts
datePart?: 'day' | 'month' | 'year';
dateGroupId?: string;  // shared across the three triplet fields
```

### Detection heuristic

A field is a date-triplet member when:

1. Its closest ancestor `<fieldset>` has the `data-date-field` attribute, OR
2. (Fallback) the input is `type="number"` with `min=1 max=31` (day), `min=1 max=12` (month), or sits next to a sibling `<label>` whose text is exactly `Day`/`Month`/`Year`.

Use (1) when present, (2) only as a heuristic fallback so we don't misfire on non-gov-bb pages.

## Files

To modify:

- `src/shared/types.ts` — add `datePart`, `dateGroupId` to `FieldMeta`.
- `src/shared/fieldExtractor.ts` — date-triplet detection; tag the three children, share a group id.
- `src/shared/valueGenerator.ts` — date-triplet handler; consume `datePart`/`dateGroupId`; introduce per-batch date cache.
- `src/shared/rules.ts` — update national-id rule output; add national-insurance and TAMIS rules.
- `src/background/index.ts` (or wherever `generateValue` is invoked in a loop) — thread the per-batch date cache through.
- `tests/fieldExtractor.test.ts` — triplet extraction test.
- `tests/valueGenerator.test.ts` (or `rules.test.ts`) — new rules + triplet generation tests.

## Verify

- `pnpm test` (or the project's test command) passes, including the new cases.
- Manual: load the unpacked extension on a gov-bb forms-app page (a "Date of birth" form is sufficient — every form has one). Confirm:
  - All three Day/Month/Year boxes receive numbers from the same past date.
  - National ID, NIS, TAMIS, postcode fields fill with shapes that pass validation on submit.
- Manual regression: open a non-gov-bb form with a single `<input type="date">` and a national-id-like field; confirm nothing changed.

## Open questions

- Should the date-triplet detector also produce the synthetic top-level "field" (the `<fieldset>` itself) for UI affordance, or only tag the three children? Default: only the children — keeps the extractor surface unchanged.
- For the per-batch date cache: where to scope the cache lifetime? Simplest is a fresh map per `EXTRACT_FIELDS` → `APPLY_VALUES` cycle. Confirm during implementation.
- Confirm a concrete gov-bb URL to verify against (sandbox/staging). The plan can ship without this, but the verify step needs a target.
