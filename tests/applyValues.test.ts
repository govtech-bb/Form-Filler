import { describe, it, expect, beforeEach } from 'vitest';
import { applyValues } from '../src/content/index';
import { extractFields } from '../src/shared/fieldExtractor';
import { generateValue } from '../src/shared/valueGenerator';
import { FillInstruction } from '../src/shared/types';

/**
 * Drives the real pipeline against the global jsdom document: extract fields,
 * generate a value for each, then apply. Returns the radios so tests can assert.
 */
function fillForm(html: string): void {
  document.body.innerHTML = html;
  const fields = extractFields(document);
  const instructions: FillInstruction[] = [];
  for (const f of fields) {
    const value = generateValue(f);
    if (value !== null) instructions.push({ fieldId: f.id, value });
  }
  applyValues(instructions);
}

describe('applyValues — radio selection', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('selects an option for a radio group with NO value attributes', () => {
    fillForm(`
      <label><input type="radio" name="agree"> Yes</label>
      <label><input type="radio" name="agree"> No</label>
    `);
    const checked = document.querySelectorAll<HTMLInputElement>(
      'input[type="radio"][name="agree"]:checked'
    );
    expect(checked.length).toBe(1);
  });

  it('selects the matching option for a radio group WITH value attributes', () => {
    fillForm(`
      <label><input type="radio" name="gender" value="male"> Male</label>
      <label><input type="radio" name="gender" value="female"> Female</label>
    `);
    const checked = document.querySelector<HTMLInputElement>(
      'input[type="radio"][name="gender"]:checked'
    );
    expect(checked).not.toBeNull();
    expect(checked!.value).toBe('male');
  });

  it('defaults an "Add another?" value-less radio group to No (gov-bb shape)', () => {
    // gov-bb radios carry the meaning in the label, not a value attribute
    // (both report value "on"), and the question lives in the <legend>.
    fillForm(`
      <fieldset>
        <legend>Add another?</legend>
        <div><input type="radio" id="aa-yes" name="Add Another" checked><label for="aa-yes">Yes</label></div>
        <div><input type="radio" id="aa-no" name="Add Another"><label for="aa-no">No</label></div>
      </fieldset>
    `);
    const checked = document.querySelector<HTMLInputElement>(
      'input[name="Add Another"]:checked'
    );
    expect(checked).not.toBeNull();
    expect(checked!.id).toBe('aa-no');
  });
});
