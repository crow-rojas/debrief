# Capturing what the agent just did: a survey of session logs, hooks and headless modes

> Companion to [learning-while-agents-code.md](learning-while-agents-code.md), sections 4.1 and 4.2. Researched on 2026-10-28. Versions checked on this machine: Claude Code 2.1.312, Codex CLI 0.159.0 (latest 0.165.0), Gemini CLI 0.45.0 (latest 0.66.0), Copilot CLI 1.0.59 (latest 1.0.105) and OpenCode 1.18.18 (latest 1.19.5 / 2.2.0). Cursor and Aider are not installed here, so everything about them comes from docs and source. For local checks I only looked at the _structure_ of the files (record types and keys), never their contents.

The short answer: the hypothesis mostly holds, but it breaks in three places.

1. **Reading the logs works for prompts and messages, but not as the source of truth for the diff.** Claude Code, Codex, Gemini CLI and OpenCode all record file edits with enough data to rebuild a patch. But edits the agent makes through the shell (`sed`, a formatter, a codegen script) do not show up as edit records, except in Claude Code's beta `bashEditDiff`. Cursor's readable transcript has no tool results at all. Aider writes Markdown. The diff should come from git; the logs should say _which agent turn_ it belongs to and _why_.
2. **Every format is explicitly unstable.** Anthropic says the transcript "entry format is internal to Claude Code and changes between versions, so scripts that parse these files directly can break on any release". OpenAI says "the transcript format isn't a stable interface for hooks". During 2026 alone, Gemini moved from JSON to event-sourced JSONL, OpenCode moved from JSON files to SQLite and then to a v2 schema, Goose and Cline changed stores, and Codex started compressing cold rollouts to `.zst`. A "small reader" per agent is small only if it comes with fixtures, version detection and a plan for breakage.
3. **Shelling out to the agent for generation feeds back into capture.** A headless run (`claude -p`, `codex exec`, `gemini -p`, `copilot -p`, `opencode run`) writes a session to the same log directory and, in most agents, fires the user's own Stop hooks. So ownship would end up capturing itself. Every agent needs its own "don't persist, don't run hooks" flags. On Claude Code, the flag that skips hooks (`--bare`) also stops using the subscription login. The docs say `--bare` "will become the default for `-p` in a future release".

Two things work better than expected. Claude Code (`--json-schema`) and Codex (`--output-schema`) both enforce a JSON Schema on headless output. There is also mature open-source prior art for multi-agent readers, SpecStory CLI (Apache-2.0) and agentsview (MIT), and ownship should learn from it before writing its own readers. No cross-agent standard (ACP, Agent Trace, OpenTelemetry GenAI, AGENTS.md, MCP) gives a passive observer the diff plus reasoning of a finished turn.

## Comparison

"Edits reconstructable" means the log, on its own, holds old/new text or a patch for edits made with the agent's edit tools. Shell edits are excluded everywhere (see above).

