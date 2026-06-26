# Emit libphonenumber-valid Barbados phone numbers (issue #3)

Date: 2026-06-26

## Context

Valid-fill mode generated phone numbers as `1-246-Xnn-nnnn` — a NANP-shaped string
with a random `2–9` exchange. gov.bb runs telephone fields through libphonenumber,
which checks the number against Barbados's actual numbering plan, not just its shape.
Shape-correct-but-unassigned numbers (e.g. the `555` exchange) were rejected and the
fill silently blocked. A second gap: a `type=tel` field whose label matched no phone
keyword fell through to `generateGenericText` and got lorem filler, also blocked.

## What changed

- New `src/shared/phone.ts` — `generateValidBarbadosPhone()` returns libphonenumber's
  canonical example number for region BB.
- `src/shared/rules.ts` — phone rule calls the helper instead of the random shape.
- `src/shared/valueGenerator.ts` — `generateValue` gets a `type=tel` branch that always
  uses the helper; `generateGenericText` returns `null` for `tel`.
- Tests in `tests/phone.test.ts` + extensions to `rules`/`valueGenerator` tests.
- Decision record `0004-validated-fields-use-the-real-validator`.
- Commit `48e02d7` (code). Branch `worktree-issue-3-valid-bb-phone`, to merge into `main`.

## Why it looks this way

**The library and metadata were chosen for us, not by us.** Reading the gov-bb source
(`packages/form-validation/src/rules/phone.ts`) settled what would otherwise have been
a judgement call: it uses `parsePhoneNumberFromString(input, "BB")?.isValid()` from
`libphonenumber-js/max`. So we use the *same* package and the *same* `/max` metadata in
both the generator and the tests — exact parity with the validator. We rejected
`google-libphonenumber` (literal Google lib, exact parity but ~550 KB and a clunkier
API) since `libphonenumber-js` is what gov.bb already trusts, and rejected the lighter
`min`/`mobile` metadata since `/max` is what the validator loads. This precedent is
recorded in decision 0004.

**One canonical number, not a randomize-and-validate loop.** The first design sketched
seeding from the example number, randomizing subscriber digits, and re-checking
`isValid()` in a loop for variety. The user chose the simplest route: emit
`getExampleNumber('BB')` every time. It's deterministic, always valid, and needs no
loop. The cost — every filled phone field shows the same number — is irrelevant for a
form-filler whose job is to pass validation, not to look like distinct humans.

**The `tel` branch deliberately wins over the hint/pattern logic.** A phone field is
structurally a phone field regardless of label, so `type=tel` short-circuits to the
helper *before* the default case. This matters beyond the missing-label case: the
default path runs `generateFromHintExample`, which randomizes the digits of a hint's
example — and if that example is itself an unassignable number (the issue's own
`246-555-5555`), the old path would emit a same-shaped invalid number. A test pins this.
`generateGenericText` returning `null` for `tel` is then a defense-in-depth backstop;
with the `tel` branch always returning a value, the orchestrator never reaches it.

**Bundle cost was checked, not assumed.** The build showed a 3.1 MB service-worker
chunk, which looked alarming until measured: that bulk is faker (already present); the
`/max` metadata adds ~158 KB raw. Acceptable, and the deliberate price of correctness
per decision 0004.

## What we almost got wrong

The `examples.mobile.json` import has no JSON type assertion — in libphonenumber-js it
resolves to a `.json.js` module, so `import examples from 'libphonenumber-js/examples.mobile.json'`
(plain default import) is correct; adding `with { type: 'json' }` breaks it. Confirmed
by probing the real package before writing the helper.

## Open questions

- Phone-shaped **text** fields without a phone label (a `type=text` with a phone-shaped
  `pattern`/placeholder) are out of scope — covered cases are `type=tel` (any label) and
  text fields whose label matches the phone keywords. Revisit only if such a form appears.
- Not browser-tested on a live gov.bb form — verified via the test suite (207/207, using
  the exact gov.bb `isValid('BB')` call) and a clean `vite build`.
