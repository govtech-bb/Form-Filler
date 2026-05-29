import { FieldMeta } from './types';
import { matchRule, normalizeLabel } from './rules';
import { faker } from '@faker-js/faker';

/**
 * Extracts a "for example, X" or "e.g. X" example from hint/error text and
 * generates a similar value by randomising only the digit positions.
 * "Enter a valid postcode (for example, BB17004)" → "BB53291"
 * "for example, 2345678, 1-246-234-5678" → "7813942" (first example used)
 */
export function generateFromHintExample(hint: string): string | null {
  const match = hint.match(/(?:for example[,:\s]+|e\.?g\.?[,:\s]+)([^\s,;(]+)/i);
  if (!match) return null;

  const example = match[1].replace(/[.)]+$/, ''); // strip trailing punctuation
  if (!example || example.length > 30) return null;

  // Randomise digit positions only; preserve letters, dashes, spaces, etc.
  const varied = example.replace(/[0-9]/g, () => faker.string.numeric(1));
  return varied || null;
}

/**
 * Attempts to generate a string that satisfies a HTML `pattern` attribute by
 * structurally substituting known character-class tokens with real characters.
 * Returns null when the pattern is too complex to handle locally (→ AI fallback).
 */
export function generateForPattern(pattern: string): string | null {
  try {
    const re = new RegExp(`^(?:${pattern})$`);

    const value = pattern
      // Quantified classes — process before single-char classes
      .replace(/\\d\{(\d+),(\d+)\}/g, (_, _min, max) => faker.string.numeric(parseInt(max)))
      .replace(/\\d\{(\d+)\}/g, (_, n) => faker.string.numeric(parseInt(n)))
      .replace(/\[0-9\]\{(\d+),(\d+)\}/g, (_, _min, max) => faker.string.numeric(parseInt(max)))
      .replace(/\[0-9\]\{(\d+)\}/g, (_, n) => faker.string.numeric(parseInt(n)))
      .replace(/\[A-Z\]\{(\d+),(\d+)\}/g, (_, _min, max) =>
        faker.string.alpha({ length: parseInt(max), casing: 'upper' }))
      .replace(/\[A-Z\]\{(\d+)\}/g, (_, n) =>
        faker.string.alpha({ length: parseInt(n), casing: 'upper' }))
      .replace(/\[a-z\]\{(\d+),(\d+)\}/g, (_, _min, max) =>
        faker.string.alpha({ length: parseInt(max), casing: 'lower' }))
      .replace(/\[a-z\]\{(\d+)\}/g, (_, n) =>
        faker.string.alpha({ length: parseInt(n), casing: 'lower' }))
      .replace(/\[A-Za-z0-9\]\{(\d+),(\d+)\}/g, (_, _min, max) =>
        faker.string.alphanumeric(parseInt(max)).toUpperCase())
      .replace(/\[A-Za-z0-9\]\{(\d+)\}/g, (_, n) =>
        faker.string.alphanumeric(parseInt(n)).toUpperCase())
      .replace(/\[A-Z0-9\]\{(\d+),(\d+)\}/g, (_, _min, max) =>
        faker.string.alphanumeric(parseInt(max)).toUpperCase())
      .replace(/\[A-Z0-9\]\{(\d+)\}/g, (_, n) =>
        faker.string.alphanumeric(parseInt(n)).toUpperCase())
      // + and * quantifiers — use a short fixed length
      .replace(/\\d\+/g, () => faker.string.numeric(5))
      .replace(/\[0-9\]\+/g, () => faker.string.numeric(5))
      .replace(/\\d\*/g, () => faker.string.numeric(3))
      .replace(/\[0-9\]\*/g, () => faker.string.numeric(3))
      .replace(/\[A-Z\]\+/g, () => faker.string.alpha({ length: 3, casing: 'upper' }))
      // Single character classes (no quantifier)
      .replace(/\\d/g, () => faker.string.numeric(1))
      .replace(/\[0-9\]/g, () => faker.string.numeric(1))
      .replace(/\[A-Z\]/g, () => faker.string.alpha({ length: 1, casing: 'upper' }))
      .replace(/\[a-z\]/g, () => faker.string.alpha({ length: 1, casing: 'lower' }))
      .replace(/\[A-Za-z\]/g, () => faker.string.alpha({ length: 1, casing: 'mixed' }))
      .replace(/\[A-Za-z0-9\]/g, () => faker.string.alphanumeric(1))
      .replace(/\[A-Z0-9\]/g, () => faker.string.alphanumeric(1).toUpperCase())
      // Optional quantifier after a resolved token — just drop the ?
      .replace(/\?/g, '')
      // Escaped literal characters
      .replace(/\\\+/g, '+')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\./g, '.')
      .replace(/\\-/g, '-')
      .replace(/\\ /g, ' ')
      .replace(/\\s/g, ' ');

    // If unresolved regex syntax remains, the pattern is too complex for local generation
    if (/[[\]{}()|\\^$*+?]/.test(value)) return null;

    return re.test(value) ? value : null;
  } catch {
    return null;
  }
}

