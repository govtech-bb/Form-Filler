# Detect split date triplets rendered as text inputs

Date: 2026-06-02
Plan: [docs/plans/fix-split-date-triplet-detection.md](../plans/fix-split-date-triplet-detection.md)

## What changed

`preprocessDateTriplets` in `src/shared/fieldExtractor.ts` now recognizes split
Day/Month/Year date fields that are rendered as `<input type="text">` with
`inputmode="numeric"`, not just `<input type="number">`. On the GovBB alpha site
these boxes are text inputs, so the triplet was never grouped and each part fell
through to the generic free-text filler — producing lorem words like
`decipio urbanus apud…` in a date box.

## Why it looks this way

The detection machinery was already correct end to end: `findDatePartLabel`
resolves "Day"/"Month"/"Year" via the `label[for]` association, the ancestor-walk
groups the three parts under one `dateGroupId`, `generateValue` emits a coherent
shared date, and `applyValues` writes text inputs via the native setter. The only
gap was the candidate pool: it queried `input[type="number"]` exclusively, so the
alpha site's text inputs never entered it.

Fix: a single `DATE_PART_INPUT_SELECTOR` constant
(`number, text, tel, no-type, inputmode="numeric"`) used at both query sites
(initial scan + month/year ancestor lookup). Casting the net this wide is safe
because two guards already gate tagging — `findDatePartLabel` only accepts an
exact "day"/"month"/"year" label, and grouping requires all three co-located in a
shared ancestor. A lone text field labelled "Day" stays untagged (regression
test added for this).

No zero-padding: parts stay unpadded (`String(getUTCDate())` → `"5"`), confirmed
the alpha form does not expect padding.

## Notable detour — AI was proposed and rejected

When the fix appeared not to work, reintroducing an embedded AI was floated. Two
reasons it was the wrong tool: (1) this is a *detection* problem, not a
value-generation one — an AI would read field metadata from the same extraction
code, so if extraction doesn't tag the triplet the AI gains nothing; (2) it would
reverse [decision 0001 (local-only fake-data generation)](../decisions/0001-local-only-fake-data-generation.md).

The real cause was mundane: the fix lived in the `fix/split-date-triplet`
worktree and only that worktree's `dist/` had been rebuilt. The extension was
loaded from the main repo's stale `dist/`, so "Reload" kept re-serving the old
build. Confirmed by grepping the built bundles for the new selector string —
present in the worktree dist, absent in main's. Loading the worktree `dist/`
made it work. Decision 0001 stands, reaffirmed.

## Verification

- Full suite 169/169 green (added an alpha-markup triplet test with dotted IDs +
  bracketed names, and a negative lone-"Day" guard test).
- `vite build` clean.
- Confirmed working in the live GovBB alpha redirection form (Day/Month/Year fill
  with a coherent numeric date).
