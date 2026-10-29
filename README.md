# ownship

Understand what your coding agent ships under your name.

While your agent works, ownship turns its last turn into a few short cards about that work, schedules them with spaced repetition (FSRS) and serves them to your phone and your desktop. It runs on your machine, writes the cards with the agent you already use, and keeps your code local.

**Status:** v1, for Claude Code and Codex. macOS and Linux are tested; Windows should work and is untested.

## Install

```sh
npx ownship init
```

`init` needs Node 22.15 or newer and `claude` or `codex` on your PATH. In one step it:

- picks English or Spanish from your locale (change it with `ownship config language es`),
- adds a Stop hook to `~/.claude/settings.json` and `~/.codex/hooks.json`, after backing each file up (`--no-hooks` skips this; Codex runs a new hook only after you approve it with `/hooks`),
- starts the local daemon and opens the app in your browser, already paired (`--no-open` skips that),
- and, when Tailscale is running, shows a QR for your phone over HTTPS. The first time, Tailscale may ask you to enable Serve for your tailnet; `init` prints its link.

```sh
ownship open        # open the app, paired, in your browser
ownship pair        # a QR for your phone: Tailscale if you have it, otherwise your local network
ownship status      # the daemon, the hooks, the queue, cards due and the last generator error
ownship config      # show the settings; ownship config <key> <value> to change language, dailyNewCards or port
ownship stop        # stop the daemon (start brings it back; the hook also starts it on the next turn)
ownship uninstall   # remove the hooks and stop the daemon; --purge also deletes ~/.ownship
```

## How it works

1. When your agent finishes a turn, ownship reads that turn from the agent's own session log (your prompt and the agent's visible messages) and takes a snapshot of your working tree with git to get the diff. It never touches your git index, stash or branches.
2. It asks your own agent, in non-interactive mode and with no tools, for 0 to 3 cards about the turn: why a decision was made, a multiple-choice question, a short answer or a number.
3. Every card must quote the turn, and ownship throws away any card whose quotes are not in it.
4. You review on your phone or at `http://127.0.0.1:47821`. FSRS brings each card back right before you would forget it. At most 10 new cards a day.
5. When a card is wrong, say so and write what is actually true. ownship saves the note in `~/.ownship/knowledge/<repo>/`, and later cards for that repo take it into account.

## Privacy defaults

- The database, your notes and the session logs never leave your machine. Your phone only receives cards and their snippets, never repo files or transcripts.
- What reaches a model is what your own agent receives as generator input: the turn's prompt, messages and diff, without `.gitignore`d files, files in `.ownshipignore`, lockfiles, generated files and hunks that look like secrets.
- Research mode, off by default and turned on per repo in `~/.ownship/config.json`, lets the generator read the repo and the web with its tools.
- The daemon listens on `127.0.0.1`, and every API call needs the pairing token. On a local network the phone uses plain HTTP, so pair that way only on networks you trust; Tailscale keeps it encrypted.

## Configuration

`~/.ownship/config.json`: `language` (`en` or `es`), `dailyNewCards`, `port`, `generator` (`"auto"` or your own command), `repos` (`{ "<repo>": { "research": true } }`) and `exclude` (repos never captured).

## Docs

- [v1 design](docs/specs/2026-10-28-ownship-v1-design.md) and [decisions](docs/adr/)
- [Research behind the idea](docs/research/learning-while-agents-code.md) ([original in Spanish](docs/research/learning-while-agents-code.es.md)) and the [agent capture survey](docs/research/agent-capture-survey.md)

## License

[Apache-2.0](LICENSE)
