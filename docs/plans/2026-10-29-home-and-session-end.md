# Home and session end Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the review app a home (what is due, per repo, the notes) and give each session a fixed size and a real end screen, so nothing loads on its own and no number jumps.

**Architecture:** Three read-only endpoints in the daemon (`/api/home`, `/api/notes`, and a `repo` filter on `/api/session`), three views in the app (home, session, notes) switched by the URL hash in `App.vue`, and an end screen inside the session view. No new dependency.

**Tech Stack:** TypeScript, Node `node:sqlite`, Vue 3 + vue-i18n, Vitest + @vue/test-utils + happy-dom.

**Spec:** [docs/specs/2026-10-29-home-and-session-end-design.md](../specs/2026-10-29-home-and-session-end-design.md). Read it, and the amended [ADR-007](../adr/007-privacy-and-access.md), before Task 1.

## Global constraints

- No new dependencies, no router: navigation is `location.hash` plus the `hashchange` event.
- No literal UI copy: every new string goes in `app/i18n/en.json` and `app/i18n/es.json` together, Spanish neutral (`test/app/i18n.test.ts` fails when keys differ). Symbols (✓, ›) count as copy unless they are `aria-hidden` SVG.
- Session size 5 (`getSession` default). A session never fetches cards after its first load.
- "Not now" hides a card for the page visit, not just the session.
- The repo name shown is the slug without its `-xxxxxxxx` hash suffix.
- Every new `/api/` route sits behind the existing token check (it is already enforced for all `/api/` paths in `createServer`).
- `bin/check` green after every task; `bin/ci` green before the pull request. Conventional Commits.

## Review focus

1. **The daemon goes down mid-session**: the answer that fails to save puts the card back with the existing "couldn't save" banner, the session total does not change, and the end screen only appears once every card has a saved result. Test in Task 3.
2. **A stale or unknown link** (`#/session?repo=gone-12345678`, a repo with nothing due, or `#/whatever`): the app lands on the home, never a blank screen or an empty session. Test in Task 4.
3. **Unpaired or daemon unreachable on any view**: home, session and notes each show the existing unpaired or error state, not a crash or an empty list. Test in Task 4 (home) and Task 5 (notes).
4. **No cards at all, ever** (fresh install): `/api/home` returns `nextDueAt: null`, `repos: []`, and the home shows the caught-up state without a "next card" line. Test in Task 1 and Task 4.
5. **The knowledge folder is missing or holds non-Markdown files**: `/api/notes` returns `[]` or ignores them, and the home's notes count matches what the notes view lists. Test in Task 1.

---

### Task 1: Daemon endpoints for the home, the notes and repo sessions

**Files:**

- Modify: `src/knowledge/notes.ts` (add `listNotes`)
- Modify: `src/daemon/server.ts` (`session` gains `repo`; add `home`; routes `/api/home`, `/api/notes`)
- Test: `test/daemon/server.test.ts`, `test/knowledge/notes.test.ts`

**Interfaces:**

- Produces:
  - `export type Note = { slug: string; file: string; text: string }` and `export function listNotes(): Note[]` in `src/knowledge/notes.ts`: every `*.md` under `homePath("knowledge")`, all repos, newest first by mtime; `file` is the file name only, never a path.
  - `export type HomeSummary = { due: number; nextDueAt: string | null; repos: { slug: string; due: number; lastTurnAt: string }[]; notes: number }`, exported from `src/daemon/server.ts`.
  - `GET /api/home` → `HomeSummary`. `repos`: one per slug with at least one active card, `lastTurnAt` = max `turns.ended_at` of that slug, sorted by `lastTurnAt` descending. `notes` = `listNotes().length`.
  - `GET /api/session?limit=5&repo=<slug>` → `{ cards }`, filtered to that slug when `repo` is present; ordering and the 50 cap unchanged.
  - `GET /api/notes` → `{ notes: Note[] }`.

- [ ] **Step 1: Write the failing tests**

In `test/knowledge/notes.test.ts`:

