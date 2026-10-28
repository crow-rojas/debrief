# ownship v1: design

- Status: draft, agreed in a brainstorm on 2026-10-28
- Evidence: [learning-while-agents-code.md](../research/learning-while-agents-code.md) (why, learning science) and [agent-capture-survey.md](../research/agent-capture-survey.md) (how agents store sessions, hooks, headless modes)
- Marked **(builder's call)** where the conversation left a choice open and the author picked a default; everything else was decided with the owner.

## Intent

People who work with coding agents all day ship code under their name that they do not fully understand: the framework (Django, in the first user's case), the design patterns, and above all the business logic. The feeling is daily, at work and on hobby projects. ownship turns what the agent just did into a few short cards about that exact work, schedules them with spaced repetition and serves them on the phone or the desktop, so the dead time while the agent works (idle waiting, doomscrolling, procrastinating) becomes review.

**It worked when the user can explain the work they shipped, without help.** In reviews and meetings, a senior engineer is asked how they thought about a problem, the pain behind it, the tradeoffs, the algorithm and the pattern; the core card type trains exactly that.

The first audience is software engineers, because installing it touches agents, git, Tailscale and config files. The product is meant for anyone who works with agents later. It is free and open source (Apache-2.0); model costs are the user's own (a free model or their existing subscription).

## Goals

1. Capture every finished turn of Claude Code and Codex without the user doing anything after `npx ownship init`.
2. Turn a turn into 0 to 3 cards with evidence from that turn, using the user's own agent in non-interactive mode.
3. Review on the phone and on the desktop in sessions of a few cards that can be closed at any time.
4. Schedule with FSRS so a card comes back right before it would be forgotten.
5. Let the user flag a bad card and turn that correction into durable, per-repo knowledge that later cards use.
6. Keep everything on the user's machine except what the user's own agent sends to its provider.

## Non-goals for v1

Notifications of any kind (web push, ntfy). Agents other than Claude Code and Codex, and the plain git-hook fallback. Animations, TTS, video. LLM grading of free text. Export to Anki or Obsidian. MCP. Team mode or any server. A login service (launchd, systemd, Task Scheduler). A settings UI (**builder's call**: config file only).

## Anti-goals

These would make ownship a failure even if it technically works:

- Interrupting the user while they are working, or making them feel guilty: no streaks, no punishment for skipped days, "not now" on every card.
- A card whose answer is not backed by something real in the turn.
- A review queue so large that the user stops opening it.
- The raw repo, a full transcript or anything outside the cards reaching the phone, or anything reaching an LLM that the user did not authorize.
- ownship generating cards about its own generation runs.

## Constraints

- One TypeScript package named `ownship` on npm (free as of 2026-10-28), command `ownship`, installed with `npx ownship init` or `pnpm dlx ownship init`. pnpm for development; one package, no workspace.
- Node with the built-in `node:sqlite` is the minimum runtime. No native modules, so installs never compile. The exact minimum Node version and the stability level of `node:sqlite` are pinned in `docs/research/versions.md` with sources.
- Runs on macOS, Linux and Windows. **(builder's call)** v1 is tested on macOS and Linux; Windows has no native dependency and should work, and is listed as untested until someone runs it.
- Everything in the repo is in English. The UI is in English and Spanish from day one (no literal UI copy; ADR to follow the starter's ADR-004). Cards are written by the LLM in the language the user configures.
- The repo GitHub name moves from `crow-rojas/debrief` to `crow-rojas/ownship` (the owner does the rename; GitHub redirects the old URL).

## How it works

```
Claude Code / Codex session logs ──watch──▶ reader ──▶ turn event ──▶ queue
                         (optional Stop hook rings the doorbell)        │
git working tree ──snapshot per turn──▶ diff of record ─────────────────┘
                                                                        ▼
            knowledge notes ──▶ generator (user's agent, headless, no tools) ──▶ validators ──▶ SQLite + FSRS
                                                                                                │
                                         phone / desktop  ◀── Vue web app served by the daemon ◀┘
```

### 1. The daemon

- One local process. It starts on demand: the optional hook and every `ownship` command check whether it is running (pid and port in `~/.ownship/`) and start it detached if not.
- On start it catches up: each reader resumes from its last saved offset and processes the turns it missed. Logs live about 30 days, so a reboot loses nothing.
- Binds to `127.0.0.1` by default.

### 2. Capture

The unit is the **turn** (the agent finishing and handing control back), not the session. Claude Code's `Stop` fires per turn and so does Codex's turn end.

- **Readers.** One per agent: `claude-code` reads `~/.claude/projects/`, `codex` reads `~/.codex/sessions/` (including the `.zst` compressed logs). Each watches its directory, detects turn ends (Claude Code: an `assistant` record with `stop_reason: end_turn`; Codex: `task_complete`), debounces, and extracts the user prompt (injected context stripped) and the assistant's visible messages in order. Tool outputs and reasoning are not used: on the owner's machine, Claude thinking blocks were mostly empty and Codex reasoning encrypted.
- **Formats are unstable** (both vendors say so). Each reader detects the agent version from the log, ships recorded fixtures per supported version, and **fails closed**: an unknown format skips the turn and logs it; it never emits a guess. Read SpecStory CLI (Apache-2.0) and agentsview (MIT) before writing the readers, for format knowledge.
- **Diff of record is git, not the log.** At each turn end, snapshot the working tree into a temporary index (`git add -A` with `GIT_INDEX_FILE`, then `git write-tree`), never touching the user's index, stash or branches. The turn's diff is this snapshot against the previous one for that worktree, or against `HEAD` for the first turn seen. The snapshot is taken the moment the turn end is detected; only generation is debounced, so the next turn's edits do not leak in. **(builder's call)** Turns in a directory that is not a git repo are skipped in v1.
- **No attribution in v1 (builder's call).** Every change in the turn's diff is input, whoever made it: the agent's `Edit`s, its shell commands (`makemigrations`, codegen, `sed`), subagents, a formatter or the user. It is all work the user ships, and the generator returns zero cards for noise. Readers therefore never parse tool calls or subagent logs; they only find turn boundaries, the prompt and the messages. Per-file attribution is a later addition if cards about non-agent edits turn out to be a problem.
- **Missed turns (builder's call).** Turns that ended while the daemon was down have no snapshot of their own. On catch-up, consecutive missed turns of the same worktree are merged into one unit: their prompts and messages in order, and one diff from the last snapshot to the current tree. This keeps evidence correct at the cost of granularity.
- **Hooks are a doorbell, installed by default (builder's call).** `ownship init` installs a Stop hook for Claude Code and Codex unless the user declines; it is what starts the daemon after a reboot, so most turns get their own snapshot. The hook only pings the daemon (starting it if needed); a missing, untrusted or disabled hook only means coarser, merged turns. The hook exits immediately when `OWNSHIP_GENERATING=1` is set, and checks `hook_event_name` because Copilot CLI also runs hooks from `.claude/settings.json`.
- **Repo identity (builder's call).** A repo is its git common directory (`git rev-parse --git-common-dir`), so worktrees of one repo share knowledge notes and config. Snapshot baselines are per worktree root. The knowledge folder name is the repo's directory name plus a short hash of the common dir path, so two repos called `api` never collide.
- **Normalized event** (the contract between readers and the rest):

```jsonc
{
  "schema": "ownship.turn/1",
  "agent": { "name": "codex", "version": "0.165.0" },
  "reader": { "id": "codex", "version": 1, "source": "<log path>", "offset": 123456 },
  "sessionId": "…",
  "turnId": "…",
  "origin": "interactive", // interactive | headless | ownship; only interactive is processed
  "repo": { "root": "/…", "branch": "main", "base": "<tree-sha>", "head": "<tree-sha>" },
  "ts": { "start": "…", "end": "…" },
  "status": "completed", // completed | interrupted | error
  "prompt": "…",
  "messages": ["…"],
  "changes": [{ "path": "app/models/supplier.py", "op": "modify", "patch": "…" }], // from git snapshots
  "merged": false, // true when catch-up merged several missed turns
}
```

Left out of v1: tool outputs, reasoning, images, attribution, subagent linking, other agents.

### 3. Generation

- **The generator is the user's own agent**, run headless from a command template in the config. ownship ships two presets and picks the one that is installed, preferring the agent that produced the turn:
  - `claude -p --no-session-persistence --tools "" --output-format json --json-schema <schema>`
  - `codex exec --ephemeral --disable hooks -s read-only --output-schema <schema>`
    The anti-recursion flags are part of the presets, not left to the user. Every run sets `OWNSHIP_GENERATING=1`, and readers drop any session whose origin is headless or ownship. Any other command (Ollama, another CLI) can be configured; output is validated against the schema and retried once.
- **Input** per turn: the filtered prompt, messages and patches, plus the repo's knowledge notes. Before anything is sent: drop files matched by `.gitignore` or `.ownshipignore`, lockfiles and generated files, then secret-scan and drop any hunk with a finding.
- **Research mode** (off by default, enabled per repo in the config) runs the generator with its tools on, so it can read the repo, search the web and reach internal docs through the user's own MCP setup. Off means the generator sees only what ownship gives it. **(builder's call)** Research only shapes the question and the explanation: evidence must still come from the turn, and nothing the generator read elsewhere is stored or sent to the phone.
- **Eligible turns**: only `completed` ones; `interrupted` and `error` turns are dropped. Turns with no code changes (planning, "explain this", design discussions) are eligible too, because that is where the reasoning the user is asked about in reviews lives; for them, evidence comes from the prompt and messages.
- **Output**: 0 to 3 cards per turn. Zero is a valid answer for a trivial turn. The prompt asks the generator to prefer real decisions and business rules over syntax.
- **Daily cap**: 10 new cards a day (configurable). When reached, ownship stops generating until the next day. **(builder's call)** The queue is newest first, and a turn not generated within 7 days expires, so cards stay about recent work instead of draining an old backlog. Scheduled reviews never count against the cap.
- **Risk to track**: Anthropic says `-p` will default to `--bare`, which stops using the subscription login. Watch the changelog; the template must let the user switch to an API key or the other agent.

### 4. Cards

Four kinds, mixed within a session. All share one rule: **every card carries evidence** (one or more quotes from the turn's patch, prompt or messages, with file and line for code), and the daemon checks deterministically that each quote appears in the turn (whitespace-normalized). A card without verifiable evidence is discarded before it is stored.

| Kind                | What the user does                                                                                                                                | Graded by                                                                                                                                                    | FSRS rating                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Defend the decision | Writes a free answer to "why X and not Y?" about a real decision, then sees the reference as 2 or 3 key ideas and ticks the ones their answer had | The user ticking key ideas (self-scoring against idea units reduces the leniency of self-grading, Rawson and Dunlosky; **cite verified sources in the ADR**) | All ticked: Good. Any missing: Again |
| Multiple choice     | Picks one of 3 or 4 options; exactly one is correct                                                                                               | Key                                                                                                                                                          | Right: Good. Wrong: Again            |
| Short text          | Types a short answer                                                                                                                              | A list of accepted answers, compared case-, accent- and whitespace-insensitive                                                                               | Same                                 |
| Number              | Types a number                                                                                                                                    | Value with an optional tolerance                                                                                                                             | Same                                 |

- "I don't know, show me" counts as Again. "Not now" removes the card from the current session without rating it.
- Feedback is immediate and sits next to the highlighted code.
- FSRS with two ratings only (Again, Good), via `ts-fsrs`, default desired retention.

### 5. Feedback and knowledge

- Every card has "This card is wrong". The user may add a note ("this is rejected because of X, not Y") and chooses to discard the card or regenerate it with the note.
- The note is saved as Markdown under `~/.ownship/knowledge/<repo>/`, with the card's evidence, and is part of the generator's input for that repo from then on. The files are meant to be read, edited, grepped and versioned by the user. **(builder's call)** No index or embeddings; add SQLite FTS5 only when the notes outgrow the generator's context.
- The share of cards flagged wrong is recorded (target under 10%).

### 6. Review app

- A Vue web app compiled at publish time and served as static files by the daemon. Mobile-first, also used on the desktop at `localhost`.
- Screens: the review session (mockups agreed in the brainstorm: question with highlighted evidence lines, answer, reveal with key ideas or the right option, "This card is wrong"), the empty state, and the "card is wrong" sheet. The header shows the repo and how long ago the turn happened.
- Visual direction from the mockups: restrained product UI, system sans plus a monospace for code, and one accent kept for what matters, a highlighter yellow on the evidence lines.

### 7. Phone access and pairing

- `ownship pair` prints a QR with the URL and a long-lived token; the browser keeps the token in a cookie. Strict CORS and CSRF, an access log, and the daemon serves only cards and their snippets, never repo files.
- If Tailscale is installed, pairing offers `tailscale serve` first (HTTPS inside the user's tailnet). Otherwise it binds the LAN IP over plain HTTP and warns that this is for trusted networks only. Never Tailscale Funnel.

### 8. Storage

- `~/.ownship/ownship.db` (SQLite): turns seen, reader offsets, cards, evidence, FSRS state and review log, flags.
- `~/.ownship/knowledge/<repo>/*.md`: knowledge notes.
- `~/.ownship/config.json` **(builder's call: format)**: generator template, language, daily cap, per-repo research mode, and an `exclude` list of repos never captured. **(builder's call)** Every repo is captured by default, per Goal 1; the user's agent already sends that code to its provider, and the generator runs under the same login.
- Nothing here ever leaves the machine.

## Agent harness for building ownship

Port from `~/dev/rails-vue-starter`, translated to Node so nothing needs Ruby:

- `CLAUDE.md` identical to `AGENTS.md`, an index where each rule names the tool that enforces it.
- `bin/check`: ESLint, `tsc` and `vue-tsc`, tests, the guard. Run by the Claude Code Stop hook and by `.codex/hooks.json`, plus a per-file lint after each edit.
- `bin/guard` rewritten in Node: fails when the test count drops, new skips appear, or the harness changes without a human `Guard-Override:` trailer.
- Lefthook: linters and gitleaks on pre-commit; Conventional Commits and no AI co-author trailers on commit-msg; `bin/ci` on pre-push.
- `.claude/settings.json` deny rules, ADRs in `docs/adr/`, `docs/research/versions.md` with sources and cooldowns, the `main` ruleset and CI workflow.
- Not ported: Kamal, Postgres, strong_migrations, prosopite, Typelizer, Brakeman.

## Left to the builder

The test framework, the secret scanner (a JS library or gitleaks as an optional binary), the config file format, the exact generator prompt and JSON schema, the debounce window, how many knowledge notes fit in the generator's input, how "not now" orders the session, the empty-state copy, and the dark theme.

## Measuring it

Retention at the first review after about 7 days (share of Good), share of cards flagged wrong (under 10%), and whether the user keeps opening it. The owner's own test: after two weeks, can they explain their recent work without help.
