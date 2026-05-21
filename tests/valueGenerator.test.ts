import { describe, it, expect } from 'vitest';
import { generateValue, generateForPattern } from '../src/shared/valueGenerator';
import { FieldMeta } from '../src/shared/types';

function field(overrides: Partial<FieldMeta>): FieldMeta {
  return {
    id: 'test-uid',
    elementId: '',
    elementName: '',
    label: '',
    type: 'text',
    ...overrides,
  };
}

describe('generateValue', () => {
  it('returns the 2nd non-blank option for a select with multiple options', () => {
    const f = field({ type: 'select', options: ['BB', 'US', 'CA'] });
    expect(generateValue(f)).toBe('US');
  });

  it('returns the only option for a select with one option', () => {
    const f = field({ type: 'select', options: ['BB'] });
    expect(generateValue(f)).toBe('BB');
  });

  it('returns null for a select with no options', () => {
    const f = field({ type: 'select', options: [] });
    expect(generateValue(f)).toBeNull();
  });

  it('returns true for a checkbox', () => {
    expect(generateValue(field({ type: 'checkbox' }))).toBe(true);
  });

  it('returns the first radio option value', () => {
    const f = field({ type: 'radio', options: ['male', 'female', 'other'] });
    expect(generateValue(f)).toBe('male');
  });

  it('returns null for radio with no options', () => {
    expect(generateValue(field({ type: 'radio' }))).toBeNull();
  });

  it('returns a YYYY-MM-DD string for date type', () => {
    const result = generateValue(field({ type: 'date' }));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a YYYY-MM-DDTHH:MM string for datetime-local', () => {
    const result = generateValue(field({ type: 'datetime-local' }));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('returns a numeric string for number type', () => {
    const result = generateValue(field({ type: 'number', label: '' }));
    expect(result).not.toBeNull();
    expect(Number.isFinite(Number(result))).toBe(true);
  });

  it('returns a matched string for a known label (email)', () => {
    const result = generateValue(field({ type: 'email', label: 'Email' }));
    expect(result).toMatch(/@/);
  });

  it('returns null for an unknown label (testimonial)', () => {
    const result = generateValue(field({ type: 'text', label: 'testimonial' }));
    expect(result).toBeNull();
  });

  it('respects min/max for number fields', () => {
    const result = generateValue(field({ type: 'number', min: '5', max: '5' }));
    expect(result).toBe('5');
  });

  it('truncates text values to maxLength', () => {
    const result = generateValue(field({ type: 'email', label: 'Email', maxLength: 5 }));
    expect(typeof result).toBe('string');
    expect((result as string).length).toBeLessThanOrEqual(5);
  });

  it('uses pattern generator when rule value does not match pattern', () => {
    // Email rule generates "user@example.com" which does not match an all-digit pattern
    const result = generateValue(field({
      type: 'email',
      label: 'Email',
      pattern: '[0-9]{6}',
    }));
    // Should generate 6 digits via generateForPattern, not fall through to null
    expect(result).toMatch(/^\d{6}$/);
  });

  it('returns null when pattern is present and both rule and pattern generator fail', () => {
    // No rule for "testimonial" and pattern is a complex lookahead (too hard for local gen)
    const result = generateValue(field({
      type: 'text',
      label: 'testimonial',
      pattern: '(?=.*[A-Z])(?=.*[0-9]).{8,}',
    }));
    expect(result).toBeNull();
  });
});

describe('generateForPattern', () => {
  it('generates digits for [0-9]{N}', () => {
    const result = generateForPattern('[0-9]{9}');
    expect(result).toMatch(/^\d{9}$/);
  });

  it('generates digits for \\d{N}', () => {
    const result = generateForPattern('\\d{13}');
    expect(result).toMatch(/^\d{13}$/);
  });

  it('generates digits for range [0-9]{M,N} using max length', () => {
    const result = generateForPattern('[0-9]{9,12}');
    expect(result).toMatch(/^\d{12}$/);
  });

  it('generates uppercase letters for [A-Z]{N}', () => {
    const result = generateForPattern('[A-Z]{3}');
    expect(result).toMatch(/^[A-Z]{3}$/);
  });

  it('generates alphanumeric for [A-Z0-9]{N}', () => {
    const result = generateForPattern('[A-Z0-9]{6}');
    expect(result).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('handles mixed literal + class pattern (postcode-like)', () => {
    const result = generateForPattern('[A-Z]{2}[0-9]{5}');
    expect(result).toMatch(/^[A-Z]{2}\d{5}$/);
  });

  it('handles literal characters between classes', () => {
    const result = generateForPattern('[0-9]{3}-[0-9]{4}');
    expect(result).toMatch(/^\d{3}-\d{4}$/);
  });

  it('returns null for patterns too complex to generate locally', () => {
    expect(generateForPattern('(?=.*[A-Z]).{8}')).toBeNull();
  });
});
