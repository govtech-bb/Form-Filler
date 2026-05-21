import { FieldMeta, FieldType } from './types';

function getFieldType(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
): FieldType {
  if (el instanceof HTMLSelectElement) return 'select';
  if (el instanceof HTMLTextAreaElement) return 'textarea';
  const t = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
  const valid: FieldType[] = [
    'text', 'email', 'password', 'number', 'date',
    'datetime-local', 'tel', 'url', 'checkbox', 'radio',
  ];
  return (valid as string[]).includes(t) ? (t as FieldType) : 'other';
}

const HINT_CLASS_RE = /hint|help|note|caption|helper|info|format|description|error|invalid|message|alert|validation|feedback/;

function resolveHint(el: HTMLElement, doc: Document): string {
  // aria-describedby (highest priority — explicit association)
  const describedById = el.getAttribute('aria-describedby');
  if (describedById) {
    // Multiple IDs are space-separated
    for (const id of describedById.trim().split(/\s+/)) {
      const text = doc.getElementById(id)?.textContent?.trim();
      if (text) return text;
    }
  }

  // Preceding siblings — validation errors are often injected above the input
  let prev = el.previousElementSibling;
  let prevChecked = 0;
  while (prev && prevChecked < 3) {
    const tag = prev.tagName.toLowerCase();
    const cls = prev.className?.toLowerCase() ?? '';
    if (tag === 'small' || HINT_CLASS_RE.test(cls)) {
      const text = prev.textContent?.trim();
      if (text) return text;
    }
    prev = prev.previousElementSibling;
    prevChecked++;
  }

  // Following siblings — static hint text
  let next = el.nextElementSibling;
  let nextChecked = 0;
  while (next && nextChecked < 3) {
    const tag = next.tagName.toLowerCase();
    const cls = next.className?.toLowerCase() ?? '';
    if (tag === 'small' || HINT_CLASS_RE.test(cls)) {
      const text = next.textContent?.trim();
      if (text) return text;
    }
    next = next.nextElementSibling;
    nextChecked++;
  }

  return '';
}

function resolveLabel(el: HTMLElement, doc: Document): string {
  // Priority 1: aria-label
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;

  // Priority 2: aria-labelledby
  const labelledById = el.getAttribute('aria-labelledby');
  if (labelledById) {
    const text = doc.getElementById(labelledById)?.textContent?.trim();
    if (text) return text;
  }

  // Priority 3: <label for="id">
  const id = el.id;
  if (id) {
    const text = doc
      .querySelector<HTMLLabelElement>(`label[for="${id}"]`)
      ?.textContent?.trim();
    if (text) return text;
  }

  // Priority 4: wrapping <label> (strip nested input text)
  const parentLabel = el.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input,select,textarea').forEach((n) => n.remove());
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  // Priority 5: preceding sibling text content
  let sibling = el.previousElementSibling;
  while (sibling) {
    const text = sibling.textContent?.trim();
    if (text) return text;
    sibling = sibling.previousElementSibling;
  }

  // Priority 6: placeholder / name / id
  return (
    (el as HTMLInputElement).placeholder?.trim() ||
    el.getAttribute('name')?.trim() ||
    el.id?.trim() ||
    ''
  );
}

let _uidCounter = 0;

export function extractFields(doc: Document = document): FieldMeta[] {
  const selector =
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"])' +
    ':not([type="reset"]):not([type="image"]):not([type="file"]), select, textarea';

  const elements = Array.from(
    doc.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)
  );

  const fields: FieldMeta[] = [];
  const radioGroups = new Set<string>();
  const checkboxGroups = new Set<string>();

  for (const el of elements) {
    const type = getFieldType(el);
    if (type === 'other') continue;

    const elementName = el.getAttribute('name') ?? '';

    // Deduplicate radio groups
    if (type === 'radio' && elementName) {
      if (radioGroups.has(elementName)) continue;
      radioGroups.add(elementName);
    }

    // Deduplicate checkbox groups (same name = group; no name = standalone)
    if (type === 'checkbox' && elementName) {
      if (checkboxGroups.has(elementName)) continue;
      checkboxGroups.add(elementName);
    }

    const uid = `ff-${Date.now()}-${_uidCounter++}`;
    (el as HTMLElement).dataset.ffUid = uid;

    const meta: FieldMeta = {
      id: uid,
      elementId: el.id ?? '',
      elementName,
      label: resolveLabel(el, doc),
      type,
    };

    const pattern = el.getAttribute('pattern');
    if (pattern) meta.pattern = pattern;

    const maxLengthAttr = el.getAttribute('maxlength');
    if (maxLengthAttr !== null) {
      const n = parseInt(maxLengthAttr, 10);
      if (n > 0) meta.maxLength = n;
    }

    const minAttr = el.getAttribute('min');
    if (minAttr !== null) meta.min = minAttr;

    const maxAttr = el.getAttribute('max');
    if (maxAttr !== null) meta.max = maxAttr;

    const hint = resolveHint(el, doc);
    if (hint) meta.hint = hint;

    if (type === 'select') {
      meta.options = Array.from((el as HTMLSelectElement).options)
        .map((o) => o.value)
        .filter((v) => v !== '');
    }

    if (type === 'radio') {
      meta.groupName = elementName;
      meta.options = Array.from(
        doc.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${elementName}"]`)
      ).map((r) => r.value);
    }

    if (type === 'checkbox' && elementName) {
      meta.groupName = elementName;
    }

    fields.push(meta);
  }

  return fields;
}
