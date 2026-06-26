# 0004 — Validated fields use the real validator, not a shape regex

Date: 2026-06-26
Status: Accepted

## Principle

When a gov.bb field is checked by a known validation library, valid-fill mode must
generate values that satisfy **that same library and metadata** — not a regex that
merely reproduces the value's shape. A value that matches the format but the real
validator rejects is a defect: it silently blocks the fill, which is the exact
failure valid-fill mode exists to avoid.

## Context

The phone rule emitted `1-246-Xnn-nnnn` — country code, area code, a `2–9` exchange
digit, then random digits. That passes a NANP shape regex but says nothing about
whether the number is *assignable*. gov.bb validates telephone fields with
libphonenumber (`packages/form-validation/src/rules/phone.ts`):

```ts
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
parsePhoneNumberFromString(input, "BB")?.isValid();
```

`isValid()` is a numbering-plan check, so shape-correct-but-unassigned numbers (e.g.
the `555` exchange, `246-555-5555`) are rejected and the form auto-blocks. The
generator was producing such numbers by chance whenever the random exchange/line
digits landed outside Barbados's assigned ranges.

## Decision

For a field type validated by a known library, generate from / validate against the
**same library and metadata bundle** the validator uses, rather than approximating
its rules:

- Barbados phone numbers come from `libphonenumber-js/max` (the same package and
  `/max` metadata gov.bb's `form-validation` uses), via the library's canonical
  example number for region BB. See `src/shared/phone.ts`.
- Tests assert generated values pass `parsePhoneNumberFromString(value, 'BB')?.isValid()`
  — the identical call gov.bb makes — and explicitly assert a known-bad number
  (`246-555-5555`) fails that same check, so the test can never silently degrade
  into a shape assertion.

## Consequences

- Accepting the validator's real metadata as a dependency is the cost of correctness;
  for phone this is ~158 KB (`/max`). A shape regex is not an acceptable substitute
  for a library-validated field, even though it is smaller.
- Any **new** library-validated field type (a future IBAN, postal, or tax-id check
  that gov.bb runs through a real validator) must answer "does this satisfy the actual
  validator?" — mirror the library, don't approximate it.
- This is narrower than "all generated values must be valid": it applies where gov.bb
  delegates validation to a library whose rules a regex cannot faithfully reproduce.
  Format-only fields (e.g. a postcode with a fixed `BBnnnnn` shape) are unaffected.
