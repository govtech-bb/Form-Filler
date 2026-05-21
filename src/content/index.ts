import { extractFields } from '../shared/fieldExtractor';
import { FillInstruction, FillResult, MessageToContent } from '../shared/types';

// Use native setter so React controlled inputs pick up the change
const nativeInputSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  'value'
)?.set;
const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  'value'
)?.set;

function applyValues(instructions: FillInstruction[]): FillResult {
  let fieldsFilled = 0;
  let fieldsSkipped = 0;

  for (const instruction of instructions) {
    const el = document.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(`[data-ff-uid="${instruction.fieldId}"]`);

    if (!el) {
      fieldsSkipped++;
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      el.checked = instruction.value === true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      fieldsFilled++;
      continue;
    }

    if (el instanceof HTMLInputElement && el.type === 'radio') {
      const radio = document.querySelector<HTMLInputElement>(
        `input[type="radio"][name="${el.name}"][value="${instruction.value}"]`
      );
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        fieldsFilled++;
      } else {
        fieldsSkipped++;
      }
      continue;
    }

    if (el instanceof HTMLSelectElement) {
      el.value = String(instruction.value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
      fieldsFilled++;
      continue;
    }

    // Text-like inputs and textareas — use native setter for React compatibility
    if (el instanceof HTMLTextAreaElement) {
      nativeTextareaSetter?.call(el, String(instruction.value));
    } else {
      nativeInputSetter?.call(el, String(instruction.value));
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    fieldsFilled++;
  }

  return {
    fieldsFilled,
    fieldsSkipped,
    aiFieldCount: 0,
    timestamp: Date.now(),
  };
}

chrome.runtime.onMessage.addListener(
  (message: MessageToContent, _sender, sendResponse) => {
    if (message.type === 'EXTRACT_FIELDS') {
      const fields = extractFields(document);
      sendResponse({ fields });
      return false;
    }

    if (message.type === 'APPLY_VALUES') {
      applyValues(message.instructions);
      sendResponse({ ok: true });
      return false;
    }
  }
);
