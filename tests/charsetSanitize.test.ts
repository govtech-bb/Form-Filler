import { describe, it, expect } from 'vitest';
import { parseAllowedCharset, sanitizeToAllowedChars } from '../src/shared/valueGenerator';

describe('parseAllowedCharset', () => {
  it('parses "only letters, hyphens, or apostrophes"', () => {
    const allowed = parseAllowedCharset('Name must contain only letters, hyphens, or apostrophes');
    expect(allowed).not.toBeNull();
    // the returned class should accept a letter, hyphen and apostrophe…
    expect(new RegExp(`^[${allowed}]+$`).test("O'Brien-Smith")).toBe(true);
    // …and reject a space, digit and period
    expect(new RegExp(`^[${allowed}]+$`).test('a b')).toBe(false);
    expect(new RegExp(`^[${allowed}]+$`).test('a1')).toBe(false);
    expect(new RegExp(`^[${allowed}]+$`).test('a.')).toBe(false);
  });

  it('parses "only letters and numbers"', () => {
    const allowed = parseAllowedCharset('Field can only contain letters and numbers');
    expect(new RegExp(`^[${allowed}]+$`).test('abc123')).toBe(true);
    expect(new RegExp(`^[${allowed}]+$`).test('abc-123')).toBe(false);
  });

  it('returns null when the text states no charset restriction', () => {
    expect(parseAllowedCharset('Please enter your name')).toBeNull();
    expect(parseAllowedCharset('Enter a valid postcode (for example, BB17004)')).toBeNull();
    expect(parseAllowedCharset(undefined)).toBeNull();
  });
});

describe('sanitizeToAllowedChars', () => {
  it('strips disallowed characters from the applied value', () => {
    const out = sanitizeToAllowedChars(
      'Defetiscor cariosus velum via.',
      'Name must contain only letters, hyphens, or apostrophes'
    );
    expect(out).toBe('Defetiscorcariosusvelumvia');
  });

  it('keeps allowed punctuation', () => {
    const out = sanitizeToAllowedChars(
      "O'Brien-Smith! 12",
      'only letters, hyphens, or apostrophes'
    );
    expect(out).toBe("O'Brien-Smith");
  });

  it('returns null when no charset restriction is recognized', () => {
    expect(sanitizeToAllowedChars('anything', 'Please enter your name')).toBeNull();
  });
});
