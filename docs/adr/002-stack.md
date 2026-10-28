# ADR-002: Stack and distribution

- Status: accepted
- Date: 2026-10-28
- Deciders: owner

## Context

ownship runs on the user's machine and must install with one command, `npx ownship init`, on macOS, Linux and Windows. It needs a long-running local process, a small database, an FSRS scheduler and a web app for the phone and the desktop.

## Decision

- **One TypeScript package on Node**, developed with pnpm, no workspace. It holds the CLI, the daemon, the readers, the generator and the review app.
- **SQLite through Node's built-in `node:sqlite`.** No native modules, so installing never compiles anything. The minimum Node version is the first one that ships `node:sqlite` without a flag at a stability level we accept; both are pinned in `docs/research/versions.md` with sources.
- **`ts-fsrs`** for scheduling, the official TypeScript implementation from open-spaced-repetition.
- **Vue** for the review app, compiled with Vite at publish time and served as static files by the daemon. Users never run Vite.

## Alternatives not taken

- **Rails**: every user would need Ruby and Postgres.
- **A single binary in Go or Bun**: clean to run, but it fights `npx` and needs one build per OS, and `ts-fsrs` would need a port or a bridge.
- **`better-sqlite3`**: the usual choice, but a native module; when no prebuilt binary matches, `npx` tries to compile it, which fails often on Windows.
- **Electron or a native mobile app**: one web app covers phone and desktop with no store.

## Consequences

- Users on a Node older than the minimum must upgrade; `ownship init` says so and stops.
- The daemon, CLI and app share types without a build boundary.
