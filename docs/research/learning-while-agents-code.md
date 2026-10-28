# Learning while the agent codes: research for an open-source, local-first tool

> Translated from the Spanish original, [learning-while-agents-code.es.md](learning-while-agents-code.es.md). When the two disagree, the original wins.

**Short answer: the idea has real room and solid backing.** The problem is documented: in a controlled trial by Anthropic, people who learned a new library with AI scored 17% lower on comprehension. The techniques you propose (retrieval practice, spaced repetition, Parsons problems, self-explanation) are among the strongest findings in learning science. And nobody offers today the specific combination of _interactive lessons generated from your real diffs + spaced repetition + phone use + 100% local + open-source_. The closest are Contral, a commercial IDE, and terminal plugins for Claude Code that neither span agents nor reach the phone. My recommendation is to build it, but with an MVP much smaller than the full vision. First: agent-agnostic capture, retrieval-practice cards about your own code, FSRS scheduling and a PWA served over the LAN or Tailscale Serve. I would leave out of version 1 the motion-graphics videos, TTS, and Remotion as a dependency (because of its license).

## TL;DR

- **The problem is real and measurable:** in Anthropic's RCT (52 developers, mostly junior) the AI group scored 50% on the quiz and the no-AI group 67%, with no significant gain in speed. Russinovich and Hanselman (CACM, April 2026) explicitly call for "AI systems that capture reasoning, surface misconceptions and turn daily work into teachable moments", which is almost a description of this product.
- **The gap is in the combination, not the pieces:** Claude Code has "Learning/Explanatory" modes, there is a commercial IDE (Contral) and several open-source quiz plugins with spaced repetition for Claude Code. None combines agent agnosticism, exercises on your real diff, FSRS, the phone and local privacy by default.
- **Recommended architecture:** agent hooks (Claude Code/Cursor/Codex) + a git watcher as fallback → concept extraction with an LLM (local with Ollama by default, optional cloud with your own key) → interactive cards with ts-fsrs → PWA over SQLite served on the LAN or with `tailscale serve`. Apache-2.0 license and animations with MIT libraries (Motion Canvas/framer-motion), not Remotion.

## Key findings

### 1. Landscape: what exists and what is missing

**Commercial products**

