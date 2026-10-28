# ADR-006: Knowledge notes as Markdown files

- Status: accepted
- Date: 2026-10-28
- Deciders: owner

## Context

Business rules are not in any manual. When a card is wrong, the user's correction ("this is rejected because of X") is often the only written record of the rule, and it should shape later cards for that repo.

## Decision

- A correction is saved as a Markdown file under `~/.ownship/knowledge/<repo>/`, with the card's evidence. The user can read, edit, grep and version these files.
- The repo's notes are part of the generator's input for every turn of that repo. The generator reads files natively, so there is no index and no embeddings.
- A repo is its git common directory, so worktrees share notes. The folder name is the directory name plus a short hash of the common dir path.
- Card state, FSRS history and turns live in SQLite (`~/.ownship/ownship.db`); only notes are files.

## Alternatives not taken

- **Notes in SQLite**: faster to query, but opaque to the user and to the generator.
- **A vector store**: a dependency and a pipeline for a folder that is small for a long time.

## Consequences

- When a repo's notes outgrow the generator's input, add SQLite FTS5 to pick the relevant ones; nothing new to install.
- Notes are plain text on disk; they are as private as the user's home directory.
