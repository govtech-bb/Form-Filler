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

  it('clicks the button[role="radio"], not the inert proxy input, for a Radix-style group', () => {
    // Old gov-bb alpha shape: the real control is <button role="radio">; the
    // <input type="radio"> beside it is an aria-hidden, pointer-events:none proxy
    // that only mirrors state for native submission. Clicking it does nothing.
    document.body.innerHTML = `
      <fieldset>
        <legend>Is the certificate for you?</legend>
        <div role="radiogroup">
          <div class="flex gap-5 items-center">
            <button type="button" role="radio" aria-checked="false" data-state="unchecked" value="yes" id="yes"></button>
            <input aria-hidden="true" tabindex="-1" type="radio" value="yes" style="opacity:0;pointer-events:none">
            <label for="yes">Yes - the certificate is for me</label>
          </div>
          <div class="flex gap-5 items-center">
            <button type="button" role="radio" aria-checked="false" data-state="unchecked" value="no" id="no"></button>
            <input aria-hidden="true" tabindex="-1" type="radio" value="no" style="opacity:0;pointer-events:none">
            <label for="no">No - the certificate is for someone else</label>
          </div>
        </div>
      </fieldset>
    `;
    const buttonClicks: string[] = [];
    document.querySelectorAll<HTMLButtonElement>('button[role="radio"]').forEach((b) =>
      b.addEventListener('click', () => buttonClicks.push(b.value))
    );
    const inputClicks: string[] = [];
    document.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((i) =>
      i.addEventListener('click', () => inputClicks.push(i.value))
    );

    const fields = extractFields(document);
    const instructions: FillInstruction[] = [];
    for (const f of fields) {
      const value = generateValue(f);
      if (value !== null) instructions.push({ fieldId: f.id, value });
    }
    applyValues(instructions);

    // Exactly one option selected (the group is treated as a single field), and
    // the click landed on the button — the real control — not the inert proxy.
    expect(buttonClicks).toEqual(['yes']);
    expect(inputClicks).toEqual([]);
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
