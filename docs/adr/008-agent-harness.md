# ADR-008: Agent harness and i18n

- Status: accepted
- Date: 2026-10-28
- Deciders: owner

## Context

Agents will write most of ownship. Their usual failures are silencing a check, deleting or skipping the failing test, and adding packages that are new or do not exist. `~/dev/rails-vue-starter` already solved this for a Rails app (its ADR-002), but ownship cannot require Ruby.

## Decision

Port the starter's harness, translated to Node:

| Moment                                                              | What runs                                                                                            |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| After each agent edit                                               | ESLint then Prettier on that file, autocorrecting                                                    |
| `git commit` (lefthook)                                             | Linters on staged files, gitleaks on the staged diff, Conventional Commits, no AI co-author trailers |
| End of each agent turn (Claude Code Stop hook, `.codex/hooks.json`) | `bin/check`: ESLint, `tsc`, `vue-tsc`, tests, `bin/guard`                                            |
| `git push` and GitHub Actions                                       | `bin/ci`; pushes to `main` refused                                                                   |

- `CLAUDE.md` identical to `AGENTS.md`: an index where each rule names the tool that enforces it.
- `bin/guard` in Node: fails when the test count drops, new skips appear, or the harness changes without a human `Guard-Override:` trailer.
- `.claude/settings.json` deny rules, the `main` ruleset, a pull request size check, ADRs, and `docs/research/versions.md` with a source and a cooldown for every dependency.
- **i18n from day one**: no literal UI copy; English and Spanish locale files change together, and a check fails on missing, unused or literal strings. Cards are not i18n: the generator writes them in the configured language.

Not ported: Kamal, Postgres, strong_migrations, prosopite, Typelizer, Brakeman.

## Consequences

- `bin/check` must stay fast; when it passes 30 s, split it or reopen this ADR.
- Adding i18n later would mean hunting literals across the app; doing it now costs one locale file per language.
