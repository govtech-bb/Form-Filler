# Fix: split day/month/year date detection on the alpha site

## Goal

The form filler fills split date inputs (separate Day / Month / Year boxes)
correctly on the GovBB alpha site and similar forms. Today the three parts are
filled wrongly or skipped because the triplet is never recognized.

## Root cause

Date-triplet detection already exists in `preprocessDateTriplets`
(`src/shared/fieldExtractor.ts`), but its candidate pool is limited to
`input[type="number"]`:

```ts
doc.querySelectorAll<HTMLInputElement>('input[type="number"]')
```

The alpha site renders its day/month/year boxes as **`type="text"` with
`inputmode="numeric"`**, e.g.:

```html
<label for="applicant.dateOfBirth-day">Day</label>
<div class="relative inline-flex ...">
  <input id="applicant.dateOfBirth-day" inputmode="numeric" type="text"
         name="applicant.dateOfBirth[day]" value="12">
</div>
```

Because these are not `type="number"`, they never enter the candidate pool, the
triplet is never grouped, and each box falls through to generic text handling
(or is skipped). Everything downstream already works once the inputs are in the
pool:

- `findDatePartLabel` resolves "Day"/"Month"/"Year" via the `label[for=id]`
  association the alpha markup provides. ✓
- The ancestor-walk that groups the three parts into one `dateGroupId` works on
  any container. ✓
- `generateValue` emits a coherent shared date per `dateGroupId`. ✓
- `applyValues` writes text inputs via the native setter + input/change events. ✓

## Approach

Broaden the candidate-input selector in `preprocessDateTriplets` to include
number inputs, text inputs, and anything with `inputmode="numeric"`. The two
selectors inside the function (the initial scan and the ancestor-walk lookup for
month/year) must use the **same** broadened set.

`findDatePartLabel` already filters candidates to exactly "day"/"month"/"year"
labels, and grouping requires all three co-located in a shared ancestor — so
broadening the pool cannot produce false positives in practice (a form would
need three unrelated text fields literally labelled Day/Month/Year inside one
container). This makes the broad net the safest *and* most general option:
it covers the alpha site (`text` + `inputmode="numeric"`) and any plain-text
day/month/year variant with no `inputmode`.

**Alternatives considered:**

- *Narrow to `inputmode="numeric"` only* — would fix the alpha site but miss
  plain-text split dates. Rejected: the co-location guard means the broad net
  has no real downside.
- *Detect by `name` pattern (`[day]`/`[month]`/`[year]`)* — more fragile across
  sites and unnecessary, since label detection already succeeds here.

No padding change: the emitted parts stay unpadded (`String(date.getUTCDate())`
→ `"5"`, not `"05"`). The alpha form does not expect zero-padding.

## Scope

- Extract the candidate-input selector into a single constant/helper so both
  query sites in `preprocessDateTriplets` use the identical broadened set:
  `input[type="number"], input[type="text"], input[type="tel"], input:not([type]), input[inputmode="numeric"]`.
- Apply it to the initial candidate scan and the ancestor-walk month/year lookup.
- Add a regression test mirroring the alpha markup.

## Files

- **Modify:** `src/shared/fieldExtractor.ts` — broaden the selector in
  `preprocessDateTriplets`.
- **Modify:** `tests/fieldExtractor.test.ts` — add the alpha-markup regression
  test.

## Verify

- New test: a Day/Month/Year triplet built from `type="text"` +
  `inputmode="numeric"` inputs with `label[for]` associations (alpha markup) is
  tagged with `datePart` day/month/year and a shared `dateGroupId`.
- Existing triplet tests (number inputs, fieldset, sibling-label) still pass.
- A lone text input labelled "Day" with no Month/Year sibling is **not** tagged
  (co-location guard holds).
- `npm test` green.

## Open questions

- None blocking. If a future form requires zero-padded parts, revisit
  `generateValue`'s date branch — out of scope here.
