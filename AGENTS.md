# ownship: agent guide

ownship turns what a coding agent just did into short review cards about that work, scheduled with FSRS and served to the phone and the desktop. It is one Node package: a CLI, an on-demand daemon, per-agent session readers, a generator that shells out to the user's own agent, and a Vue review app. This file is an index: each rule points to the tool that enforces it.

## Commands

- `pnpm install`: install dependencies and the git hooks (lefthook).
- `bin/check`: the fast gate (ESLint, Prettier, `tsc`, `vue-tsc` once `app/` exists, Vitest, `bin/guard.mjs`). The Stop hook runs it after each turn.
- `bin/ci`: everything CI runs, adding the build and gitleaks; `git push` runs it. **You are done only when it is green.**
- `pnpm vitest run <path>`: one test file. `pnpm lint`, `pnpm format`, `pnpm typecheck`.

## Map

- `docs/specs/2026-10-28-ownship-v1-design.md`: what v1 is. `docs/plans/`: how it is being built. `docs/adr/`: decisions. `docs/research/`: evidence, including `agent-capture-survey.md` for agent log formats and `versions.md` for pinned versions.
- `src/`: the package. `test/`: Vitest tests, mirroring `src/`. `test/fixtures/`: recorded agent sessions from toy repos only.
- `.claude/`, `.codex/hooks.json`, `lefthook.yml`, `bin/`: the harness (ADR-008).

## Rules

1. **English for everything in the repo**: code, docs, commits, PRs, logs and errors. Conversations with agents can be in any language.
2. **No literal user-facing copy** (ADR-008). It goes in `app/i18n/en.json` and `es.json` together; a test fails when their keys differ.
3. **Conventional Commits**, one concern each, with no AI co-author trailers (the `commit-msg` hook rejects both).
4. **Never silence a check.** No `eslint-disable`, `@ts-ignore`, `@ts-expect-error` or `@ts-nocheck` (ESLint rejects them), no `--no-verify`, no new ignores in `eslint.config.js`, `.prettierignore` or `pnpm-workspace.yaml`. Fix the cause.
5. **Never delete, skip or loosen a test to get green** (`bin/guard.mjs`). The same goes for the harness (`bin/`, `lefthook.yml`, `.claude/`, `.codex/`, `.github/`, linter, type and test configs, the `package.json` scripts). The `Guard-Override:` trailer is for humans only.
6. **Write the failing test first**, and run it to see it fail for the right reason.
7. **Never put private code in fixtures.** Record agent sessions in a throwaway repo with toy content (see `test/fixtures/README.md`).
8. **Never touch the user's git index, stash, branches or working tree, and never read agent auth files** (spec, Constraints). Snapshots use a temporary index.
9. **pnpm only**, and new dependencies need a reason in `docs/research/versions.md` with an official source. pnpm enforces a 1-day minimum release age and refuses trust downgrades.
10. **If a rule gets in the way, propose an ADR.** Do not break it, weaken a check, or skip a hook.
