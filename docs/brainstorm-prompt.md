# Brainstorm prompt

Paste this into a fresh agent session at the repo root to shape the first version of the product. The conversation can be in any language; everything written to the repo stays in English.

---

We are starting **ownship**, an open-source, local-first tool that turns what a coding agent just wrote into short exercises about the developer's own diff, schedules them with spaced repetition (FSRS) and serves them to the phone while the agent works. The repo is empty except for the research in `docs/research/learning-while-agents-code.md`. Read it in full before anything else; it is the evidence base, and where it says "opinion" or "not verified", treat that as an open question rather than a decision.

Run a brainstorm with me using the `superpowers:brainstorming` skill. Ask one question at a time, recommend an answer for each and explain why, and push back when an idea grows the scope. The goal is the **thinnest end-to-end loop that is worth using every day**, not the full vision in the research. Before proposing how a piece should work, check how comparable tools already do it (`researching-prior-art`): Contral, Claude Code's Learning output style, and the open-source plugins the research lists.

Cover these, in the order that makes sense to you:

1. **Who and when.** The first user (I am a senior engineer who works with Claude Code and Codex all day), the moment the tool shows up, and what "it worked" means after two weeks.
2. **The first loop.** One capture source, one card type and one place to review it. Argue for which ones; the research suggests a Claude Code `Stop` hook and a card type that can be validated deterministically.
3. **Stack and distribution.** Installation should be `npx ownship init`. My starting point is a single TypeScript package: a small local daemon, SQLite, `ts-fsrs` and a Vue PWA served by the same daemon. Rails was considered and rejected because every user would need Ruby and Postgres on their machine. Challenge this if you see a better option.
4. **The capture contract.** The normalized event that every agent adapter sends to the daemon, and what is left out of v1.
5. **Generation and quality.** Local model or the user's own key, how bad questions get caught before they reach the phone, and the per-session card cap.
6. **The phone.** How it reaches the daemon (LAN, `tailscale serve`), pairing, and whether notifications belong in v1. Show me rendered mockups for any UI choice, never only prose, and consult more than one design skill.
7. **Privacy defaults.** What never leaves the machine and what never reaches an LLM.
8. **Agent harness.** Which parts of `~/dev/rails-vue-starter` to port so agents can build this safely: the `CLAUDE.md`/`AGENTS.md` index, a fast `bin/check` run by the Stop hook, the guard against loosening tests and checks, the `commit-msg` hook, ADRs and `docs/research/versions.md` with cooldowns.

Deliverables when we agree: a spec in `docs/specs/`, one ADR per real decision in `docs/adr/`, and an implementation plan for the first loop. Do not write product code during the brainstorm.

The project is named ownship; [ADR-001](adr/001-name.md) records why.
