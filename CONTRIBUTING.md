# Contributing

Thanks for taking the time. ownship tries to stay small: a change should help someone understand the work their agent ships, or keep agent-written code honest.

## Principles

- **Rules are checks.** A convention that matters gets a tool that enforces it, listed in [`AGENTS.md`](AGENTS.md). A rule that only lives in prose gets broken.
- **Local first.** Nothing leaves the user's machine except what their own agent sends to its provider ([ADR-007](docs/adr/007-privacy-and-access.md)). A change that sends more needs an ADR.
- **Fast checks.** A commit takes about a second and `bin/check` a few seconds. A change that makes them much slower needs a good reason.
- **Few dependencies.** A new package needs a reason and an official source in [`docs/research/versions.md`](docs/research/versions.md). pnpm only accepts packages published at least a day ago and refuses trust downgrades.
- **Less is more.** Before adding an option, ask whether someone needs it today. The smaller diff that solves the problem wins.

## Development

You need Node 22.15 or newer and pnpm.

```sh
pnpm install       # dependencies and the git hooks
bin/check          # the fast check: lint, types, tests and the guard
bin/ci             # everything CI runs, plus the build and gitleaks
pnpm build         # the app into dist/app and the CLI into dist/src
```

To try the built CLI without touching your own setup, point it at temporary directories:

```sh
OWNSHIP_HOME=$(mktemp -d) CLAUDE_CONFIG_DIR=$(mktemp -d) CODEX_HOME=$(mktemp -d) node dist/src/cli.js init --no-open
```

[`AGENTS.md`](AGENTS.md) lists the rest of the commands and where things live. Read it even if you are not an agent.

## Code style

- ESLint and Prettier decide formatting, and the git hooks run them. Don't silence a check inline: fix the cause or propose a change to the rule.
- Code, docs, commits and pull requests are in English. User-facing copy goes in `app/i18n/en.json` and `es.json` together, never in a component or in the CLI code. Spanish copy is neutral Spanish, without regional idioms.
- Comments explain why, never what.
- Agent session fixtures are synthetic and use toy content only ([`test/fixtures/README.md`](test/fixtures/README.md)). Never commit a real transcript.

## Pull requests

1. One change per pull request, with the problem it solves. Commits follow [Conventional Commits](https://www.conventionalcommits.org).
2. `bin/ci` passes.
3. Bug fixes start with a failing test.
4. UI changes include before and after screenshots.
5. A change to a decision updates its ADR in the same pull request.

Changes to the harness itself (`bin/`, `lefthook.yml`, `.claude/`, `.codex/`, the workflows, and the linter, type and test configs) fail `bin/guard.mjs` until the maintainer reviews them and adds a `Guard-Override:` trailer. Say why in the description.

## Reporting a bug

Open an issue with what you expected, what happened, the steps to reproduce it, your OS, `node -v`, the agent and its version (`claude --version` or `codex --version`), and the output of `ownship status`. Relevant lines from `~/.ownship/capture.log` and `~/.ownship/daemon.log` help, with any private code removed.

Security issues go through [SECURITY.md](SECURITY.md), not public issues.
