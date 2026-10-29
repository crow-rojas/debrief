# Roadmap

What ownship has, what comes next and what is further out. There are no dates: items move up as earlier ones land. Each item links to the decision or research behind it when there is one. To suggest a change, open an issue.

## Done

- **v1, the first loop.** Claude Code and Codex turns become cards about that exact work: capture from the agents' own session logs, a git snapshot per turn, cards written by your own agent with every quote checked against the turn, FSRS scheduling, knowledge notes from cards you flag as wrong, and a review app for the phone and the desktop in English and Spanish ([spec](docs/specs/2026-10-28-ownship-v1-design.md), [ADRs](docs/adr/)).
- **Setup in one step.** `ownship init` picks the language, installs the hooks, starts the daemon, opens the app already paired and shows the phone QR over Tailscale. `open`, `stop`, `uninstall` and `config` cover the rest.
- **On npm.** `npx ownship init` works without cloning the repo, and the repository is `crow-rojas/ownship` ([ADR-001](docs/adr/001-name.md)).

## Now

- **A home and navigation.** Today the app is a single review screen. It needs a start page with what is due, a view per repo, your knowledge notes and a sense of progress.
- **Design and motion.** A deeper pass on layout, typography and short animations that show what changed. Progress shows mastery (what you can now explain about each repo, retention after a week), not streaks: punishing a missed day is an explicit non-goal ([spec](docs/specs/2026-10-28-ownship-v1-design.md#anti-goals)).

## Next

- **Notifications** when there are cards and you are likely idle: ntfy first, web push once the app is an installed PWA over HTTPS ([ADR-007](docs/adr/007-privacy-and-access.md)).
- **More agents**: Gemini CLI and OpenCode readers first, then Cursor and Copilot CLI, each with fixtures per version ([agent capture survey](docs/research/agent-capture-survey.md)).
- **More card kinds**: an injected "find the bug" validated by a test, and an explain-it-in-your-words exercise graded against a rubric as a suggestion, never as a grade ([research](docs/research/learning-while-agents-code.md#recommendations-mvp-and-roadmap)).
- **Export** to Obsidian-compatible Markdown and to Anki.
- **Windows**, tested rather than assumed.

## Later

- Short animated walkthroughs of execution flows, "review the agent's PR" sessions, and interleaving concepts that are easy to confuse.
- Optional text to speech, third-party plugins (agent readers, card kinds, language packs) and a team mode with opt-in, aggregate metrics.

## Known issues

Small problems found in review and left for later:

- An answered card can reappear if the session reloads before the answer is saved.
- Writing a snapshot and its turn, and storing cards and marking their turn, are not single transactions.
- A Claude Code compaction summary may start a turn of its own.
- The Codex reader rereads a whole rollout to get its first line.
- Each snapshot rehashes the whole working tree, which is slow on very large repos.
- Codex generation fails when your Codex config selects a model your account cannot use; set another model for it.