function applyMaxLength(value: string, maxLength?: number): string {
  return maxLength && value.length > maxLength ? value.slice(0, maxLength) : value;
}

const TEXT_LIKE_TYPES = ['text', 'textarea', 'email', 'tel', 'url', 'password', 'search'];

/**
 * Last-resort value for a free-text field whose label matched no rule and that AI
 * didn't fill — so the field isn't left blank. Returns null for structured types
 * (select/radio/checkbox) and pattern-constrained fields, where arbitrary text
 * would be invalid; those are better left blank than filled wrongly.
 */
export function generateGenericText(field: FieldMeta): string | null {
  if (!TEXT_LIKE_TYPES.includes(field.type)) return null;
  if (field.pattern) return null;

  let value: string;
  switch (field.type) {
    case 'email': value = faker.internet.email(); break;
    case 'url': value = faker.internet.url(); break;
    case 'password': value = 'TestPassword123!'; break;
    default: value = faker.lorem.words(2);
  }
  return applyMaxLength(value, field.maxLength);
}

// --- Test validation mode: deliberately-invalid values ---------------------
//
// Each invalid-mode fill targets ONE constraint per field. The violation kinds
// below are tried in this fixed order; `generateInvalidValue` picks the Nth one
// applicable to a field (N = the cycle step), so successive fills walk every
// field through tooShort → invalidChars → tooLong → outOfRange → empty.

export type ViolationKind = 'tooShort' | 'invalidChars' | 'tooLong' | 'outOfRange' | 'empty';

const VIOLATION_ORDER: ViolationKind[] = [
  'tooShort', 'invalidChars', 'tooLong', 'outOfRange', 'empty',
];

/** The violation kinds that can actually be applied to this field, in cycle order. */
export function applicableViolations(field: FieldMeta): ViolationKind[] {
  const has: Record<ViolationKind, boolean> = {
    // A minimum length to undercut
    tooShort: !!field.minLength && field.minLength > 1,
    // Junk content: any text-like field (so plain text gets visible garbage rather
    // than being left blank), plus number and pattern-constrained fields.
    invalidChars:
      TEXT_LIKE_TYPES.includes(field.type) || field.type === 'number' || !!field.pattern,
    // A maximum length to exceed
    tooLong: !!field.maxLength,
    // A numeric/date bound to step outside of
    outOfRange:
      (field.type === 'number' || field.type === 'date' || field.type === 'datetime-local') &&
      (field.min !== undefined || field.max !== undefined),
    // Emptying only fails validation on a required field — so don't blank others.
    empty: !!field.required,
  };
  const kinds = VIOLATION_ORDER.filter((k) => has[k]);
  // Fallback: a field with no other way to be invalid (e.g. an optional date with
  // no bounds) can at least be emptied.
  return kinds.length > 0 ? kinds : ['empty'];
}

function outOfRangeDate(bound: string, dir: 'before' | 'after', isDatetime: boolean): string {
  const d = new Date(bound);
  if (isNaN(d.getTime())) return '';
  d.setUTCFullYear(d.getUTCFullYear() + (dir === 'before' ? -1 : 1));
  return isDatetime ? d.toISOString().slice(0, 16) : d.toISOString().split('T')[0];
}

function violate(field: FieldMeta, kind: ViolationKind): string | boolean | null {
  switch (kind) {
    case 'empty':
      return '';

    case 'tooShort':
      // One char short of the minimum (minLength > 1 is guaranteed by applicability)
      return faker.string.alpha({ length: (field.minLength ?? 2) - 1 });

    case 'tooLong':
      return faker.string.alpha({ length: (field.maxLength ?? 10) + 5 });

    case 'outOfRange': {
      if (field.type === 'number') {
        if (field.min !== undefined) {
          const min = parseFloat(field.min);
          if (!isNaN(min)) return String(min - 1);
        }
        if (field.max !== undefined) {
          const max = parseFloat(field.max);
          if (!isNaN(max)) return String(max + 1);
        }
        return '-999999';
      }
      const isDatetime = field.type === 'datetime-local';
      if (field.min !== undefined) return outOfRangeDate(field.min, 'before', isDatetime);
      if (field.max !== undefined) return outOfRangeDate(field.max, 'after', isDatetime);
      return '';
    }

    case 'invalidChars': {
      if (field.type === 'email') return 'not-an-email';
      if (field.type === 'url') return 'not a url';
      if (field.type === 'tel' || field.type === 'number') return 'abc';
      // Pattern field — make sure the junk actually fails the regex; if it somehow
      // matches, leave the field empty rather than emit an accidentally-valid value.
      if (field.pattern) {
        const bad = '!!!INVALID!!!';
        try {
          return new RegExp(`^(?:${field.pattern})$`).test(bad) ? '' : bad;
        } catch {
          return bad;
        }
      }
      return '!!!INVALID!!!';
    }
  }
}

