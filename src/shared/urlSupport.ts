// Now that the extension is allowed on every site, users will inevitably press the
// shortcut on a page Chrome will never let an extension touch — its own
// `chrome://` pages, the Web Store, another extension's pages. Injection there
// fails with an opaque platform error and no content script exists to toast, so
// the popup is the only place a reason can surface. These helpers turn "it did
// nothing" into a sentence that says why.

// Schemes a content script can be injected into at all. `file:` additionally needs
// the per-extension "Allow access to file URLs" toggle, which only the user can
// grant — see FILE_ACCESS_HINT.
const INJECTABLE_SCHEMES = ['http:', 'https:', 'file:', 'ftp:'];

// Chrome's own surfaces, keyed by scheme. Nothing the extension does can unblock these.
const BLOCKED_SCHEME_REASONS: Record<string, string> = {
  'chrome:': 'Chrome blocks extensions on its own browser pages.',
  'chrome-untrusted:': 'Chrome blocks extensions on its own browser pages.',
  'devtools:': 'Chrome blocks extensions on DevTools pages.',
  'chrome-extension:': 'Chrome blocks extensions from filling extension pages.',
  'moz-extension:': 'Chrome blocks extensions from filling extension pages.',
  'edge:': 'The browser blocks extensions on its own pages.',
  'brave:': 'The browser blocks extensions on its own pages.',
  'vivaldi:': 'The browser blocks extensions on its own pages.',
  'about:': 'There is no page here to fill.',
  'view-source:': "This is a page's source view, not a form.",
  'data:': 'Chrome blocks extensions on data: URLs.',
};

export const FILE_ACCESS_HINT =
  'To fill local files, enable "Allow access to file URLs" for Form Filler at chrome://extensions.';

function schemeOf(url: string): string | null {
  // Not every URL Chrome reports parses as a `URL` (view-source:https://… does
  // not), so read the scheme off the front rather than relying on the parser.
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim());
  return match ? match[1].toLowerCase() + ':' : null;
}

// The Web Store is served over https but is scripting-blocked all the same.
function isWebStore(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.startsWith('https://chromewebstore.google.com/') ||
    lower.startsWith('https://chrome.google.com/webstore')
  );
}

/**
 * A user-facing reason this page can never be filled, or `null` if it can be.
 *
 * An unknown URL returns `null` on purpose: Chrome withholds `tab.url` on pages
 * the extension has no access to, and refusing to try on a URL we simply cannot
 * read would break ordinary pages. `describeInjectionFailure` is the net that
 * catches those.
 */
export function describeUnsupportedUrl(url: string | undefined | null): string | null {
  if (!url) return null;

  const scheme = schemeOf(url);
  if (scheme === null) return null; // relative/opaque — let the normal flow try

  const blocked = BLOCKED_SCHEME_REASONS[scheme];
  if (blocked) return `Form Filler can't run on this page — ${blocked}`;

  if (!INJECTABLE_SCHEMES.includes(scheme)) {
    return `Form Filler can't run on ${scheme}// pages.`;
  }

  if (isWebStore(url)) {
    return "Form Filler can't run on this page — Chrome blocks extensions on the Web Store.";
  }

  return null;
}

// Errors Chrome raises when a host is off-limits — either a privileged page or,
// for file: URLs, the file-access toggle being off.
const NO_ACCESS_RE =
  /cannot access|cannot be scripted|must request permission|extensions gallery|showing error page|chrome:\/\//i;

/**
 * Translate a `chrome.scripting.executeScript` rejection into something readable.
 * Covers the pages `describeUnsupportedUrl` cannot recognise because Chrome hid
 * their URL from us.
 */
export function describeInjectionFailure(error: unknown, url?: string | null): string {
  const message = error instanceof Error ? error.message : String(error);

  if (NO_ACCESS_RE.test(message)) {
    if (schemeOf(url ?? '') === 'file:') {
      return `Form Filler can't run on this file. ${FILE_ACCESS_HINT}`;
    }
    return "Form Filler can't run on this page — Chrome blocks extensions on browser, Web Store and extension pages.";
  }

  return 'Fill failed — try reloading the tab';
}
