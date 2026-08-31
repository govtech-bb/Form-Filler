import { describe, it, expect } from 'vitest';
import {
  describeInjectionFailure,
  describeUnsupportedUrl,
  FILE_ACCESS_HINT,
} from '../src/shared/urlSupport';

describe('describeUnsupportedUrl', () => {
  it.each([
    'https://example.com/signup',
    'http://example.com/form?step=2',
    'https://alpha.gov.bb/apply',
    'http://localhost:3000/form',
    'http://127.0.0.1:8000/',
    'file:///Users/me/prototype/form.html',
    'ftp://files.example.com/form.html',
  ])('allows %s', (url) => {
    expect(describeUnsupportedUrl(url)).toBeNull();
  });

  it.each([
    ['chrome://extensions', 'browser pages'],
    ['chrome://newtab/', 'browser pages'],
    ['chrome-untrusted://print', 'browser pages'],
    ['devtools://devtools/bundled/devtools_app.html', 'DevTools'],
    ['chrome-extension://abcdefg/popup.html', 'extension pages'],
    ['about:blank', 'no page here'],
    ['view-source:https://example.com/', 'source view'],
    ['data:text/html,<input>', 'data: URLs'],
  ])('rejects %s', (url, expected) => {
    expect(describeUnsupportedUrl(url)).toContain(expected);
  });

  it('rejects the Chrome Web Store on both of its hosts', () => {
    expect(describeUnsupportedUrl('https://chromewebstore.google.com/detail/abc')).toContain(
      'Web Store'
    );
    expect(describeUnsupportedUrl('https://chrome.google.com/webstore/category/extensions')).toContain(
      'Web Store'
    );
  });

  it('allows chrome.google.com paths outside the Web Store', () => {
    expect(describeUnsupportedUrl('https://chrome.google.com/')).toBeNull();
  });

  it('names an unrecognised scheme instead of guessing', () => {
    expect(describeUnsupportedUrl('mailto:someone@example.com')).toBe(
      "Form Filler can't run on mailto:// pages."
    );
  });

  // Chrome withholds tab.url on pages the extension cannot access, so an absent
  // URL must not block a fill — describeInjectionFailure handles those instead.
  it.each([undefined, null, ''])('does not block when the URL is unknown (%s)', (url) => {
    expect(describeUnsupportedUrl(url)).toBeNull();
  });

  it('ignores surrounding whitespace and scheme casing', () => {
    expect(describeUnsupportedUrl('  CHROME://settings  ')).toContain('browser pages');
  });
});

describe('describeInjectionFailure', () => {
  it.each([
    'Cannot access contents of the page.',
    'Cannot access a chrome:// URL',
    'The extensions gallery cannot be scripted.',
    'Extension manifest must request permission to access this host.',
    'Cannot access contents of url "chrome://extensions/".',
  ])('explains the block for: %s', (message) => {
    const result = describeInjectionFailure(new Error(message));
    expect(result).toContain("can't run on this page");
  });

  it('points at the file-access toggle when a file: URL is blocked', () => {
    const result = describeInjectionFailure(
      new Error('Cannot access contents of the page.'),
      'file:///Users/me/form.html'
    );
    expect(result).toContain(FILE_ACCESS_HINT);
  });

  it('falls back to the generic message for an unrelated failure', () => {
    expect(describeInjectionFailure(new Error('Frame with ID 0 was removed.'))).toBe(
      'Fill failed — try reloading the tab'
    );
  });

  it('handles a non-Error rejection', () => {
    expect(describeInjectionFailure('cannot access this page')).toContain("can't run on this page");
  });
});
