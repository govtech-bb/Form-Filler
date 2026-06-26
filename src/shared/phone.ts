import { getExampleNumber } from 'libphonenumber-js/max';
import examples from 'libphonenumber-js/examples.mobile.json';

/**
 * A real, assignable Barbados phone number in international format
 * (e.g. "+1 246 250 1234").
 *
 * gov.bb validates phone fields with libphonenumber's `parsePhoneNumberFromString(input, "BB")
 * ?.isValid()` (the `/max` metadata bundle) — a numbering-plan check, not just a
 * shape regex — so a correctly-formatted-but-unassigned number like 246-555-5555 is
 * rejected. We return libphonenumber's own canonical example number for region BB,
 * which is guaranteed `isValid()` by the same metadata the validator uses. One
 * canonical number every time: deterministic and always valid.
 *
 * `getExampleNumber` only returns undefined if BB metadata is ever dropped; the
 * fallback is that same canonical number captured as a literal so callers always
 * get a non-empty string.
 */
export function generateValidBarbadosPhone(): string {
  return getExampleNumber('BB', examples)?.formatInternational() ?? '+1 246 250 1234';
}
