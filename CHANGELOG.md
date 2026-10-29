# Changelog

Notable changes to ownship. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-10-29

### Added

- The first end-to-end loop for Claude Code and Codex: capture from the agents' session logs with a git snapshot per turn, cards written by the user's own agent with every quote checked against the turn, FSRS scheduling with two ratings, knowledge notes from cards flagged as wrong, a token-authenticated local daemon, and a review app for the phone and the desktop in English and Spanish.
- `ownship init` in one step: it detects the language, installs the Stop hooks, starts the daemon, opens the app already paired and shows the phone QR over Tailscale.
- `ownship open`, `pair`, `status`, `config`, `start`, `stop` and `uninstall [--purge]`.
- A public [roadmap](ROADMAP.md), a contributing guide, a code of conduct and a security policy.

[Unreleased]: https://github.com/crow-rojas/ownship/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/crow-rojas/ownship/releases/tag/v0.1.0
