import { describe, it, expect } from 'vitest';
import { generateInvalidValue, applicableViolations } from '../src/shared/valueGenerator';
import { FieldMeta } from '../src/shared/types';

function field(overrides: Partial<FieldMeta>): FieldMeta {
  return { id: 'f', elementId: '', elementName: '', label: 'L', type: 'text', ...overrides };
}

describe('generateInvalidValue — per-type violations', () => {
  it('produces a malformed email (no @)', () => {
    const v = generateInvalidValue(field({ type: 'email' }), 0);
    expect(v).toBe('not-an-email');
    expect(String(v)).not.toContain('@');
  });

  it('puts an out-of-range number below min', () => {
    const f = field({ type: 'number', min: '1', max: '10' });
    // number applicable: invalidChars(0), outOfRange(1), empty(2)
    expect(generateInvalidValue(f, 1)).toBe('0');
  });

  it('exceeds maxLength for a too-long violation', () => {
    const f = field({ type: 'text', maxLength: 8 });
    // text + maxLength applicable: invalidChars(0), tooLong(1)
    const v = generateInvalidValue(f, 1) as string;
    expect(v.length).toBeGreaterThan(8);
  });

  it('undercuts minLength for a too-short violation', () => {
    const f = field({ type: 'text', minLength: 6 });
    // applicable: tooShort(0), empty(1)
    const v = generateInvalidValue(f, 0) as string;
    expect(v.length).toBeLessThan(6);
  });

  it('leaves checkboxes unchecked', () => {
    expect(generateInvalidValue(field({ type: 'checkbox' }), 0)).toBe(false);
    expect(generateInvalidValue(field({ type: 'checkbox' }), 3)).toBe(false);
  });

  it('skips radios so the group stays unselected', () => {
    expect(generateInvalidValue(field({ type: 'radio', options: ['a', 'b'] }), 0)).toBeNull();
  });

  it('deselects a select', () => {
    expect(generateInvalidValue(field({ type: 'select', options: ['a', 'b'] }), 0)).toBe('');
  });

  it('never emits a value that satisfies the pattern', () => {
    const pattern = '[A-Z]{2}[0-9]{5}'; // e.g. a postcode
    const f = field({ type: 'text', pattern });
    // applicable: invalidChars(0), empty(1)
    const v = generateInvalidValue(f, 0) as string;
    expect(new RegExp(`^(?:${pattern})$`).test(v)).toBe(false);
  });

  it('emits an out-of-range date before min', () => {
    const f = field({ type: 'date', min: '2020-01-01' });
    // applicable: outOfRange(0), empty(1)
    const v = generateInvalidValue(f, 0) as string;
    expect(v < '2020-01-01').toBe(true);
  });
});

describe('generateInvalidValue — cycling', () => {
  it('walks a fully-constrained field through each constraint, then wraps', () => {
    const f = field({ type: 'text', minLength: 4, maxLength: 10, pattern: '[a-z]+', required: true });
    const kinds = applicableViolations(f);
    // canonical order, minus outOfRange (not a number/date)
    expect(kinds).toEqual(['tooShort', 'invalidChars', 'tooLong', 'empty']);

    const short = generateInvalidValue(f, 0) as string;
    const bad = generateInvalidValue(f, 1) as string;
    const long = generateInvalidValue(f, 2) as string;
    const empty = generateInvalidValue(f, 3);

    expect(short.length).toBeLessThan(4);
    expect(new RegExp('^(?:[a-z]+)$').test(bad)).toBe(false);
    expect(long.length).toBeGreaterThan(10);
    expect(empty).toBe('');

    // step 4 wraps back to the first violation
    expect((generateInvalidValue(f, 4) as string).length).toBeLessThan(4);
  });

  it('fills unconstrained text with visible garbage, not blank', () => {
    const f = field({ type: 'text' }); // no constraints, not required
    expect(applicableViolations(f)).toEqual(['invalidChars']);
    expect(generateInvalidValue(f, 0)).toBe('!!!INVALID!!!');
    expect(generateInvalidValue(f, 7)).toBe('!!!INVALID!!!');
  });

  it('a required unconstrained field alternates garbage and blank', () => {
    const f = field({ type: 'text', required: true });
    expect(applicableViolations(f)).toEqual(['invalidChars', 'empty']);
    expect(generateInvalidValue(f, 0)).toBe('!!!INVALID!!!');
    expect(generateInvalidValue(f, 1)).toBe('');
  });

  it('only empties an optional field as a last resort (no other violation)', () => {
    const f = field({ type: 'date' }); // no bounds, not required
    expect(applicableViolations(f)).toEqual(['empty']);
    expect(generateInvalidValue(f, 0)).toBe('');
  });
});
