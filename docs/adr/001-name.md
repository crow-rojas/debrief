# ADR-001: Name

- Status: accepted
- Date: 2026-10-28
- Deciders: owner

## Context

The project started as `debrief`. On npm, `debrief` is an unrelated serialization library (1.5.0, last modified 2022) and the `debrief` organization is not available, so neither `npx debrief init` nor `@debrief/cli` works.

## Decision

The project is **ownship**: own what you ship. In aviation, *ownship* is the symbol for your own aircraft on a traffic display, knowing where you are among everything else. It fits the tagline, "Understand what your coding agent ships under your name".

- npm package `ownship` (unscoped, free on 2026-10-28), command `ownship`, installed with `npx ownship init`.
- GitHub repo `crow-rojas/ownship`, renamed from `crow-rojas/debrief` by the owner; GitHub redirects the old URL.
- No npm or GitHub organization until there are other maintainers. `github.com/ownship` belongs to someone else.

## Alternatives not taken

- `debriefer`: keeps the old brand, but `ownship` says what the product is for.
- `backbrief` (the military practice of explaining an order back to show it was understood): a strong fit, kept as a second choice.
- `teachback` (the clinical teach-back method): free on npm, but several apps already use the name, including an AI "learn by teaching" product.
- `readback`, `debrief-cli`, `recallr`, `meanwhile`, `afterword`: taken on npm.

## Consequences

- Everything in the repo says ownship. `docs/brainstorm-prompt.md` keeps the old name as a record of how the project started.
- Environment variables, paths and schemas use the `ownship` prefix (`OWNSHIP_GENERATING`, `~/.ownship/`, `ownship.turn/1`).