| Agent                | Session storage (macOS/Linux)                                                                                   | Format                                                     | Edits reconstructable from log                                                                                    | Per-turn hook (payload)                                                           | Headless JSON              | Schema enforced                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------- | ----------------------------------- |
| Claude Code          | `~/.claude/projects/<cwd-slug>/<session>.jsonl`, subagents in `<session>/subagents/*.jsonl`                     | JSONL, internal                                            | Yes: `toolUseResult.structuredPatch`, `oldString`/`newString`, `originalFile`; Bash edits via beta `bashEditDiff` | `Stop` (`transcript_path`, `last_assistant_message`)                              | `-p --output-format json`  | Yes, `--json-schema`                |
| Codex CLI            | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (+ SQLite index `state_*.sqlite`, `thread_history_*.sqlite`)     | JSONL, internal; cold files may become `.zst`              | Yes: `FileChange.changes[path].unified_diff` (paginated mode), or the raw `apply_patch` input                     | `Stop` (`transcript_path`, `turn_id`, `last_assistant_message`); legacy `notify`  | `exec --json`              | Yes, `--output-schema`              |
| Cursor IDE           | `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`                                           | SQLite KV, internal, versioned blobs                       | Yes, but only by decoding before/after content blobs (community-reversed)                                         | `stop` (`status`, `transcript_path`); `afterFileEdit` (`old_string`/`new_string`) | n/a                        | n/a                                 |
| Cursor CLI (`agent`) | `~/.cursor/chats/<md5(cwd)>/<id>/store.db`; transcripts in `~/.cursor/projects/<cwd>/agent-transcripts/`        | SQLite + protobuf root blob; JSONL transcript              | Transcript: no (no tool results). store.db: **not verified**                                                      | Same hooks, CLI coverage disputed                                                 | `-p --output-format json`  | No                                  |
| Gemini CLI           | `~/.gemini/tmp/<project-slug>/chats/session-*.jsonl` (`.json` before v0.39.0)                                   | JSONL event log with `$set`/`$patch`/`$rewindTo`, internal | Yes: edit `args` plus `resultDisplay.fileDiff` (unified), `originalContent`, `newContent`                         | `AfterAgent` (`transcript_path`, `prompt`, `prompt_response`)                     | `-p -o json`               | No                                  |
| Copilot CLI          | `~/.copilot/session-state/<id>/events.jsonl` (+ `session-store.db`)                                             | JSONL events, documented only via the SDK                  | Probably (`tool.execution_complete.detailedContent` "preserving … diffs"); **not verified**                       | `agentStop` (`transcriptPath`, `stopReason`)                                      | `-p --output-format json`  | No                                  |
| OpenCode             | `~/.local/share/opencode/opencode.db` (v1 tables `session`/`message`/`part`; v2 `session_v2`/`session_message`) | SQLite, internal                                           | `edit`/`apply_patch`: yes (`metadata.filediff.patch`); `write`: no diff, needs the git snapshot                   | JS/TS plugin `session.idle` only (no shell hooks)                                 | `run --format json`        | Only via SDK/server (`json_schema`) |
| Aider                | `.aider.chat.history.md` in the repo (+ optional `--llm-history-file`)                                          | Markdown                                                   | No; git auto-commits are the record                                                                               | None (`--notifications-command` has no payload)                                   | No                         | No                                  |
| Goose (short)        | `~/.local/share/goose/sessions/sessions.db`                                                                     | SQLite (JSONL before 1.10.0)                               | **Not verified**                                                                                                  | `Stop`, `AfterFileEdit` (Open Plugins hooks)                                      | `run --output-format json` | No                                  |
| Cline (short)        | `~/.cline/data` (legacy `tasks/<id>/*.json`, new `sessions.db`)                                                 | JSON → SQLite, migrating                                   | **Not verified**                                                                                                  | `TaskComplete`, `PostToolUse`                                                     | `--json`                   | No                                  |
| Amp (short)          | `~/.local/share/amp/threads/T-*.json` (third-party readers); server is the source of truth                      | JSON                                                       | **Not verified**                                                                                                  | TS plugin `agent.end`                                                             | `-x --stream-json`         | No                                  |

## Per-agent notes

### Claude Code