- `"listNotes returns every repo's notes newest first, file names only"`: write two notes with `writeNote` for slugs `a-00000000` and `b-00000000` (the second later), plus a `README.txt` in one folder; expect `listNotes().map((n) => n.slug)` to equal `["b-00000000", "a-00000000"]`, every `file` to end in `.md` and contain no `/`.
- `"listNotes is empty when the knowledge folder is missing"`: fresh `tempHome()`, expect `[]`.

In `test/daemon/server.test.ts` (the fixture already has one due card on slug `w-00000000`; add cards with `insertTurn` plus `UPDATE turns SET slug = ? WHERE id = ?` where a second slug is needed):

- `"home counts due cards, the next due time and repos"`: add a not-yet-due card (due in one hour) on slug `x-11111111`; expect `due` 1, `nextDueAt` equal to that card's due, `repos` to contain `{ slug: "w-00000000", due: 1 }` and `{ slug: "x-11111111", due: 0 }` (match with `expect.objectContaining`), ordered by `lastTurnAt` descending, and `notes` 0.
- `"home on a fresh database has no repos and no next due time"`: delete all cards first; expect `{ due: 0, nextDueAt: null, repos: [], notes: 0 }`.
- `"session filters by repo"`: a due card on `x-11111111`; `/api/session?repo=x-11111111` returns only that card, `/api/session` returns both.
- `"notes are listed behind the token"`: `/api/notes` without auth is 401; with auth after one `writeNote` returns one note.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run test/daemon/server.test.ts test/knowledge/notes.test.ts`
Expected: FAIL (`listNotes` is not exported; `/api/home` and `/api/notes` are 404; the repo filter is ignored).

- [ ] **Step 3: Implement `listNotes`, `home(db, now): HomeSummary`, the `repo` filter on `session(db, limit, now, repo?)` and the two routes**

`home` is three SQL queries over `cards` joined to `turns` (active cards only). Keep `readNotes` as it is: the generator uses it.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm vitest run test/daemon/server.test.ts test/knowledge/notes.test.ts`, then `bin/check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/knowledge/notes.ts src/daemon/server.ts test/daemon/server.test.ts test/knowledge/notes.test.ts
git commit -m "feat: serve the home summary, the notes and per-repo sessions"
```

### Task 2: App client and the repo name

**Files:**

- Modify: `app/api.ts`
- Create: `app/repo.ts`
- Modify: `app/components/CardShell.vue:19` (use `repoName`)
- Test: `test/app/api.test.ts`

**Interfaces:**

- Consumes: Task 1's routes and types (`HomeSummary`, `Note`; import the types from `src/`, as `api.ts` already does for `Answer`).
- Produces:
  - `getHome(): Promise<HomeSummary>`, `getNotes(): Promise<Note[]>`, and `getSession(limit = 5, repo?: string): Promise<SessionCard[]>` in `app/api.ts`. `repo` goes through `encodeURIComponent`.
  - `repoName(slug: string): string` in `app/repo.ts`: strips a trailing `-[0-9a-f]{8}`.

- [ ] **Step 1: Write the failing tests** in `test/app/api.test.ts`, following its existing `fetch` mock:
- `"getSession passes the repo, encoded"`: `getSession(5, "a b-12345678")` requests `/api/session?limit=5&repo=a%20b-12345678`; `getSession()` requests `/api/session?limit=5` with no `repo`.
- `"getHome and getNotes read their routes"`: they request `/api/home` and `/api/notes` and return the parsed body (`notes` unwrapped).
- `"repoName strips only the hash suffix"`: `repoName("todo-app-1a2b3c4d")` is `"todo-app"`, `repoName("todo-app")` is `"todo-app"`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run test/app/api.test.ts`
Expected: FAIL (`getHome`, `getNotes` and `repo.ts` do not exist; no `repo` param)

- [ ] **Step 3: Implement the three client functions and `repoName`; switch `CardShell` to `repoName`**

- [ ] **Step 4: Run the tests and `bin/check`**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api.ts app/repo.ts app/components/CardShell.vue test/app/api.test.ts
git commit -m "feat: add the app client for the home, the notes and repo sessions"
```

### Task 3: A session with a fixed size and an end screen

**Files:**

