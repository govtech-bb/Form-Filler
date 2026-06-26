import { describe, it, expect } from 'vitest';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { generateValidBarbadosPhone } from '../src/shared/phone';

// Mirror the exact check gov.bb runs (packages/form-validation/src/rules/phone.ts):
//   parsePhoneNumberFromString(input, "BB")?.isValid()
const isValidBB = (value: string): boolean =>
  parsePhoneNumberFromString(value, 'BB')?.isValid() ?? false;

describe('isValidBB (the test harness itself)', () => {
  it('rejects the known-bad 246-555-5555', () => {
    // Guards the test: if this ever passes, the validator below is meaningless.
    expect(isValidBB('246-555-5555')).toBe(false);
  });

  it('accepts a real assignable Barbados number', () => {
    expect(isValidBB('+1 246 250 1234')).toBe(true);
  });
});

describe('generateValidBarbadosPhone', () => {
  it('passes libphonenumber isValid() for region BB', () => {
    expect(isValidBB(generateValidBarbadosPhone())).toBe(true);
  });

  it('is a +1 246 (Barbados) number', () => {
    const parsed = parsePhoneNumberFromString(generateValidBarbadosPhone(), 'BB');
    expect(parsed?.country).toBe('BB');
    expect(parsed?.countryCallingCode).toBe('1');
  });
});
