# ADR-003: Capturing agent turns

- Status: accepted
- Date: 2026-10-28
- Deciders: owner
- Evidence: [agent-capture-survey.md](../research/agent-capture-survey.md)

## Context

ownship needs, for each finished agent turn, what the user asked, what the agent said and what changed in the code. Agents come from many vendors and none will adopt a standard for us. The survey found that no existing standard (ACP, OpenTelemetry, Agent Trace) gives a passive observer the diff and the reasoning of a finished turn, that every agent's log format is officially unstable, that edits made through the shell are missing from the logs, and that reasoning is mostly empty or encrypted.

## Decision

- **Read the session logs agents already write**, with one reader per agent. v1 ships readers for **Claude Code** (`~/.claude/projects/`) and **Codex** (`~/.codex/sessions/`), the two the owner uses daily and the only two with per-turn hooks, schema-enforced headless output and subscription login.
- **The unit is the turn.** Readers find turn ends and extract the user prompt and the visible assistant messages. They do not read tool outputs, reasoning or subagent logs.
- **Git is the diff of record.** At each turn end the daemon snapshots the working tree with a temporary index and `git write-tree`, never touching the user's index, stash or branches. The turn's diff is the snapshot against the previous one for that worktree.
- **No attribution in v1.** Every change in the turn's diff is input, including shell edits, subagents, formatters and the user's own edits.
- **Readers fail closed.** Each one detects the agent version, ships fixtures per supported version, and skips a turn it cannot parse rather than guess.
- **Hooks are a doorbell**, installed by default by `ownship init`: a Stop hook pings the daemon, starting it if needed. Without the hook, turns are found by watching the files, and missed turns are merged on catch-up.

## Alternatives not taken

- **Defining a standard for agents to adopt**: no vendor would.
- **Hooks only**: Claude Code's `Stop` carries no diff, Codex hooks need trust, and a missing hook would lose turns instead of delaying them.
- **The agent's own patches as the diff**: they miss shell edits and break with each format change.
- **One agent first**: the owner splits the day between Claude Code and Codex, so one reader would see half the work.

## Consequences

- Each agent release can break a reader; fixtures and version detection are part of every reader. Read SpecStory CLI and agentsview for format knowledge before writing one.
- Directories that are not git repos are not captured in v1.
- Cards may be about edits the agent did not make. Attribution is the fix if that proves noisy.
