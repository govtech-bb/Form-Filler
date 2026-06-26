# 0005 — pnpm is the only package manager

Date: 2026-06-26
Status: Accepted

## Principle

This repo uses **pnpm exclusively** and commits a **single lockfile**
(`pnpm-lock.yaml`). Do not reintroduce `package-lock.json` or install with npm.
Security `overrides` for transitive dependencies live in **`pnpm-workspace.yaml`**.

## Context

The project previously committed both `pnpm-lock.yaml` and `package-lock.json`, and the
README said "npm also works if you prefer it." Two problems surfaced while clearing the
issue #5 Dependabot alerts:

- **Two lockfiles double every alert.** Dependabot scans each lockfile independently, so
  every advisory was reported twice (14 alerts for 7 unique advisories), and the two
  trees can drift.
- **Overrides are pnpm-only.** Several advisories were in transitive dependencies that
  the direct version bumps did not reach (`rollup` pinned inside `@crxjs/vite-plugin`,
  `form-data` via `jsdom`, and a vulnerable `vite` 5 dragged in by `vitest` 3). The fix
  is package-manager `overrides`. npm's `overrides` field is a separate mechanism that
  this repo does not maintain — installing with npm would regenerate `package-lock.json`
  **without** the security pins, silently restoring the patched-away vulnerabilities.

Note: as of pnpm v10+, `overrides` are read from `pnpm-workspace.yaml`, **not** the
`pnpm` field in `package.json` (pnpm v11 silently ignores the latter).

## Decision

- `pnpm-lock.yaml` is the only committed lockfile. `package-lock.json` is deleted and
  must not return.
- All transitive-dependency `overrides` go in `pnpm-workspace.yaml`.
- Contributors and CI install and build with pnpm.

## Consequences

- A single source of truth for the dependency tree; Dependabot reports each advisory
  once.
- Security overrides are guaranteed to apply, because the only supported install path is
  the one that reads them.
- Any future need to pin a transitive dependency (security or otherwise) is expressed as
  a `pnpm-workspace.yaml` override — never as an npm `overrides` block or a second
  lockfile.