- Create: `app/skipped.ts`
- Modify: `app/components/SessionView.vue`
- Create: `app/components/SessionEnd.vue`
- Modify: `app/i18n/en.json`, `app/i18n/es.json`
- Test: `test/app/session.test.ts`

**Interfaces:**

- Consumes: `getSession(limit, repo)`, `getHome()` (Task 2).
- Produces:
  - `export const skipped = new Map<number, string>()` in `app/skipped.ts`: card id → slug, kept for the page visit.
  - `SessionView` props `{ repo?: string }`. It no longer shows the "caught up" empty state: with 0 cards it navigates home (`location.hash = "#/"`).
  - `SessionEnd` props `{ reviewed: number; right: number; again: number; stillDue: number }`, emits `continue` and `home`. "Continue" is shown only when `stillDue > 0`.
  - New i18n keys under `app.end`: `title` (`{n}` reviewed), `right` (`{n}`), `again` (`{n}` come back soon), `stillDue` (`{n}`), `continue` (`{n}`), `home`.

Behavior: on mount, fetch `getSession(5 + skipped.size, repo)`, drop skipped ids, keep the first 5; that count is the session's total for the "n of total" counter. After the last card, wait for pending saves (the `saving` set from #16), fetch `getHome()`, compute `stillDue` = the scope's due (`repos.find(slug).due` when `repo` is set, else `due`) minus the skipped ids of that scope, and show `SessionEnd`. "Continue" starts a new session in the same scope (reset counters and refetch); "home" sets `location.hash = "#/"`. `right` and `again` count the `rating` values returned by `answer`; "Not now" and flags count toward the counter only.

- [ ] **Step 1: Write the failing tests** in `test/app/session.test.ts` (mock `getHome` alongside the existing mocks; clear `skipped` in `beforeEach`):
- `"keeps its total and shows the end screen instead of loading more"`: session of 2; answer both (`answer` resolves `{ rating: "good" }` then `{ rating: "again" }`); expect the counter to read `2 of 2` on the second card, `getSession` called once, and the end screen with 2 reviewed, 1 right, 1 again.
- `"continue starts a new session in the same scope"`: mount with `repo: "api-1234abcd"`, `getHome` returns that repo with `due: 3`; finish the session, click continue; expect the second `getSession` call to be `(5, "api-1234abcd")` and the counter back at `1 of`.
- `"still due leaves out cards skipped this visit"`: skip one card with "Not now", answer the other; `getHome` returns `due: 1`; expect no continue button.
- `"a failed save keeps the card and the total"`: `answer` rejects once; expect the save-failed banner, the same card still shown, the counter's total unchanged, and no end screen.
- `"an empty session goes home"`: `getSession` resolves `[]`; expect `location.hash` to be `#/`.
- Update the two existing tests that relied on the old reload behaviour (`"waits for the last answer…"` asserts the end screen appears only after the save resolves, instead of a second `getSession` call).

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run test/app/session.test.ts`
Expected: FAIL on the new tests (no end screen, `getSession` called again)

- [ ] **Step 3: Implement `skipped.ts`, the session changes, `SessionEnd.vue` and the copy**

- [ ] **Step 4: Run the tests and `bin/check`**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/skipped.ts app/components/SessionView.vue app/components/SessionEnd.vue app/i18n test/app/session.test.ts
git commit -m "feat: give a review session a fixed size and an end screen"
```

### Task 4: The home and hash navigation

**Files:**

- Create: `app/components/HomeView.vue`
- Modify: `app/App.vue`
- Modify: `app/components/EmptyState.vue` (drop the `empty` variant once nothing uses it)
- Modify: `app/i18n/en.json`, `app/i18n/es.json`
- Test: `test/app/home.test.ts`, `test/app/app.test.ts`

**Interfaces:**

