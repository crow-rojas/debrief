# Home and session end: design

- Status: draft, agreed in a brainstorm on 2026-10-29 (option B of three: a session end only, a simple home, a home with views)
- Builds on: [v1 design](2026-10-28-ownship-v1-design.md), section 6 (review app); [ADR-007](../adr/007-privacy-and-access.md) (what reaches the phone, amended for this change)
- Marked **(builder's call)** where the conversation left a choice open and the author picked a default; everything else was decided with the owner.

## Intent

The review app is one screen today: it loads five due cards, and when they run out it silently loads five more. On the owner's first real use on the phone this felt broken. After "9 of 12" the "You're all caught up" screen flashed and a second later another card appeared as "12 of 14". The count was never the real total, because it was what had been answered plus what was left in the current batch, and the empty state showed while the next batch loaded.

The v1 design asks for "sessions of a few cards that can be closed at any time". This change gives a session a real start and a real end, and gives the app a place to land between sessions: a home that says how much is due and where it comes from.

**It worked when** opening the app tells you in one glance how many cards are due, one tap starts a short session, and finishing it says what you did and what is left, with nothing appearing on its own.

## Goals

1. A home screen: how many cards are due now, a button that starts a session of 5, the repos with their due counts and last turn, and a way to the knowledge notes.
2. A session has a fixed size, chosen when it starts. Its counter ("2 of 5") never changes total mid-session, and it never loads more cards on its own.
3. A session end screen: how many you reviewed, how many were right the first time and how many come back soon, how many are still due, and two buttons, continue with the next session or go home.
4. Tapping a repo on the home starts a session with that repo's due cards only.
5. A read-only list of the knowledge notes, on every paired device.
6. When nothing is due, the home says so and, when there are cards, when the next one is due.

## Non-goals

- Progress or mastery views, retention charts, per-repo detail pages. They wait for weeks of reviews to show (option C).
- Editing or deleting notes from the app. The files under `~/.ownship/knowledge/` stay the place to edit them.
- The visual design and motion pass from the roadmap. This change reuses the current styles, the "Now" design work restyles it later.
- Merging repos that were renamed. The owner reset their data, so no renamed repo exists today.

## Anti-goals

- Streaks, daily goals or anything that punishes a missed day (v1 design, anti-goals).
- Numbers that move on their own: a total that grows mid-session, or a "caught up" message while cards are due.
- Continuing silently. Starting the next session is always the user's tap.

## Decided

- **Session size 5**, as today. "Continue" starts another session of up to 5 from what is due at that moment.
- **Cards answered "again" are not repeated inside the session.** FSRS brings them back minutes later. They show up in the next session if they are due by then, and the end screen counts them as "come back soon".
- **"Not now" and "This card is wrong"** count as done for the session counter, as today. They are not reviews, so the end screen does not count them as right or "come back soon".
- **The home shows every repo that has at least one active card**, including those with 0 due, sorted by the most recent turn. **(builder's call)**
- **A session keeps its scope.** "Continue" after a repo session starts another session of that repo, and the end screen's "still due" is that repo's count (`repos[].due`). After a session of all repos, both are global. "Go home" always shows everything. **(builder's call)**
- **"Not now" hides a card for the rest of the visit**, as today: the skipped ids stay in memory and the server still treats the cards as due. The "still due" numbers in the app subtract the skipped cards of that scope, so "Continue" never opens an empty session, and a reload shows them again. **(builder's call)**
- **The repo name is shown without its hash suffix**, as the card header already does (`api-1234abcd` → `api`). **(builder's call)** Two repos that differ only in the hash show the same name. That is rare and acceptable for now.

## Shape of the change

### Daemon API (`src/daemon/server.ts`)

- `GET /api/home` returns `{ due, nextDueAt, repos: [{ slug, due, lastTurnAt }], notes }`:
  - `due`: active cards with `due <= now`;
  - `nextDueAt`: the earliest `due` among active cards that are not due yet, or `null`;
  - `repos`: one entry per repo with at least one active card;
  - `notes`: the number of note files under `~/.ownship/knowledge/`.
- `GET /api/session` gains an optional `repo=<slug>` that limits the session to that repo. The existing `limit` and ordering stay.
- `GET /api/notes` returns the notes newest first, as `{ slug, file, text }`. `readNotes` in `src/knowledge/notes.ts` already reads one repo's notes.
- All three sit behind the existing token auth, like the other `/api/` routes.

### Review app (`app/`)

- Three views: home, session, notes. `App.vue` switches between them. **(builder's call)** Navigation uses the URL hash (`#/`, `#/session`, `#/session?repo=<slug>`, `#/notes`) with the browser's `hashchange` event, not a router dependency, so the phone's back button works and nothing new is installed.
- The session view loads its cards once when it starts and keeps the batch size as the counter's total. When the last card is done, it waits for pending saves (as it does since #16), asks `/api/home` for what is still due, and shows the end screen.
- The end screen counts the session's own results: the ratings returned by `answer` ("good" counts as right the first time, "again" as come back soon).
- The home uses `/api/home` and is where the app opens and where "go home" leads. The current empty state becomes the home's "nothing due" state.
- Every new string goes in `app/i18n/en.json` and `es.json` together (rule 2), and the Spanish is neutral.

### Tests

- Server: `/api/home` counts, `nextDueAt` and repos, and `/api/session?repo=` filtering, in `test/daemon/server.test.ts`.
- App: the home renders the counts and starts a session; a session keeps its total and shows the end screen without loading more; "continue" starts a new session; a repo tap starts a filtered session; the notes list renders. These go in `test/app/`, next to `session.test.ts`.

## Notes on the phone

Decided with the owner: the notes list is part of the app on every paired device, and [ADR-007](../adr/007-privacy-and-access.md) is amended to say so. A desktop-only list was not an option: the daemon cannot tell the phone from the desktop, because both use the same token and `tailscale serve` traffic arrives from `127.0.0.1`.

## Left to the builder

Component structure, the exact copy in both languages, how the end screen and home look within the current styles, how `nextDueAt` is phrased ("in 3 hours"), the loading and error states of the new views, and whether the hash helper is a composable or a few lines in `App.vue`.
