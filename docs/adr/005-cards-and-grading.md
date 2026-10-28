# ADR-005: Card kinds, evidence and grading

- Status: accepted
- Date: 2026-10-28
- Deciders: owner

## Context

The owner is asked, in reviews and meetings, how they thought about a problem, the tradeoffs and the pattern used. That is not something code execution can check. LLM-written questions also fail in known ways: Doughty et al. (ACE 2024) found more multiple-choice items with several correct answers than in human-written ones (4.9% vs 1.1%), and LLM grading of free text is inconsistent (see the main research file).

## Decision

- **Four kinds, mixed in each session**: _defend the decision_ (a free answer to "why X and not Y?" about a real decision of the turn), multiple choice with exactly one right option, short text with a list of accepted answers, and number with an optional tolerance.
- **Every card carries evidence**: quotes from the turn's patch, prompt or messages. The daemon checks that each quote appears in the turn, whitespace-normalized, and discards cards that fail.
- **No LLM grades anything.** Deterministic kinds are graded against their key. _Defend the decision_ shows the reference as 2 or 3 key ideas, and the user ticks the ones their answer contained.
- **Two FSRS ratings, Again and Good.** All key ideas ticked, or a right answer, is Good; anything else, including "I don't know", is Again. "Not now" removes the card from the session without a rating.
- **"This card is wrong"** on every card, with an optional note that becomes a knowledge note for the repo (ADR-006).

## Why key ideas instead of a self-rating

People scoring their own open answers tend to be overconfident, and that overconfidence lowers what they learn (Dunlosky and Rawson, "Overconfidence produces underachievement", _Learning and Instruction_ 22(4), 271–280, 2012). Breaking the reference answer into idea units is the procedure that study line uses to make self-scoring more accurate (Rawson and Dunlosky, 2007, _European Journal of Cognitive Psychology_; **citation not verified yet, check before relying on it**).

On two ratings: Anki forum analyses suggest FSRS loses little or no accuracy when only Again and Good are used, and that users who press Hard for a failure hurt the schedule ([forum thread](https://forums.ankiweb.net/t/pass-fail-grading-as-default/34147)). This is community analysis, not official guidance, and one follow-up was inconclusive.

## Alternatives not taken

- **Four buttons (Again, Hard, Good, Easy)**: more signal in theory, more misuse in practice, and one more decision per card on a phone.
- **LLM grading of free answers**: inconsistent and often lenient.
- **Only deterministic kinds** (predict the output, Parsons): train language semantics, not the reasoning the owner is asked about.

## Consequences

- A _defend the decision_ card is only as good as its key ideas; the "card is wrong" share (target under 10%) is the signal to watch.
- New kinds must follow the evidence rule and map to Again or Good.
