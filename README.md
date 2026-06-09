# Form Filler

A Chrome (Manifest V3) browser extension that instantly fills form fields on any page with realistic, locally-generated fake data — built for testing forms quickly.

## Features

- **Smart label-based field detection** — fields are matched by their normalized label/name (handling camelCase, snake_case, and kebab-case) to choose an appropriate value.
- **Barbados / GovBB-localized values** — phone numbers (`1-246-xxx-xxxx`), postcodes (`BBxxxxx`), national ID (`xxxxxx-xxxx`), National Insurance / NIS, and TAMIS reference numbers.
- **Split day/month/year date detection** — recognizes date triplets rendered as separate inputs and fills all three parts from the same generated date.
- **Constraint-aware values** — respects HTML `pattern`, `maxlength`, and `minlength` (plus minimums stated only in hint/validation text), generating values that fit.
- **Confirm-email reuse** — a "confirm/re-enter email" field reuses the email already generated for the matching field instead of a fresh, mismatched one.
- **Auto-correction on validation error** — after a fill, a `MutationObserver` watches for validation errors and repairs the offending values (e.g. stripping characters a "letters only" rule forbids, or regenerating from the error hint).
- **Test Validation Mode** — deliberately fills fields with data that should *fail* validation, cycling through one broken rule per fill (invalid format → below minimum → above maximum → out of range → empty) so you can exercise a form's error states.
- **Fully local** — all data is generated on-device with [faker](https://github.com/faker-js/faker). No network requests, no AI service, no API keys.

## Install / Build

The project uses **pnpm** (a `pnpm-lock.yaml` and `pnpm-workspace.yaml` are committed). `npm` also works if you prefer it (there is a `package-lock.json`).

```bash
pnpm install
pnpm build
```

The build (Vite + `@crxjs/vite-plugin`) emits the unpacked extension to the Vite build output directory, `dist/`.

Then load it into Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `dist/` directory.

For active development, use watch-mode rebuilds:

```bash
pnpm dev
```

(`npm install`, `npm run build`, and `npm run dev` are equivalent.)

## Usage

- Click the **Form Filler** toolbar icon, then **Fill All Fields** — or press **Ctrl+Shift+F** (the same keys on Windows, macOS, and Linux).
- Toggle **Test Validation Mode** from the popup's **Settings** view, or with **Ctrl+Shift+X**.

> On macOS the binding uses the physical **Ctrl** key (not ⌘). If a shortcut ever does nothing, another extension may have claimed it — reassign it at `chrome://extensions/shortcuts`.

The popup shows the result of the last fill (fields filled and how long ago).

## Testing

```bash
pnpm test
```

Unit tests run with [Vitest](https://vitest.dev/) (`vitest run`). Use `pnpm test:watch` for watch mode.

## Project layout

```
src/
  shared/        Field extraction + value generation (framework-agnostic, unit-tested):
                 rules.ts, valueGenerator.ts, types.ts
  content/       DOM read/write (extract fields, apply values) + on-page toast
  background/    Service-worker orchestration: fill flow, keyboard commands,
                 test-validation mode, validation-error auto-correction
  popup/         Popup UI (Fill button, settings, test-mode toggle)
tests/           Vitest unit tests
docs/
  plans/         Implementation plans
  specs/         Design specs (under docs/superpowers/)
  decisions/     Architecture decision records (e.g. local-only fake data)
  summaries/     Per-session change summaries
```

## Privacy

All fake data is generated locally with faker; the extension makes no network requests and uses no AI service. See [`docs/decisions/0001-local-only-fake-data-generation.md`](docs/decisions/0001-local-only-fake-data-generation.md) for the rationale.
