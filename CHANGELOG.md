# Changelog

Notable changes to ownship. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A home screen: how many cards are due, a button that starts a session, each repo with its due count and last turn, and the knowledge notes. Tapping a repo starts a session with that repo's cards only.
- A session has a fixed size and ends with a summary: how many you reviewed, how many were right the first time, how many come back soon and how many are still due, with a button for the next session.
- The knowledge notes can be read in the app, on every paired device.

### Changed

- "Not now" and "This card is wrong" sit in the card's top bar, so a long card no longer has to be scrolled to reach them, and the correction form opens right below it.

### Fixed

- A session no longer loads more cards on its own, so its counter no longer jumps ("9 of 12" to "12 of 14"), "You're all caught up" no longer flashes between batches, and the last card answered no longer comes straight back.
- After an update, the next ownship command or agent turn restarts a daemon older than the installed version instead of reusing it.

## [0.1.1] - 2026-10-29

### Changed

- Releases are staged on npm from GitHub Actions through trusted publishing, with provenance, and go public after a maintainer approves them.
- The README says what generation costs, where to look when something fails and how to contribute.

### Fixed

- Running `ownship init` again after an update or from another install replaces ownship's old Stop hook instead of adding a second one next to it.

## [0.1.0] - 2026-10-29

### Added

- The first end-to-end loop for Claude Code and Codex: capture from the agents' session logs with a git snapshot per turn, cards written by the user's own agent with every quote checked against the turn, FSRS scheduling with two ratings, knowledge notes from cards flagged as wrong, a token-authenticated local daemon, and a review app for the phone and the desktop in English and Spanish.
- `ownship init` in one step: it detects the language, installs the Stop hooks, starts the daemon, opens the app already paired and shows the phone QR over Tailscale.
- `ownship open`, `pair`, `status`, `config`, `start`, `stop` and `uninstall [--purge]`.
- A public [roadmap](ROADMAP.md), a contributing guide, a code of conduct and a security policy.

[Unreleased]: https://github.com/crow-rojas/ownship/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/crow-rojas/ownship/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/crow-rojas/ownship/releases/tag/v0.1.0
