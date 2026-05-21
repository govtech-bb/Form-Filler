# Form Filler Extension — Design Spec

**Date:** 2026-05-20  
**Status:** Approved

---

## Context

Developers and QA testers repeatedly fill out web forms by hand during testing cycles. This is slow, error-prone, and particularly painful for forms with many fields or unusual field labels. This extension automates that process: one keypress fills every field on the page with realistic fake data, including contextually appropriate values for non-standard fields (e.g. "testimonial", "reason for selling goods").

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Browser target | Chrome / Chromium (MV3) | Single-browser simplicity; covers Chrome, Edge, Brave |
| Build tooling | Vite + TypeScript + `@crxjs/vite-plugin` | Modern DX, type safety, HMR without framework overhead |
| Trigger | Hotkey (`Ctrl+Shift+F`) + toolbar popup button | Hotkey for speed; popup for settings access |
| Data generation | Hybrid: rules engine → Claude Haiku fallback | Local rules cover ~95% of fields instantly; AI handles the rest |
| AI provider | Claude Haiku (Anthropic API) | Fast, cheap, user supplies their own API key |
| Fill behavior | Immediate (no preview step) | Maximum speed for repeated testing cycles |
| User profiles | Single default profile | Simplicity; no identity switching needed |

---

## Architecture

Four components communicate via `chrome.runtime.sendMessage`:

```
Browser Page (DOM)        Toolbar
      ↕ inject/fill          ↕ trigger/status
  Content Script  ←——————→  Service Worker
  content/index.ts           background/index.ts
  • Scan form fields          • Chrome commands API
  • Extract labels            • Rules engine
  • Apply values              • Claude API calls
  • Fire input/change events  • AI response cache
        ↓                           ↓
   (direct DOM)            Faker-js + Claude Haiku
```

### Message flow (hotkey press)

1. Chrome command event → service worker receives `"fill"` action
2. Service worker sends `"extractFields"` to content script on active tab
3. Content script returns `FieldMeta[]`: `{id, name, label, type, options[]}`
4. Service worker runs rules engine against each field
5. Unmatched fields are batched into a single Claude Haiku API call
6. Service worker returns `Record<fieldId, value>` map to content script
7. Content script sets values and dispatches `input` + `change` events

---

## Field Detection

For each `<input>`, `<select>`, `<textarea>`, the label is resolved using this priority chain (first match wins):

1. `aria-label` / `aria-labelledby`
2. `<label for="id">` association
3. Wrapping `<label>` parent element
4. Preceding sibling text / `<p>` / `<span>`
5. `placeholder` attribute
6. `name` / `id` attribute (normalized: camelCase/snake_case → words)

Resolved label text is lowercased and stripped of punctuation before rule matching.

---

## Data Generation

### Step 1 — Field type handling (before label matching)

| Type | Behaviour |
|---|---|
| `select` | Pick the 2nd non-blank `<option>`; if only one option exists, pick it |
| `checkbox` (group) | Check the first checkbox only |
| `checkbox` (single) | Check it |
| `radio` | Select the first option in the group |
| `date` / `datetime-local` | Random past date within last 30 years |
| `number` | Random integer within `min`/`max` (default 1–100) |
| `file` | Skip — cannot be filled programmatically |

### Step 2 — Rules engine (~40 patterns, local, instant)

Labels are matched via case-insensitive substring or regex. Representative rules:

| Pattern | Faker call |
|---|---|
| `first name`, `fname`, `given name` | `faker.person.firstName()` |
| `last name`, `lname`, `surname` | `faker.person.lastName()` |
| `email` | `faker.internet.email()` |
| `phone`, `mobile`, `tel` | `faker.phone.number()` |
| `address`, `street` | `faker.location.streetAddress()` |
| `city` | `faker.location.city()` |
| `state`, `province`, `county` | `faker.location.state()` |
| `zip`, `postal` | `faker.location.zipCode()` |
| `country` | `faker.location.country()` |
| `company`, `organisation`, `organization` | `faker.company.name()` |
| `job`, `title`, `position`, `role` | `faker.person.jobTitle()` |
| `website`, `url` | `faker.internet.url()` |
| `username` | `faker.internet.username()` |
| `password`, `confirm password` | `"TestPassword123!"` |
| `age` | Random integer 18–65 |
| `dob`, `date of birth`, `birthday` | `faker.date.birthdate()` |
| `bio`, `about`, `description` (textarea) | `faker.lorem.paragraph()` |
| `message`, `comment`, `note`, `feedback` | `faker.lorem.paragraph()` |
| `gender` | `"Male"` |
| `nationality` | `faker.location.country()` |

### Step 3 — Claude Haiku fallback (unmatched fields only)

All unmatched field labels are batched into a single API request:

```
You are filling a web form with realistic fake data for testing.
Return a JSON object mapping each field label to an appropriate fake value.
Be concise — values should be realistic but brief.

Fields: ["testimonial", "reason for selling goods"]
```

Responses are cached in `chrome.storage.local` keyed by label text to avoid redundant API calls across page reloads.

---

## Popup UI

Three views within a 220px-wide popup:

**Default view**
- Extension logo + name
- Primary CTA: "⚡ Fill All Fields" button
- Hint: "or press Ctrl+Shift+F"
- Last fill status (field count, AI usage)
- API key status indicator + "Settings →" link

**After fill**
- Same layout; status updates to "✓ 8 fields filled (2 via AI)"

**Settings view**
- Back navigation
- Claude API key input (masked)
- Shortcut display (with link to `chrome://extensions/shortcuts`)
- "Clear AI cache" action

---

## File Structure

```
form-filler/
├── manifest.json             # MV3 manifest
├── vite.config.ts
├── package.json
├── tsconfig.json
├── src/
│   ├── background/
│   │   └── index.ts          # service worker: hotkey, rules, AI calls
│   ├── content/
│   │   └── index.ts          # injected: field scan, label extraction, apply values
│   ├── popup/
│   │   ├── index.html
│   │   └── index.ts          # fill button, status, settings view
│   └── shared/
│       ├── rules.ts           # ~40 label → faker mappings
│       ├── fieldExtractor.ts  # 6-level label detection
│       └── types.ts           # FieldMeta, FillResult, StoredSettings
└── tests/
    └── rules.test.ts          # unit tests for rules engine
```

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `vite` | Build tooling |
| `@crxjs/vite-plugin` | MV3 extension bundling + HMR |
| `typescript` | Type safety |
| `@faker-js/faker` | Local fake data generation |
| `vitest` | Unit testing (rules engine) |

---

## Verification

1. Load unpacked extension in `chrome://extensions` after `npm run build` (or `npm run dev` for HMR)
2. Navigate to any form-heavy page (e.g. a signup form)
3. Press `Ctrl+Shift+F` — all standard fields should fill within ~200ms
4. Navigate to a form with non-standard labels — fields should fill after a short AI call delay
5. Open popup → Settings → enter a Claude API key → verify key persists across browser restarts
6. Verify React/Vue-managed inputs update (inspect state, not just DOM value)
7. Run `npm test` — rules engine unit tests pass