- Consumes: `getHome()`, `repoName()` (Task 2); `SessionView` with `repo` (Task 3).
- Produces:
  - Routes: `#/` (or no hash) → home; `#/session` → session of all repos; `#/session?repo=<encoded slug>` → repo session; `#/notes` → notes (Task 5; until then it falls back to home). Anything else → home.
  - `HomeView`: the due count and a start link to `#/session` (hidden when `due` is 0); one row per repo with its name, due count and last turn as relative time, linking to its repo session only when its due is above 0; a notes row linking to `#/notes` with the count; when `due` is 0 the caught-up title (reuse `app.empty.title`) and, when `nextDueAt` is set, when the next card is due; unpaired and error states via `EmptyState`.
  - New i18n keys under `app.home`: `due` (`{n}`), `start` (`{n}`), `repos`, `repoDue` (`{n}`), `lastTurn` (`{ago}`), `notes`, `notesCount` (`{n}`), `next` (`{when}`).

- [ ] **Step 1: Write the failing tests**

`test/app/home.test.ts`:

- `"shows what is due and links to a session"`: `getHome` returns `due: 8`, repos `api-1234abcd` (5) and `web-87654321` (3), `notes: 2`; expect the text to contain the due count, `api` and `web` without hashes, and links with `href` `#/session`, `#/session?repo=api-1234abcd` and `#/notes`.
- `"a repo with nothing due is listed but not a link"`.
- `"caught up shows when the next card is due"` and `"caught up on a fresh install has no next line"` (`nextDueAt: null`, `repos: []`).
- `"unpaired shows the pairing message"`: `getHome` rejects with `NotPairedError`.

`test/app/app.test.ts`:

- `"routes by hash"`: with `location.hash` `#/session?repo=api-1234abcd`, `App` renders `SessionView` with that `repo` prop; after setting `#/` and dispatching `hashchange`, it renders `HomeView`; `#/whatever` renders `HomeView`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run test/app/home.test.ts test/app/app.test.ts`
Expected: FAIL (`HomeView` does not exist; `App` always renders the session)

- [ ] **Step 3: Implement `HomeView.vue`, the hash routing in `App.vue` and the copy**

Parse the hash with `URLSearchParams` on the part after `?`.

- [ ] **Step 4: Run the tests and `bin/check`**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/components/HomeView.vue app/App.vue app/components/EmptyState.vue app/i18n test/app/home.test.ts test/app/app.test.ts
git commit -m "feat: add a home that shows what is due and starts sessions"
```

### Task 5: The notes list, and the docs

**Files:**

- Create: `app/components/NotesView.vue`
- Modify: `app/App.vue` (route `#/notes`)
- Modify: `app/i18n/en.json`, `app/i18n/es.json`
- Modify: `CHANGELOG.md` (Unreleased), `ROADMAP.md` (the "A home and navigation" item: note what landed and that progress views wait for option C)
- Test: `test/app/notes.test.ts`

**Interfaces:**

- Consumes: `getNotes()`, `repoName()` (Task 2).
- Produces: `NotesView` lists each note with its repo name and its text shown as written (`white-space: pre-wrap`, no Markdown renderer), newest first as served, a link back to `#/`, an empty message when there are none, and the unpaired and error states. New i18n keys under `app.notes`: `title`, `empty`, `back`.

- [ ] **Step 1: Write the failing tests** in `test/app/notes.test.ts`: `"lists notes with their repo"` (two notes, expect both texts and `api` without hash, in order), `"says so when there are no notes"`, `"unpaired shows the pairing message"`.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run test/app/notes.test.ts`
Expected: FAIL (`NotesView` does not exist)

- [ ] **Step 3: Implement `NotesView.vue`, its route, the copy, and the changelog and roadmap entries**

- [ ] **Step 4: Run `bin/ci`, then check it by hand**

Run: `bin/ci`. Then build and start a throwaway daemon on another port with `OWNSHIP_HOME`, `CLAUDE_CONFIG_DIR` and `CODEX_HOME` set to temp dirs and `"generator": "false"` in its config, insert toy cards and one note, and open it at 390×844: home, a session to its end screen, continue, a repo session, the notes list, the back button.
Expected: `bin/ci` green; every screen fits without scrolling to reach its actions.

- [ ] **Step 5: Commit**

```bash
git add app/components/NotesView.vue app/App.vue app/i18n test/app/notes.test.ts CHANGELOG.md ROADMAP.md
git commit -m "feat: list the knowledge notes in the app"
```