- **Storage.** I verified it locally. Records are typed by `type`: `user`, `assistant`, `system`, `attachment`, `file-history-snapshot` and newer ones such as `api-request` and `ai-title`. Edits appear in `user` records as `toolUseResult` with `structuredPatch`, `oldString`, `newString` and `originalFile`. Shell edits appear as `toolUseResult.bashEditDiff.files[].hunks[]` (public beta, v2.1.269+, off unless `bashEditDiffEnabled` is set or the session runs in auto/bypass mode) ([hooks](https://code.claude.com/docs/en/hooks#posttooluse)).
  - User text and tool output are separable. Tool results are `tool_result` blocks inside `user` messages, so a reader must drop those, `isMeta` records and injected attachments.
  - On this machine, 999 of 1,085 thinking blocks in recent sessions were empty (`thinkingDisplay: "updates"`). **Do not count on reasoning text.**
- **Stability and retention.** The docs say the format is internal and "can break on any release". Transcripts are deleted after `cleanupPeriodDays` (default 30, minimum 1). `CLAUDE_CODE_SKIP_PROMPT_HISTORY` suppresses writes in all modes, and `--no-session-persistence` does the same for one `-p` run ([sessions](https://code.claude.com/docs/en/sessions#where-transcripts-are-stored), [settings reference](https://code.claude.com/docs/en/settings-reference#cleanupperioddays)). `CLAUDE_CONFIG_DIR` moves everything.
- **Hooks.** 33 events.
  - `Stop` "runs when the main Claude Code agent has finished responding", so per turn. It does not run on a user interrupt, and API errors fire `StopFailure` instead.
  - Its input adds `last_assistant_message`. The docs warn that "the transcript file isn't guaranteed to include the final message at Stop time on all versions" ([hooks](https://code.claude.com/docs/en/hooks#stop)). So a reader triggered by `Stop` must debounce or use that field.
  - `SessionEnd` has a 1.5 s default budget. `PostToolUse` carries `tool_input`/`tool_response`, and `FileChanged` exists.
  - Config: `~/.claude/settings.json` and `.claude/settings*.json`. Copilot CLI also reads the latter (see below).
- **Headless.**
  - Command: `claude -p … --output-format json --json-schema '<schema>'`, with the result in `structured_output`. Restrict tools with `--tools "Read"` or `--tools ""`, plus `--permission-mode dontAsk` ([headless](https://code.claude.com/docs/en/headless)).
  - Plain `-p` uses the subscription login and _does_ run hooks.
  - `--bare` skips hooks but "doesn't use your subscription login" (API key only), and "will become the default for `-p` in a future release".
  - Anthropic's terms allow an end user to sign in to "the unmodified Claude Code binary with their own Claude subscription", but forbid third parties from collecting or routing claude.ai credentials ([legal](https://code.claude.com/docs/en/legal-and-compliance)). ownship must only spawn `claude` and never touch its tokens.

### Codex CLI

- **Storage.** I verified it locally.
  - Line types: `session_meta` (with `cli_version`, `cwd`, `git`, `originator`, `source`, `history_mode`), `turn_context`, `response_item`, `event_msg`, `compacted`, `world_state`, `token_usage_record`.
  - In `paginated` history mode (all 254 local rollouts, 0.130 to 0.158), `event_msg/item_completed` items of type `FileChange` carry `changes[path] = {type: add|delete|update, content | unified_diff, move_path}`. That is a ready-made unified diff.
  - In `legacy` mode those items are not persisted ([policy.rs](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/policy.rs)), so the reader must parse `custom_tool_call` `apply_patch` input in Codex's own `*** Begin Patch` format.
  - Turn boundaries: `task_started` and `task_complete` (with `last_agent_message`), keyed by `turn_id`. Reasoning is `encrypted_content` with empty summaries in every local record (1,091 of 1,091), so **no readable reasoning**.
  - Headless (`originator: codex_exec`), desktop app, IDE and subagent threads all land in the same tree, so one reader covers every surface but must filter by origin.
- **Stability.** "The transcript format isn't a stable interface for hooks" ([hooks](https://learn.chatgpt.com/docs/hooks)).
  - A background worker compresses cold rollouts to `.zst` ([compression.rs](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/compression.rs)). None are compressed on this machine yet.
  - No age-based retention found. `--ephemeral` skips persistence.
  - The official alternative is the app-server (`thread/list`, `thread/read`, `turn/diff/updated` with "the aggregated unified diff across every file change in the turn") ([app-server](https://developers.openai.com/codex/app-server)), which is marked experimental in `codex --help`.
- **Hooks.** On by default and not marked experimental.
  - `Stop` fires per turn, with `turn_id`, `transcript_path` and `last_assistant_message` (all required in the generated [stop schema](https://github.com/openai/codex/blob/main/codex-rs/hooks/schema/generated/stop.command.input.schema.json)).
  - `SessionEnd.reason` is "currently always `other`".
  - Config: `~/.codex/hooks.json`, `config.toml [hooks]`, or the per-repo equivalents. **Each non-managed hook must be explicitly trusted by hash** before it runs ([hooks](https://learn.chatgpt.com/docs/hooks)).
  - The older `notify` program receives `agent-turn-complete` with `turn-id`, `input-messages` and `last-assistant-message` ([legacy_notify.rs](https://github.com/openai/codex/blob/main/codex-rs/hooks/src/legacy_notify.rs)).
- **Headless.**
  - Command: `codex exec --output-schema schema.json -o out.json --ephemeral -s read-only`. "By default, codex exec runs in a read-only sandbox", and it "reuses saved CLI authentication by default" (ChatGPT login) ([non-interactive](https://learn.chatgpt.com/docs/non-interactive-mode)).
  - `codex exec` does run hooks (the exec event processor handles `HookStarted`/`HookCompleted`, [source](https://github.com/openai/codex/tree/main/codex-rs/exec/src)). Add `--disable hooks` to be safe.

### Cursor (IDE and `agent` CLI)

- **Storage.** Two internal stores and one lossy transcript.
  - The IDE's `state.vscdb` (`cursorDiskKV`: `composerData:*`, `bubbleId:*`, `checkpointId:*`) holds before/after content blobs that let you rebuild edits. It is only documented by community reverse-engineering ([cursor-conversations-mcp research](https://github.com/vltansky/cursor-conversations-mcp/blob/main/docs/research.md), [toolpath-cursor](https://docs.rs/toolpath-cursor)), and it grows without cleanup ([forum](https://forum.cursor.com/t/cursor-ide-crash-during-agent-work/153268/7)).
  - The CLI's `store.db` is a blob store with a protobuf root ([samzong/Recall reader](https://github.com/samzong/Recall/blob/main/src/adapters/cursor/cli_store.rs)).
  - The JSONL transcript under `~/.cursor/projects/…/agent-transcripts/` holds only `role` and `message` (text and `tool_use`), with no tool results, timestamps or ids. Cursor staff gave no timeline for richer data ([forum, 2026-07-27](https://forum.cursor.com/t/richer-agent-transcripts-lifecycle-data-for-observability-langfuse-stop-hooks/166592)).
  - `transcript_path` is "null if transcripts disabled" ([hooks](https://cursor.com/docs/agent/hooks)).
- **Hooks are the better path here.**
  - `afterFileEdit` gives `file_path` and `edits[{old_string, new_string}]` without line positions.
  - `stop` ("called when the agent loop ends") gives `status` and `loop_count`, plus the common `conversation_id`, `generation_id` and `transcript_path`.
  - `beforeSubmitPrompt` gives the prompt, and `afterAgentResponse` gives the text ([hooks](https://cursor.com/docs/agent/hooks)).
  - Hooks shipped as beta in 1.7 (2025-09-29) ([changelog](https://cursor.com/changelog/1-7)).
  - CLI coverage is contested. The changelog says response/thought events emit in the CLI; staff said on 2026-07-26 that they don't ([forum](https://forum.cursor.com/t/richer-agent-transcripts-lifecycle-data-for-observability-langfuse-stop-hooks/166592)).
- **Headless.** `agent -p … --output-format json`, with `--mode ask|plan` for read-only. Without `--force`, changes are "only proposed, not applied" ([headless](https://cursor.com/docs/cli/headless)). There is no schema flag (**not verified** that none exists). It uses the Cursor login.

### Gemini CLI

- **Storage.** JSONL since v0.39.0 ([PR #23749](https://github.com/google-gemini/gemini-cli/pull/23749)).
  - The files are an event log. The first line is metadata, followed by message records plus `$set`, `$patch` and `$rewindTo` records ([PR #29568](https://github.com/google-gemini/gemini-cli/pull/29568), 2026-10-01), so a reader has to replay them ([chatRecordingService.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/services/chatRecordingService.ts)).
  - The project directory is a slug from `~/.gemini/projects.json`, not a hash.
  - The local files here are legacy `.json` (`kind`, `messages`, `sessionId`, …), which shows that one machine can hold both formats.
- **Edits and text.** Edits are rich: `resultDisplay` holds `fileDiff` (a unified patch), `originalContent` and `newContent` ([tools.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/tools/tools.ts)). `gemini` messages carry `thoughts`, so readable reasoning is likely; whether it is summarized is **not verified**.
- **Retention.** `general.sessionRetention.maxAge` defaults to `30d`. I found no switch that disables recording ([session-management](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/session-management.md)).
- **Hooks.** On by default since v0.26.0. `AfterAgent` fires per turn with `prompt`, `prompt_response` and `transcript_path` ([hooks reference](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md)). `SessionEnd` is best effort.
- **Headless.** `gemini -p … -o json` returns `{response, stats}`. `--approval-mode plan` is read-only. It reuses the Google login ([headless](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/headless.md)). There is no schema flag. It always records a session and fires `AfterAgent`, and no CLI flag disables hooks.

### GitHub Copilot CLI

- **Storage and source.** The CLI is closed source. The storage layout is documented in the [config-dir reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference). The event types are documented only for the SDK ([streaming-events](https://github.com/github/copilot-sdk/blob/main/docs/features/streaming-events.md)).
  - Turn events: `assistant.turn_start` and `assistant.turn_end`.
  - Edit content: `tool.execution_complete.detailedContent`. Exact edit argument names are **not verified**.
  - Session history syncs to the user's GitHub account by default (`remoteExport: true`). ownship should mention this in its privacy docs.
  - `~/.copilot/session-state` does not exist on this machine, because Copilot has not been used for a session here.
- **Hooks.** Verified locally from an installed hook file, which lists 13 events.
  - `agentStop` fires per turn with `transcriptPath` ([hooks reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-hooks-reference)).
  - **It also runs hooks from `.claude/settings.json` and `.claude/settings.local.json`** (changelog: "Read .claude/settings.json and .claude/settings.local.json as additional repo config sources", [changelog](https://github.com/github/copilot-cli/blob/main/changelog.md)). An ownship hook installed for Claude Code at repo level fires under Copilot too, with a different payload.
- **Headless.** `copilot -p … -s --output-format json` (JSONL), with `--available-tools`/`--excluded-tools` and `--mode plan`. It uses the Copilot subscription. There is no schema flag.

### OpenCode

- **Storage.** I verified v1.18.18 locally.
  - SQLite `opencode.db`. `part.data` JSON types are `text`, `reasoning`, `tool`, `patch`, `step-start` and `step-finish`.
  - `edit` parts carry `input.oldString`/`newString` and `metadata.filediff.{file, patch, additions, deletions}`.
  - `patch` parts reference a git snapshot hash in OpenCode's own snapshot repo.
  - `write` has no diff ([write.ts](https://github.com/anomalyco/opencode/blob/v1.18.18/packages/opencode/src/tool/write.ts)).
- **Pitfalls.**
  - The same DB holds a `credential` table, so the reader must select only session tables.
  - The filename changes per release channel, and `OPENCODE_DB` overrides it ([database.ts](https://github.com/anomalyco/opencode/blob/v1.18.18/packages/core/src/database/database.ts)).
  - v2 (2.2.0 on 2026-10-27) uses new tables and a new plugin API, and ships alongside v1.19.x ([session-message.ts](https://github.com/anomalyco/opencode/blob/dev/packages/schema/src/session-message.ts)).
- **Hooks.** JS/TS plugins only, with end of turn signalled by `session.idle` ([plugins](https://github.com/anomalyco/opencode/blob/v1.18.18/packages/web/src/content/docs/plugins.mdx)).
- **Headless.** `opencode run --format json --pure` (`--pure` skips external plugins). JSON Schema output exists only through the SDK/server. Subscription logins exist for ChatGPT and Copilot, but not for Claude since 1.3.0 ([providers](https://github.com/anomalyco/opencode/blob/v1.18.18/packages/web/src/content/docs/providers.mdx)).

### Aider

- **Storage.** `.aider.chat.history.md`: user lines start with `#### `, tool and system output with `> `, and assistant text is raw ([io.py](https://github.com/Aider-AI/aider/blob/main/aider/io.py)). `--auto-commits` is on by default, so git is the record ([options](https://aider.chat/docs/config/options.html)).
- **Hooks and headless.** No lifecycle hooks. `--message` gives one-shot runs, but there is no JSON output.
- **Activity.** Latest release is 0.86.2 (PyPI, 2026-02-12). Development has slowed.

## Existing standards

| Standard                                    | Gives ownship                                                                                                                                                                                             | Passive observer?                                                                                                                                                                                     | Support                                                                                                                                                                                                                                                                                                | Verdict                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **ACP** (v1.27.0)                           | `agent_message_chunk`, `agent_thought_chunk`, `tool_call_update` with an optional `diff {path, oldText, newText}`, and `stopReason: end_turn` ([schema](https://agentclientprotocol.com/protocol/schema)) | **No.** "The client launches the agent as a subprocess" ([transports](https://agentclientprotocol.com/protocol/transports)); a TUI session is invisible. `session/load` can replay history afterwards | Claude Code (adapter), Codex (adapter), Gemini `--acp`, OpenCode, Cursor `agent acp`, Copilot `--acp`, Goose, Cline                                                                                                                                                                                    | Ignore for capture. It only works if ownship becomes the editor                                            |
| **Agent Trace** (v0.1.0 RFC)                | Line ranges, contributor type, model and conversation URL. **No diff, no text, no turn signal**; storage undefined ([agent-trace.dev](https://agent-trace.dev/))                                          | n/a                                                                                                                                                                                                   | Partners listed; native emitters **not verified**. The reference repo `cursor/agent-trace` returns 404                                                                                                                                                                                                 | Ignore. It is attribution, not capture; maybe an export format later                                       |
| **OTel GenAI semconv** (Development status) | Opt-in `gen_ai.input/output.messages` and tool args ([spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md))                                         | Yes, if the user configures each agent to export                                                                                                                                                      | Claude Code: a `diff` attribute on Edit when four env vars are set (beta), with thinking excluded ([monitoring](https://code.claude.com/docs/en/monitoring-usage)). Codex: prompt, no assistant text, no diff. Gemini: prompt (`logPrompts` default true), tool args. Copilot: content opt-in, no diff | Optional, Claude Code only. Per-agent configuration, and nothing is backfilled while the collector is down |
| **AGENTS.md**                               | An instructions file ([agents.md](https://agents.md/))                                                                                                                                                    | n/a                                                                                                                                                                                                   | Most agents                                                                                                                                                                                                                                                                                            | Not a capture format. Useful only to ask agents to explain their decisions in prose                        |
| **MCP** (2026-07-28)                        | Only the calls the model chooses to make. "Full conversation history stays with the host" ([architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture.md))                      | No                                                                                                                                                                                                    | All                                                                                                                                                                                                                                                                                                    | Not for capture; still useful as a query channel (section 4.1)                                             |

The prior art matters more than any of these standards:

- **SpecStory CLI** ([repo](https://github.com/specstoryai/getspecstory/tree/dev/specstory-cli), Apache-2.0, Go, v2.16.0) has a per-agent `Provider` interface and a normalized [SessionData v1 schema](https://github.com/specstoryai/getspecstory/blob/dev/specstory-cli/pkg/spi/schema/session-data-v1.json) built from `exchanges[]` (one per turn) → `messages[]` with `text`/`thinking` parts and `tool.input`. It covers Claude Code, Codex, Cursor CLI, Gemini, OpenCode and others.
- **agentsview** ([repo](https://github.com/kenn-io/agentsview), MIT, Go) is a local daemon with file watchers, REST and SSE, covering more than 60 stores.
- **git-ai** ([repo](https://github.com/git-ai-project/git-ai), Apache-2.0) records line attribution in git notes through per-agent hook presets.

Their per-agent diff and reasoning coverage is **not verified**.

## Recommendation for ownship v1

This section is opinion, based on the facts above.

1. **Start with Claude Code and Codex.** They are the only two with all four pieces: a structured patch in the log, a per-turn hook with `turn_id`/`transcript_path`, a schema-enforced headless mode and subscription auth. Both are installed here, which makes fixtures cheap. Add Gemini and OpenCode in v0.2; their readers are harder (an event-log replay, and two SQLite schemas). Put Cursor and Aider in a "git + hooks" tier, not a reader tier.
2. **Make git the diff of record, and use the reader for attribution and the transcript.**
   - At each detected turn end, snapshot the working tree to a detached object (`git add -A` into a temporary index, `git write-tree`, never touching the user's index or stash).
   - The turn's diff is that snapshot against the previous one, or against `HEAD` at session start.
   - Use the agent's own patches only to attribute files to the turn and to flag edits the agent didn't make, such as yours or a formatter's.
   - This catches shell edits and survives format changes. Its limit is concurrent human edits in the same tree, which it can flag but not separate.
3. **Detect turn ends by watching the files; use hooks only as a doorbell.** Watch the log directories (Codex `task_complete`; Claude Code an `assistant` record with `stop_reason: end_turn`; Gemini/Copilot their turn-end records) and debounce. Then add the optional Stop/`agentStop`/`AfterAgent` hook to ring sooner. That way a missing, untrusted (Codex hash trust) or disabled hook only delays ownship. Keep the hook idempotent; Claude Code's own docs say the transcript may lag `Stop`.
4. **Guard every generation call against recursion.**
   - Claude Code: `claude -p --no-session-persistence --tools "" --output-format json --json-schema …`, plus a `OWNSHIP_GENERATING=1` env marker that ownship's hook checks and exits on.
   - Codex: `codex exec --ephemeral --disable hooks -s read-only --output-schema …`.
   - For agents without a schema flag, validate the JSON and retry once. Also filter `originator`/`entrypoint` in the reader so a leak is dropped anyway.
   - Make the command template carry these flags by default, not leave them to the user.
5. **Don't promise "reasoning".** Locally, Claude Code thinking blocks were mostly empty and Codex reasoning was encrypted with empty summaries. Build "why X and not Y?" cards from the visible assistant text and the user prompt.
6. **Read SpecStory's providers before writing readers.** Reuse their format knowledge, and their code if a Go sidecar is acceptable, rather than rediscovering each format.

Adjusted normalized event (changes in bold):

```jsonc
{
  "schema": "ownship.turn/1", // versioned envelope
  "agent": { "name": "codex", "version": "0.159.0" }, // version from the log, for reader dispatch
  "reader": {
    "id": "codex-rollout",
    "version": 1,
    "source": "~/.codex/sessions/…jsonl",
    "offset": 123456,
  },
  "sessionId": "…",
  "turnId": "…",
  "parentSessionId": null, // turn, not session, is the unit; subagents link up
  "origin": "interactive", // interactive | headless | ownship → drop ownship's own runs
  "repo": { "root": "/…", "branch": "main", "base": "<tree-sha>", "head": "<tree-sha>" },
  "ts": { "start": "…", "end": "…" },
  "status": "completed", // completed | interrupted | error
  "prompt": "…", // user text, injected context stripped
  "messages": ["…"], // assistant text only, in order
  "reasoning": null, // optional; often absent or encrypted
  "changes": [
    {
      "path": "src/a.ts",
      "op": "modify",
      "patch": "…", // from git snapshots
      "attributedTo": "agent",
    }, // agent | unattributed (human, formatter, other process)
  ],
  "truncated": false,
}
```

## Risks and caveats

| Risk                                                                                           | Severity                  | Mitigation                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A vendor changes a log format in a patch release (both Anthropic and OpenAI say they may)      | High                      | Detect versions from `version`/`cli_version`, keep recorded fixtures per version, fail closed (skip the turn, log it) rather than emit wrong cards, and keep the git diff working regardless |
| `claude -p` defaults to `--bare`, which drops subscription auth                                | High                      | Watch the changelog. Allow an API-key or other-agent fallback in the command template. Ollama stays the default                                                                              |
| Generation runs pollute logs and fire hooks                                                    | High                      | The flags in step 4, an env marker, and origin filtering                                                                                                                                     |
| Shell, formatter or human edits are attributed to the agent                                    | Medium                    | Git snapshots plus agent-reported paths, with "unattributed" changes shown separately                                                                                                        |
| Codex hook trust, a disabled Cursor transcript, Copilot's `.claude/settings.json` cross-firing | Medium                    | Hooks optional; a hook script that checks `hook_event_name` and the agent's env vars before acting                                                                                           |
| Retention (Claude 30 days, Gemini 30 days) deletes logs before ownship reads them              | Low                       | Read on turn end, not in nightly batches; never depend on old logs                                                                                                                           |
| The logs hold secrets and proprietary code; ownship reads more than it needs                   | High                      | Read only the needed record types, never the OpenCode `credential` table, never auth files; secret-scan before any LLM call                                                                  |
| Copilot syncs sessions to GitHub by default                                                    | Low (not ownship's doing) | Document it                                                                                                                                                                                  |

Caveats:

- The Cursor storage details, Amp's local path and Cline's new store come from third-party readers or forum posts, not vendor docs.
- Copilot's exact edit arguments, Gemini's `thoughts` content, and whether Copilot command hooks fire under `-p` are **not verified**.
- I verified locally only the structure of the Claude Code, Codex, OpenCode v1 and legacy Gemini files. The "reasoning is mostly unreadable" observation depends on this machine's settings (`thinkingDisplay`, Codex reasoning-summary config) and may differ elsewhere.
- Latest versions moved during the research: Codex 0.165.0, Gemini 0.66.0, OpenCode 2.2.0, Copilot 1.0.105. Re-check before building each reader.