- **Contral** (https://contral.ai): presents itself as "the teaching layer for any AI agent". It is its own IDE with extensions for Cursor, Copilot, Claude Code, Codex, Windsurf and Antigravity. It has three modes: _Build_ (explains each function the agent writes with "learning cards"), _Learn_ (a structured curriculum, starting with Java) and _Defense_ (asks you to explain what was built before you ship). According to its AppSumo listing, it launched on March 21, 2026 and already passed 1,500 beta users; the public IDE appeared around May 10, 2026, according to the NG Tech tracker. The free plan, according to third-party directories, includes 25 AI messages a day. It is the most direct conceptual competitor, but it is a closed freemium product focused on explaining _live_ inside the IDE, not on spaced repetition or mobile use during idle time.
- **Claude Code output styles** (https://code.claude.com/docs/en/output-styles): _Explanatory_ adds "Insights" blocks, and _Learning_ also leaves `TODO(human)` markers for you to write parts of the code. The documentation warns that both produce longer answers and spend more output tokens. They interrupt the flow on purpose, which is exactly what you want to avoid. There is no later review either.
- ChatGPT has a "Study Mode" (mentioned by InfoQ). It is generic and not tied to your code.

**Open source (GitHub)**

- **cufelix/learn-claude-code**: a tutor inside Claude Code with quizzes graded by a `PostToolUse` hook and review in Leitner boxes (1, 3, 7 and 21 days). It proves hooks work for this.
- **kirilxd/claude-tutor** (MIT): learning plans, adaptive quizzes, SM-2 and a web dashboard. The scope is "any topic", not your diff.
- **hluaguo/learn-faster-kit**: a coach with a syllabus and a spaced-repetition `/review` for Claude Code.
- **nagisanzenin/engram**: a Claude Code plugin with FSRS and free-recall verification.
- **ChenChenyaqi/learn-anything**: Socratic deep dives and TDD-style exercises for Claude Code and Codex.
- **olmps/memo**: programming-oriented SRS (Flutter), with no agent integration.
- The GitHub topic pages `quiz-generator` (287 repos) and `spaced-repetition` (2,372 repos) show that generating quizzes with an LLM and reviewing with SRS is already a commodity.

**What is missing (the differentiation):**

1. **Exercises on today's real diff**, not on "topics". For example, "find the bug" injected into the code the agent just wrote, Parsons problems with your own lines, or "why X and not Y?" about a real decision from the transcript.
2. **Out of band and asynchronous:** it does not interrupt the agent or the terminal; you use it on the phone while you wait.
3. **Agent-agnostic** (Claude Code, Cursor, Codex, Aider, or anything that makes commits).
4. **Local and private by default**, suitable for company code.
5. **Truly open source.** All the plugins above live _inside_ a Claude Code session.

### 2. Evidence for the problem

| Study                                                                                        | What it measured                                                 | Result                                                                                                                                                                                                            | Honest reading                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic, Shen and Tamkin (Jan/Feb 2026), arXiv 2601.20245                                  | RCT with 52 developers (mostly junior) learning the Trio library | Quiz: 50% with AI vs 67% without. No significant speed difference                                                                                                                                                 | Measures the _formation_ of new skills, not atrophy in seniors. They used a chat assistant, not an agent; the authors expect "more pronounced" effects with agents. People who used AI for conceptual questions learned well.                                                                                                                                                                                                                              |
| Russinovich and Hanselman, _Communications of the ACM_ 69(4), pp. 41–44, DOI 10.1145/3779312 | Opinion essay, not an experiment                                 | "AI boost" for seniors, "AI drag" for juniors; they propose "preceptorship at scale"                                                                                                                              | Opinion, though very influential. They cite a Harvard study (Hosseini Maasoum and Lichtinger, "Generative AI as Seniority-Biased Technological Change", SSRN 5425555, with résumé data from about 62 million workers) which found that after adopting AI, junior employment falls in those firms compared with non-adopters while senior employment holds, mostly because they hire less.                                                                  |
| METR (Jul 2025), arXiv 2507.09089                                                            | RCT with 16 experienced open-source developers and 246 tasks     | With AI they took 19% longer (CI +2% to +39%), though they believed they were 20% faster                                                                                                                          | About productivity and _self-perception_, not learning. It shows developers do not assess themselves well, which supports calibrated confidence ratings. In February 2026, METR reported on its own blog that among the original developers who returned it now estimates an effect of −18% (CI −38% to +9%), and −4% among newly recruited ones. It warns these data give an "unreliable signal" because of selection bias, so the number is of its time. |
| Stack Overflow Developer Survey 2025 (49,009 responses)                                      | Trust in AI                                                      | 84% use or plan to use AI; 46% distrust its accuracy vs 33% who trust it; only 3% "highly trust" it                                                                                                               | Indirect evidence: developers need to verify, and that requires understanding the code.                                                                                                                                                                                                                                                                                                                                                                    |
| GitClear 2025 (211 M lines) and 2026                                                         | Code quality                                                     | "Moved" lines (refactoring) fell from 24.1% (2020) to 9.5% (2024); copy/paste rose from 8.3% to 12.3%. In the 2026 report, refactoring at 3.8% so far in 2026 and duplicated blocks from 40.3 to 73.0 per million | Correlational. It does not prove AI causes it line by line, and GitClear sells quality tools.                                                                                                                                                                                                                                                                                                                                                              |

**Interpretation:** the strongest evidence (Anthropic) is about _learning new things with AI_, which is exactly the case of a developer who lets the agent use a library they do not know. "Atrophy" in seniors is less proven. I recommend positioning the product as **"don't lose your understanding of what ships under your name"** rather than "your brain is rotting". It is more honest and easier to defend.

### 3. Learning science: what is supported and what is not

**Strongly supported (meta-analyses):**

- **Retrieval practice / testing effect:** Rowland (2014, _Psychological Bulletin_) g = 0.50 (CI 0.42–0.58; 159 effect sizes) and g = 0.73 with feedback vs 0.39 without. Adesope, Trevisan and Sundararajan (2017, _Review of Educational Research_) g = 0.61 (272 effects, about 15,400 participants) against all comparison conditions; against rereading it is reported at about 0.51. **Implication:** the core of the product should be questions, not explanations.
- **Generation effect:** Bertsch et al. (2007, _Memory & Cognition_) d = 0.40 (445 effects), larger with long intervals. It supports "predict the output" and free-text answers.
- **Self-explanation:** Bisra et al. (2018, _Educational Psychology Review_) g = 0.55 (CI 0.45–0.65) and g = 0.67 against not explaining. It supports the Feynman-style exercise.
- **Interleaving:** Brunmair and Richter (2019, _Psychological Bulletin_) g = 0.42 overall. It is larger when categories resemble each other (mathematics 0.34) and **negative for word lists** (−0.39). **Implication:** interleave similar concepts that get confused (e.g. `Promise.all` vs `allSettled`), not just anything.
- **Spaced repetition, FSRS vs SM-2:** in the open srs-benchmark, FSRS-6 has lower log-loss than SM-2 in 99.6% of collections (SM-2 log-loss ≈ 0.72 vs ≈ 0.34 for FSRS-6). The benchmark itself acknowledges two caveats: SM-2 was not designed to predict probabilities, and the benchmark comes from the same team that built FSRS. It also measures _prediction_, not learning. Still, FSRS is the de facto standard (Anki has shipped it since 23.10). **Use FSRS.**

**Supported in computing education:**

- **Parsons problems:** Ericson, Margulieux and Rick (Koli Calling 2017) found that solving 2D Parsons problems with distractors takes significantly less time than fixing or writing the equivalent code, with no significant difference in learning or in retention after a week. In 2–3 minute sessions on the phone, that efficiency is gold. Nuance: Harms et al. (2016) saw that distractors _lower_ efficiency in young novices, so they should be adaptive.
- **"Find the bug" and "predict the output":** they are supported as variants of code correction and generation, but this research found no specific meta-analyses. Treat them as a reasonable hypothesis.

**Cognitive load: why a passive background video would be a bad idea**

- Mayer's principles (Mayer and Fiorella 2014; Mayer 2017) have large median effects: **redundancy** d ≈ 0.86–0.87 (do not put narration and the same text on screen), **spatial contiguity** d ≈ 0.79–1.10 (the explanation next to the code, not on another screen), **segmenting** d ≈ 0.70 (short clips controlled by the user) and **modality** d ≈ 0.72–0.76 (narration + graphic beats text + graphic).
- **Multitasking:** Sana, Weston and Cepeda (2013, _Computers & Education_) found that students who multitasked on a laptop during a lecture did worse on comprehension, and so did those who merely saw a neighbor's screen. **Implication:** no "background video while you code". Sessions must be short and in the _foreground_ during the wait, with short segmented animations that advance with a tap and sit next to the code.

**Grading free text with an LLM: useful, with care**

- GPT-4o on university quizzes (arXiv 2511.10819) reached a correlation of up to 0.98 with humans, but only **55% exact agreement**: it graded lower in 38.8% of cases and higher in 6.2% (κ = 0.515).
- In physics (_Physical Review PER_, 2025), with rubrics explaining each item and a self-consistency mode, the LLM reached human-level agreement, and rubric explanations aimed at the LLM's weaknesses were key.
- Other studies show the opposite: leniency in medical education and low agreement with humans in a CEUR study. A study with a _local_ model (MDPI _Computers_, 2026) found systematic leniency, correctable by calibration.
- **Design implication:** use explicit per-item rubrics, show feedback as "hints" rather than a final grade, let the user dispute it ("I disagree") and use the self-rated confidence as the main signal for FSRS.

**Quality of LLM-generated questions**

- Doughty et al. (ACE 2024) compared 651 GPT-4 MCQs with 449 human ones in Python. Quality was "comparable" and alignment with objectives better, but there were **more questions with several correct answers (4.9% vs 1.1%)** and more distractors that give the answer away (4.0% vs 0.9%).
- Sarsa et al. (ICER 2022, Codex): only about 30% of generated exercises had a solution that passed their own tests, and 67.2% of line-by-line explanations were correct. Current models are better, but the lesson stands: **validate automatically**. For "predict the output", run the code instead of asking the LLM. For "find the bug", check that the injected bug breaks a test.

**Doomscrolling and habits (weak evidence, opinion)**
This research found no solid studies on "replacing doomscrolling with microlearning" among developers. My design recommendation is opinion based on principles: the trigger already exists (the agent starts working or is left waiting) and the notification should arrive _only_ at that moment. Sessions of 1–3 cards that can be closed without guilt, a low daily cap, no punitive streaks and a "not now" button that snoozes. What to measure is retention at 7 and 30 days, not minutes of use.

### 4. Recommended technical architecture

**4.1 Activity capture (agent-agnostic)**

| Source                  | Mechanism                                                                                                                                                                                                                                                                                                 | What it delivers                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Claude Code             | `PostToolUse` (Edit/Write), `Stop` (includes `last_assistant_message`) and `SessionEnd` hooks. All receive `transcript_path` (JSONL)                                                                                                                                                                      | Diffs, the agent's reasoning and the exact moment "the agent finished or is waiting" |
| Cursor (≥1.7)           | `.cursor/hooks.json` or `~/.cursor/hooks.json`: `afterFileEdit` (with old/new `edits`), `stop`, `sessionStart/End`, `afterAgentResponse`, `afterAgentThought`                                                                                                                                             | Edits and the agent's "thoughts"                                                     |
| Codex CLI               | Experimental hooks since v0.114.0 (Mar 2026), which according to openai/codex issue #14754 brought only `SessionStart` and `Stop`. According to a community changelog (shanraisshan/codex-cli-hooks), `PreToolUse` and `PostToolUse` were added in v0.117.0 (Mar 26, 2026). **Check the current version** | At least the end of a turn                                                           |
| Any agent (Aider, etc.) | A git `post-commit` hook + a filesystem watcher on the working tree                                                                                                                                                                                                                                       | Plain diffs, no reasoning                                                            |

Design: a **local daemon** (`learnd`) with an HTTP endpoint on localhost. Each adapter is a minimal script that sends a normalized event (`{agent, repo, diff, rationale?, transcript_ref, ts}`). Adding a new agent is then a 20-line file. MCP is optional: it lets the agent _ask_ ("which concepts does the user already master?") and adjust its explanations, but capture does not need it.

**4.2 Concept extraction and generation**

- Batch per `Stop` event or per commit, not per edit, to save cost.
- Pipeline: diff → filtering (ignore lockfiles, generated code and secrets) → an LLM that extracts 1 to 3 "teachable concepts" with evidence (lines) → a generator per exercise type → **deterministic validators** (run the code for "predict the output", tests for "find the bug", a parser for Parsons) → FSRS queue.
- **Local vs cloud:** local by default with Ollama, llama.cpp or LM Studio (all expose an OpenAI-compatible API, so a single client works). Cloud only if the user brings their own key. I did not benchmark small models for question generation myself; the MDPI study suggests a local model _can_ grade reasonably if leniency is calibrated. Recommendation (opinion): let generation be asynchronous, since it does not matter if it takes 40 seconds, and use validators to make up for the lower quality of small models.

**4.3 Interactive lessons and animation**

- **Remotion: do not use it as a core dependency.** According to its v5 Terms (https://www.remotion.dev/docs/terms), Remotion "is not open source according to the OSI definition". It is free for individuals, organizations of up to 3 people and non-profits. An organization of **4 or more people** needs a Company License (the count includes "all staff, whether they use Remotion or not"). **Embedding the `<Player>` counts as "automation"**, which for Company users requires "Remotion for Automators", with a **minimum spend of US$100/month**. "Commercial use" also includes internal tools at for-profit companies. In practice: if a developer uses it on their work laptop at a company of 4+ people, the company probably needs a license. That kills corporate adoption.
- **MIT alternatives** (according to the ecosystem's own comparison): **Motion Canvas**, **Revideo** and **Manim**, plus **framer-motion/Motion** for UI animation in React. My recommendation: in the MVP, simple UI animations (highlighting lines, data-flow arrows, execution _stepping_) with framer-motion. Motion Canvas only for richer "explainers" in a later phase.
- **TTS (optional, phase 3):** **Kokoro-82M** (Apache-2.0, 82 M parameters, runs on CPU; note it depends on espeak-ng, which is GPL) or **Piper**, whose original repo rhasspy/piper (MIT) was archived and now continues as OHF-Voice/piper1-gpl (**GPL-3.0**, each voice with its own license). For an Apache project, Kokoro as a separate process fits better. Remember the redundancy principle: with voice, do not repeat the same text on screen.

**4.4 Spaced repetition and storage**

- `ts-fsrs` (TypeScript) or `py-fsrs` (Python) depending on the stack, both from open-spaced-repetition.
- **SQLite** as the source of truth: a single file, easy to back up and the same format Anki uses.
- Export to **Obsidian-compatible Markdown** (one note per concept with the snippet and the explanation) and to **Anki** (.apkg) for simple questions.

**4.5 Serving the phone for free**

| Option                                      | Free                                                                                                                      | Privacy                                          | Comment                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **LAN-only** (bind to the local IP + token) | Yes                                                                                                                       | Maximum                                          | Works at home and at the office on the same network. Safe default.                                                                                                       |
| **Tailscale Serve**                         | Personal plan: $0, up to 6 users, unlimited devices                                                                       | Your tailnet only, automatic HTTPS on `*.ts.net` | **Note:** the Personal plan is "for non-commercial use only". Using it for work at a company is a gray area; the right choice there is the company tailnet or Headscale. |
| **Tailscale Funnel**                        | Yes                                                                                                                       | **Public on the internet**                       | Do not use. It exposes the server; only ports 443/8443/10000 and no built-in authentication.                                                                             |
| **Headscale**                               | Yes (self-hosted)                                                                                                         | High                                             | Open-source control server compatible with Tailscale clients. For advanced users or companies.                                                                           |
| ZeroTier / NetBird                          | Smaller free plans (according to ZeroTier's official pricing page, its free Personal plan gives 10 devices and 1 network) | High                                             | Valid alternatives.                                                                                                                                                      |
| Cloudflare Tunnel / ngrok                   | Free with limits                                                                                                          | **Low for proprietary code**                     | Traffic goes through third parties and is public unless you add auth. Not recommended as a default.                                                                      |

- **A PWA beats a native app** for the MVP: one codebase, no stores and "installable". Web push notifications on iOS require adding the PWA to the home screen (iOS 16.4+, general knowledge not verified in this research). The simplest alternative is **ntfy** (self-hostable) for the "your agent is working, 2 minutes?" nudge.
- **Minimum security:** bind to `127.0.0.1` by default, phone pairing by QR with a long-lived token, strict CSRF/CORS, never serve the raw repo (only already-extracted snippets) and an access log.

**4.6 Privacy and company code**

- A "company" mode with no network egress: local Ollama, no telemetry and an allowlist of repos.
- Secret scanning before any LLM call (gitleaks or similar), honoring `.gitignore` plus a `.learnignore`.
- An honest argument for teams: if the company _already_ authorized Claude Code or Cursor to send that code to its provider, reusing **the same provider under the same agreement** does not widen exposure. The default should still be local. This is opinion, not legal advice.

### 5. Open-source strategy

- **License: Apache-2.0** (informed opinion). It is permissive like MIT and also grants an explicit patent license, which corporate legal teams value. AGPL protects against SaaS forks, but many companies ban it, and the key use case is _the developer at work_. If you fear a commercial fork, keep the core Apache and reserve the trademark.
- **Dependencies:** keep anything source-available (Remotion) or GPL (Piper, espeak-ng) out of the core; isolate them as optional plugins in separate processes.
- **Plugins:** three extension axes with simple contracts: (1) agent adapters, (2) exercise generators (type + validator), and (3) language packs (bug-injection and Parsons rules per language).
- **Growth (opinion):** the Claude Code plugins above grow through "awesome" lists (e.g. awesome-claude-code already lists learn-faster-kit). A 20-second demo GIF ("the agent writes, your phone asks why it used `useMemo`") is worth more than any README. Make installation `npx <name> init` and detect which agents you have.
- **Optional monetization:** team-curated packs ("codebase onboarding") or a team version with _opt-in_ aggregate metrics. Note: Russinovich and Hanselman argue precisely that organizations should measure junior growth, so there is a B2B "preceptorship" angle with data.
- **Naming/positioning (opinion):** something that evokes "while you wait". Ideas: _Meanwhile_, _Idle_, _Recall_, _Sobremesa_. Tagline: "Understand what your agent ships under your name".

## Recommendations: MVP and roadmap

**MVP (4–6 weeks, 1 person)**

1. Daemon + adapters for Claude Code (hooks) and Cursor (hooks), plus a git `post-commit` fallback.
2. Generation on the Stop event or commit: at most 3 cards per session, of 4 types: **conceptual MCQ**, **predict the output** (validated by running it), **Parsons** with your lines and **"why X and not Y?"** taken from the transcript's reasoning.
3. FSRS (ts-fsrs) + SQLite + a confidence rating before revealing the answer.
4. A mobile PWA served on the LAN or with `tailscale serve`, with QR pairing and an ntfy notification when the agent starts a long task.
5. Ollama by default and an optional API key.

**v0.2:** injected "find the bug" validated with tests, Feynman-style explanation graded with a rubric (as a suggestion, not a grade), export to Obsidian and Anki, a Codex adapter.
**v0.3:** micro-animations (framer-motion or Motion Canvas) for execution flows, "review the agent's PR", interleaving of concepts that get confused.
**v1.0:** optional TTS (Kokoro), third-party plugins, team mode.

**Success metrics:** accuracy on the first review at 7 days, share of cards flagged as "bad question" (goal: under 10%), sessions started from a notification vs ignored, and uninstalls.

## Main risks

| Risk                                                                                              | Severity | Mitigation                                                                                                     |
| ------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| Annoyance or friction                                                                             | High     | Notify only during real idle time, a daily cap, "not now", zero punitive streaks                               |
| Bad or ambiguous questions (in Doughty 2024, 4.9% of GPT-4 MCQs had more than one correct answer) | High     | Deterministic validators, a "bad question" button that trains filters, prefer verifiable exercise types        |
| Lenient or inconsistent LLM grading                                                               | Medium   | Explicit rubrics, self-consistency and non-punitive feedback                                                   |
| LLM cost                                                                                          | Medium   | Per-session batches, a local model by default, a per-concept cache (do not regenerate `async/await` every day) |
| Company privacy policies                                                                          | High     | Local by default, an allowlist, secret scanning and documentation ready to send to security                    |
| Third-party licenses (Remotion, Tailscale Personal "non-commercial", Piper GPL)                   | Medium   | An Apache core without those dependencies; LAN and Headscale as alternatives                                   |
| Changes in hook APIs (Codex is experimental)                                                      | Medium   | An adapter layer plus the git fallback                                                                         |

## Caveats

- The strongest deskilling evidence (Anthropic) measures skill _formation_ in a single experiment, with an immediate quiz and a chat assistant. It does not prove long-term atrophy in seniors, and the authors themselves say so.
- The meta-analytic effects (g ≈ 0.4–0.6) come mostly from labs and classrooms, not from professional developers in mobile micro-sessions. It is a reasonable extrapolation, not a guarantee.
- The FSRS vs SM-2 benchmark measures recall prediction, was made by the FSRS team and compares against an adapted SM-2.
- This research did not directly verify: the current quality of small local models for generating and grading questions, the details of web push on iOS, or studies on replacing doomscrolling. The recommendations on those points are opinion.
- Remotion's v5 Terms are marked as "upcoming" (they apply from Remotion 5.0). The current version 4 has terms similar in essence (the 4-person threshold), but review them before deciding.
- Sources disagree on Tailscale's free plan (some still say 3 users and 100 devices). The official pricing page says 6 users, unlimited devices and non-commercial use.
