import { FieldMeta } from './types';
import { matchRule } from './rules';
import { faker } from '@faker-js/faker';

/**
 * Extracts a "for example, X" or "e.g. X" example from hint/error text and
 * generates a similar value by randomising only the digit positions.
 * "Enter a valid postcode (for example, BB17004)" → "BB53291"
 * "for example, 2345678, 1-246-234-5678" → "7813942" (first example used)
 */
export function generateFromHintExample(hint: string): string | null {
  const match = hint.match(/(?:for example[,:]?\s*|e\.?g\.?,?\s*)([^\s,;]+)/i);
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

export function generateValue(field: FieldMeta): string | boolean | null {
  switch (field.type) {
    case 'select': {
      if (!field.options || field.options.length === 0) return null;
      return field.options.length > 1 ? field.options[1] : field.options[0];
    }

    case 'checkbox':
      return true;

    case 'radio':
      return field.options?.[0] ?? null;

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