/**
 * Produces a value that should FAIL the field's validation. `step` selects which
 * constraint to break (cycled across fills). Returns null to skip the field
 * (radios — leaving the group unselected is itself an invalid/required test).
 */
export function generateInvalidValue(
  field: FieldMeta,
  step = 0
): string | boolean | null {
  // Date triplet member — an out-of-range part makes the whole date invalid.
  if (field.datePart) {
    return field.datePart === 'year' ? '0' : '99';
  }

  switch (field.type) {
    case 'checkbox':
      return false; // unchecked → fails required "I agree" boxes
    case 'radio':
      return null; // skip → leaves the group unselected
    case 'select':
      return ''; // deselect → fails required-choice
    default: {
      const kinds = applicableViolations(field);
      const kind = kinds[((step % kinds.length) + kinds.length) % kinds.length];
      return violate(field, kind);
    }
  }
}

export function generateValue(
  field: FieldMeta,
  dateGroupCache?: Map<string, Date>
): string | boolean | null {
  // Date triplet member — emit the requested part of a shared past date.
  // The cache keys by dateGroupId so all three siblings see the same date.
  if (field.datePart && field.dateGroupId) {
    const cache = dateGroupCache ?? new Map<string, Date>();
    let date = cache.get(field.dateGroupId);
    if (!date) {
      date = faker.date.past({ years: 30 });
      cache.set(field.dateGroupId, date);
    }
    if (field.datePart === 'day') return String(date.getUTCDate());
    if (field.datePart === 'month') return String(date.getUTCMonth() + 1);
    return String(date.getUTCFullYear());
  }

  switch (field.type) {
    case 'select': {
      if (!field.options || field.options.length === 0) return null;
      return field.options.length > 1 ? field.options[1] : field.options[0];
    }

    case 'checkbox':
      return true;

    case 'radio': {
      if (!field.options || field.options.length === 0) return null;
      // "Add another?"-type groups default to No so we don't expand the form with
      // extra (likely required) fields that then fail validation on the first pass.
      const question = normalizeLabel(field.groupLabel ?? field.label);
      if (/\badd (another|more)\b/.test(question)) {
        const no = field.options.find((o) => /^(no|false|n|0)$/i.test(o));
        if (no) return no;
      }
      return field.options[0];
    }

    case 'date': {
      const d = faker.date.past({ years: 5 });
      return d.toISOString().split('T')[0];
    }

    case 'datetime-local': {
      const d = faker.date.past({ years: 5 });
      return d.toISOString().slice(0, 16);
    }

    case 'number': {
      const min = field.min !== undefined ? parseFloat(field.min) : 1;
      const max = field.max !== undefined ? parseFloat(field.max) : 100;
      return String(faker.number.int({
        min: isNaN(min) ? 1 : min,
        max: isNaN(max) ? 100 : max,
      }));
    }

    default: {
      const ruleValue = matchRule(field.label);

      // Build candidate list in priority order:
      // 1. Hint example — most format-specific (e.g. "BB17004" → "BB53291")
      // 2. Rule value — label-matched faker output
      // 3. Pattern generator — structural regex expansion
      const hintValue = field.hint ? generateFromHintExample(field.hint) : null;

      const candidates = [hintValue, ruleValue].filter((v): v is string => v !== null);

      if (!field.pattern) {
        const winner = candidates[0] ?? null;
        return winner !== null ? applyMaxLength(winner, field.maxLength) : null;
      }

      // Pattern present — pick the first candidate that satisfies it
      try {
        const re = new RegExp(`^(?:${field.pattern})$`);
        for (const candidate of candidates) {
          if (re.test(candidate)) return applyMaxLength(candidate, field.maxLength);
        }
        // No candidate matched — try structural pattern generation
        const patternValue = generateForPattern(field.pattern);
        if (patternValue !== null && re.test(patternValue)) {
          return applyMaxLength(patternValue, field.maxLength);
        }
      } catch { /* invalid regex — fall through to AI */ }

      return null; // signal AI fallback needed
    }
  }
}
