# ADR-004: Generating cards with the user's own agent

- Status: accepted
- Date: 2026-10-28
- Deciders: owner

## Context

ownship is free, so it cannot pay for a model. Cards about business logic and design decisions need a capable model, and the user already pays for one, or runs a free one. The agent they already use can also read code, search the web and reach internal docs with permissions they granted.

## Decision

- **The generator is a command template** in the config. ownship ships presets for Claude Code and Codex and prefers the agent that produced the turn. Any other command can be configured. Output must match a JSON schema; Claude Code (`--json-schema`) and Codex (`--output-schema`) enforce it, and other commands are validated and retried once.
- **Presets carry the anti-recursion flags**: `claude -p --no-session-persistence --tools "" …` and `codex exec --ephemeral --disable hooks -s read-only …`, plus `OWNSHIP_GENERATING=1`, which the ownship hook and readers check. Otherwise ownship would make cards about its own runs.
- **No tools by default.** The generator sees only the filtered turn and the repo's knowledge notes. **Research mode**, enabled per repo, turns tools on so it can read the repo, the web and internal docs; it shapes questions and explanations, but card evidence must still come from the turn.
- **Volume**: 0 to 3 cards per completed turn, including turns with no code changes; 10 new cards a day by default; queue newest first, turns expire after 7 days; scheduled reviews are never capped.

## Alternatives not taken

- **A bundled local model as the default**: free and private, but small models write worse questions, and the user's agent is already authorized for that code.
- **ownship's own retrieval and connectors**: rebuilds what the user's agent already does.
- **Generating once per session**: sessions have no reliable end, and cards would arrive late.

## Consequences

- Generation spends the user's subscription limits; the daily cap bounds it.
- Anthropic has said `claude -p` will default to `--bare`, which stops using the subscription login. The template must let the user switch to an API key or the other agent; watch the changelog.
- Before anything is sent: `.gitignore`, `.ownshipignore`, lockfiles and generated files are dropped, and hunks with secret-scan findings are removed.
