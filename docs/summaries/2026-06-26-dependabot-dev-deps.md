# Clear Dependabot dev-dependency alerts (issue #5)

Date: 2026-06-26

## Context

Pushing the issue #3 fix surfaced 14 open Dependabot alerts (2 critical, 6 high, 6
moderate), all on `development` dependencies — nothing in the shipped extension. Issue
#5 tracked clearing them. Planning established the shape: minimal-to-clear major bumps
(Vite 6.4.3, Vitest 3.2.6) plus a move to a single lockfile.

## What changed

- `package.json`: `vite ^5.2.0 → ^6.4.3`, `vitest` + `@vitest/coverage-v8 ^2.0.0 → ^3.2.6`.
- `pnpm-workspace.yaml`: `overrides` for `vite ^6.4.3`, `@crxjs/vite-plugin>rollup 2.80.0`,
  `form-data ^4.0.6`.
- Deleted `package-lock.json`; corrected the README package-manager note.
- Decision `0005-pnpm-is-the-only-package-manager`.
- Commit `15dec8e` (deps). Branch `worktree-issue-5-dependabot-dev-deps`, merges to `main`.

## Why it looks this way

**The plan's "just bump vite + vitest" was too optimistic — two things the dependency
tree only revealed at install time forced a wider fix:**

1. **Vitest 3 drags in a vulnerable Vite 5.** After bumping the direct `vite` to 6.4.3,
   `pnpm why vite` still showed `vite@5.4.21`, pulled transitively by Vitest 3's
   `@vitest/mocker`. Vite 5 is inside the advisory's vulnerable range (`<= 6.4.2`), so
   the alert would have survived. It also carried `esbuild@0.21.5`, the source of the
   esbuild alert. A global `vite: ^6.4.3` override collapses both — forcing the
   transitive copy up removes the old Vite *and* its old esbuild in one move. (Vitest 3
   officially supports Vite 6, and the 207-test run confirms it.)

2. **The rollup advisory is inside crxjs, not Vite.** `@crxjs/vite-plugin` pins
   `rollup@2.79.2` in its own dependencies. Vite's own rollup is 4.x and not flagged. The
   override is therefore *scoped* (`@crxjs/vite-plugin>rollup`) so it bumps only crxjs's
   copy to the 2.80.0 security patch and leaves Vite's rollup 4 alone — a global `rollup`
   override would have dragged Vite's rollup down to 2.80.0 and broken the build.

**Overrides had to move files.** The first attempt put `pnpm.overrides` in `package.json`
and pnpm v11 silently ignored it (warning: "the `pnpm` field is no longer read"). pnpm
v10+ reads `overrides` from `pnpm-workspace.yaml`. That relocation, plus the npm-vs-pnpm
override incompatibility, is what made "pnpm-only" a decision worth recording (0005)
rather than just a cleanup.

**Why pnpm-only, not "keep both lockfiles."** Two lockfiles doubled every alert and let
the trees drift, and — decisively — npm would not apply the security overrides, so an
`npm install` would quietly reintroduce the vulnerabilities. Single lockfile, single
install path that actually carries the pins.

**Minimal-to-clear over latest.** Latest is Vite 8 / Vitest 4; we stopped at 6.4.3 /
3.2.6 because those clear every alert with the smallest major jump and least breakage
risk. The driver was the alerts, not currency.

## Open questions

- Not loaded unpacked in a real browser this session (Chrome isn't drivable here).
  Verified via `pnpm test` (207) and a clean `pnpm build` producing a valid `dist/`
  under Vite 6. A quick real-browser smoke before the next store upload is worthwhile.
- These were all dev-only advisories; no runtime dependency was affected.
